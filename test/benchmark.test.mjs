import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Compiler } from "../dist/pseudo2wasm.node.mjs";
import { createRunner, rotated, summarize } from "../scripts/compare-compilers.mjs";
import { casesFor, workloads } from "../benchmarks/comparison/workloads.mjs";
import { createNativeRunner } from "../scripts/native-comparison.mjs";

function compile(source, optimization = "none") {
    const module = new Compiler(source, { optimization }).compile();
    try { return new Uint8Array(module.emitBinary()); }
    finally { module.dispose(); }
}

test("comparison references match hand-checkable results", () => {
    assert.equal(workloads[0].reference(1, 17), 312);
    assert.equal(workloads[1].reference(10, 0), 4);
    assert.equal(workloads[2].reference(1, 17), 289);
    // [0,1;2,3] * [0,3;6,9] = [6,9;18,33].
    assert.equal(workloads[2].reference(2, 0), 66);
    assert.equal(workloads[3].reference(10, 2), 144);
    const queens = workloads.find(workload => workload.name === "n-queens");
    for (const [n, count] of [[0, 1], [1, 1], [2, 0], [3, 0], [4, 2], [5, 10], [8, 92], [11, 2680], [12, 14200]]) {
        assert.equal(queens.reference(n, 17), count);
    }
    const sort = workloads.find(workload => workload.name === "heap-sort");
    assert.equal(sort.reference(0, 17), 0);
    assert.equal(sort.reference(1, 17), 312);
    assert.equal(sort.reference(2, 17), 10631);
    const graph = workloads.find(workload => workload.name === "floyd-warshall");
    assert.equal(graph.reference(1, 17), 0);
    assert.equal(graph.reference(2, 0), 50);
});

test("benchmark rotates measurement order and summarizes raw samples", () => {
    assert.deepEqual(rotated([1, 2, 3], 1), [2, 3, 1]);
    assert.deepEqual(rotated([1, 2, 3], 3), [1, 2, 3]);
    assert.deepEqual(summarize([3, 1, 2]), { median: 2, p95: 3, min: 1, max: 3 });
});

test("comparison harness rejects wrong outputs and missing host calls", () => {
    assert.throws(() => createRunner(compile("OUTPUT 42"), [{ n: 0, seed: 0, expected: 1 }]).batch(1), /Incorrect result/);
    assert.throws(() => createRunner(compile("OUTPUT 42"), [{ n: 0, seed: 0, expected: 42 }]).batch(1), /exactly two inputs/);
});

// Test the process protocol without requiring optional Visual Studio tools in npm test.
const nativeFixture = `
    const readline = require("node:readline");
    console.log("ready");
    readline.createInterface({input: process.stdin}).on("line", line => {
        const [command, value] = line.split(" ");
        if (command === "C" || command === "I") console.log("ok");
        else if (command === "B") console.log(Number(value) / 2);
    });
`;

test("native protocol uses in-process timings and keeps a runner alive across batches", async () => {
    const runner = await createNativeRunner(process.execPath, [{ n: 1, seed: 2, expected: 3 }],
        { args: ["-e", nativeFixture] });
    try {
        await runner.invoke({ n: 4, seed: 5, expected: 6 });
        assert.equal(await runner.batch(8), 4);
        assert.equal(await runner.batch(16), 8);
        assert.ok(runner.startupMs >= 0);
    } finally { runner.close(); }
});

test("native protocol rejects malformed timings and unexpected exits", async () => {
    const runner = await createNativeRunner(process.execPath, [{ n: 0, seed: 0, expected: 0 }],
        { args: ["-e", nativeFixture.replace("Number(value) / 2", '"not a time"')] });
    try { await assert.rejects(runner.batch(1), /Invalid native timing/); }
    finally { runner.close(); }
    await assert.rejects(createNativeRunner(process.execPath, [], { args: ["-e", "process.exit(1)"] }),
        /Native runner exited/);
});

test("native protocol has a bounded response timeout", async () => {
    const runner = await createNativeRunner(process.execPath, [{ n: 0, seed: 0, expected: 0 }],
        { args: ["-e", nativeFixture.replace('console.log(Number(value) / 2)', '{}')], timeoutMs: 1000 });
    try { await assert.rejects(runner.batch(1), /timed out/); }
    finally { runner.close(); }
});

for (const workload of workloads) {
    for (const optimization of ["none", "binaryen-o2"]) {
        test(`${workload.name}/${optimization} matches references on boundaries and repeated runs`, () => {
            const source = readFileSync(new URL(`../benchmarks/comparison/${workload.name}.pseudo`, import.meta.url), "utf8");
            const cases = casesFor(workload);
            const runner = createRunner(compile(source, optimization), cases);
            for (const [n, seed] of workload.edges) {
                runner.invoke({ n, seed, expected: workload.reference(n, seed) });
            }
            assert.ok(runner.batch(cases.length * 2) >= 0);
        });
    }
}
