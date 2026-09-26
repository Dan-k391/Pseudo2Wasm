import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Compiler } from "../dist/pseudo2wasm.node.mjs";
import { createRunner, rotated, summarize } from "../scripts/compare-compilers.mjs";
import { casesFor, workloads } from "../benchmarks/comparison/workloads.mjs";

function compile(source, optimization = "none") {
    const module = new Compiler(source, {optimization}).compile();
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
});

test("benchmark rotates measurement order and summarizes raw samples", () => {
    assert.deepEqual(rotated([1, 2, 3], 1), [2, 3, 1]);
    assert.deepEqual(rotated([1, 2, 3], 3), [1, 2, 3]);
    assert.deepEqual(summarize([3, 1, 2]), {median: 2, p95: 3, min: 1, max: 3});
});

test("comparison harness rejects wrong outputs and missing host calls", () => {
    assert.throws(() => createRunner(compile("OUTPUT 42"), [{n: 0, seed: 0, expected: 1}]).batch(1), /Incorrect result/);
    assert.throws(() => createRunner(compile("OUTPUT 42"), [{n: 0, seed: 0, expected: 42}]).batch(1), /exactly two inputs/);
});

for (const workload of workloads) {
    for (const optimization of ["none", "binaryen-o2"]) {
        test(`${workload.name}/${optimization} matches references on boundaries and repeated runs`, () => {
            const source = readFileSync(new URL(`../benchmarks/comparison/${workload.name}.pseudo`, import.meta.url), "utf8");
            const cases = casesFor(workload);
            const runner = createRunner(compile(source, optimization), cases);
            for (const [n, seed] of workload.edges) {
                runner.invoke({n, seed, expected: workload.reference(n, seed)});
            }
            assert.ok(runner.batch(cases.length * 2) >= 0);
        });
    }
}
