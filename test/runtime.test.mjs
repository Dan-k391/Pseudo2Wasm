import assert from "node:assert/strict";
import test from "node:test";
import { Compiler, RuntimeError, getRuntimeCapabilities, runCode } from "../dist/pseudo2wasm.node.mjs";

async function withoutJspi(body) {
    const descriptors = ["Suspending", "promising"].map(name => [name, Object.getOwnPropertyDescriptor(WebAssembly, name)]);
    try {
        for (const [name] of descriptors) Object.defineProperty(WebAssembly, name, {value: undefined, configurable: true});
        await body();
    } finally {
        for (const [name, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(WebAssembly, name, descriptor);
            else delete WebAssembly[name];
        }
    }
}

const inputProgram = type => `DECLARE value: ${type}\nINPUT value\nOUTPUT value`;

for (const optimization of ["none", "binaryen-o2"]) {
    test(`${optimization}: compile-only, queued input, and sync callbacks need no JSPI`, async () => withoutJspi(async () => {
        assert.deepEqual(getRuntimeCapabilities(), {jspi: false});
        const compiler = new Compiler(inputProgram("INTEGER"), {optimization});
        assert.deepEqual(compiler.diagnose(), []);
        assert.ok(WebAssembly.validate(compiler.compileBinary()));
        const seen = [];
        assert.deepEqual(compiler.executeSync([42], value => seen.push(value)).outputs, [42]);
        assert.deepEqual((await compiler.execute([43])).outputs, [43]);
        let calls = 0;
        assert.deepEqual((await compiler.execute([], undefined, () => { calls++; return 44; })).outputs, [44]);
        assert.equal(calls, 1);
        assert.deepEqual(seen, [42]);
        assert.deepEqual(new Compiler("OUTPUT 9", {optimization}).executeSync().outputs, [9]);
        const promise = compiler.execute([1]);
        assert.ok(promise instanceof Promise);
        const result = await promise;
        assert.equal(result.inputsConsumed, 1);
        assert.ok(Number.isFinite(result.executionTimeMs) && result.executionTimeMs >= 0);
    }));

    const valid = [
        ["INTEGER", -2147483648, -2147483648], ["INTEGER", " +2147483647 ", 2147483647],
        ["INTEGER", "0012", 12], ["REAL", ".125e2", 12.5], ["REAL", " -1.5 ", -1.5],
        ["REAL", 1.25, 1.25], ["BOOLEAN", true, "TRUE"], ["BOOLEAN", false, "FALSE"],
        ["BOOLEAN", " TRUE ", "TRUE"], ["BOOLEAN", "FALSE", "FALSE"],
        ["CHAR", "é", "é"], ["CHAR", "中", "中"], ["CHAR", " ", " "],
        ["STRING", "héllo 😀", "héllo 😀"], ["STRING", "", ""],
    ];
    test(`${optimization}: strict typed input preserves valid values`, async () => {
        for (const [type, input, expected] of valid) {
            const compiler = new Compiler(inputProgram(type), {optimization});
            assert.deepEqual(compiler.executeSync([input]).outputs, [expected], type);
            assert.deepEqual((await compiler.execute([], undefined, () => input)).outputs, [expected], type);
        }
    });

    const invalid = {
        INTEGER: ["12abc", "1.5", "1e2", "0x10", "", " ", 1.5, NaN, Infinity, 2147483648, -2147483649, true, null, undefined, {}, 1n],
        REAL: ["1.2abc", "0x10", "", "Infinity", "1e999", NaN, Infinity, true, null, {}],
        BOOLEAN: ["yes", "true", "0", 0, 1, null, undefined],
        CHAR: ["", "ab", "😀", "\ud800", "\udc00", 65, null],
        STRING: ["a\0b", "\ud800", "\udc00", 42, false, null, {}],
    };
    test(`${optimization}: invalid input is located and rejected before Wasm coercion`, async () => {
        for (const [type, inputs] of Object.entries(invalid)) {
            const compiler = new Compiler(inputProgram(type), {optimization});
            const check = error => {
                assert.ok(error instanceof RuntimeError);
                assert.equal(error.code, "E_INPUT_VALUE");
                assert.equal(error.phase, "runtime");
                assert.equal(error.line, 2);
                assert.equal(error.startColumn, 0);
                assert.match(String(error), /INPUT value/);
                return true;
            };
            for (const input of inputs) {
                assert.throws(() => compiler.executeSync([input]), check);
                await assert.rejects(compiler.execute([input]), check);
            }
        }
    });

    test(`${optimization}: exhaustion, queue snapshots, and provider precedence are predictable`, async () => {
        const compiler = new Compiler("DECLARE x: INTEGER\nOUTPUT 0\nINPUT x\nOUTPUT x", {optimization});
        assert.throws(() => compiler.executeSync(), error => error.code === "E_INPUT_EXHAUSTED" && error.line === 3);
        const queue = [7];
        assert.deepEqual(compiler.executeSync(queue, () => { queue[0] = 99; }).outputs, [0, 7]);
        assert.deepEqual(compiler.executeSync([999], undefined, () => 8).outputs, [0, 8]);
        assert.deepEqual((await compiler.execute([9, 10])).outputs, [0, 9]);
        assert.equal((await compiler.execute([9, 10])).inputsConsumed, 1);
    });

    test(`${optimization}: callback errors propagate unchanged and execution stops`, async () => {
        const marker = new Error("host failure");
        const compiler = new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x, 2", {optimization});
        assert.throws(() => compiler.executeSync([], undefined, () => { throw marker; }), error => error === marker);
        await assert.rejects(compiler.execute([], undefined, () => { throw marker; }), error => error === marker);
        const seen = [];
        await assert.rejects(compiler.execute([1], value => { seen.push(value); throw marker; }), error => error === marker);
        assert.deepEqual(seen, [1]);
        assert.deepEqual(compiler.executeSync([3]).outputs, [3, 2]);
    });

    test(`${optimization}: missing JSPI rejects promises without retrying callbacks`, async () => withoutJspi(async () => {
        const compiler = new Compiler(inputProgram("INTEGER"), {optimization});
        let calls = 0;
        await assert.rejects(compiler.execute([], undefined, () => { calls++; return Promise.reject(new Error("late")); }),
            error => error.code === "E_JSPI_UNAVAILABLE" && error.line === 2);
        assert.equal(calls, 1);
        const outputs = [];
        await assert.rejects(new Compiler("OUTPUT 1, 2", {optimization}).execute([], value => {
            outputs.push(value);
            return Promise.reject(new Error("late output"));
        }), error => error.code === "E_JSPI_UNAVAILABLE");
        assert.deepEqual(outputs, [1]);
        await new Promise(resolve => setTimeout(resolve, 0)); // rejected callbacks must be observed
    }));

    test(`${optimization}: sync API rejects thenables and queues reject unresolved values`, async () => {
        const compiler = new Compiler(inputProgram("INTEGER"), {optimization});
        assert.throws(() => compiler.executeSync([], undefined, () => Promise.resolve(1)), error => error.code === "E_ASYNC_CALLBACK");
        assert.throws(() => new Compiler("OUTPUT 1, 2", {optimization}).executeSync([], () => Promise.reject("late")),
            error => error.code === "E_ASYNC_CALLBACK");
        await assert.rejects(compiler.execute([Promise.reject("queue")]), error => error.code === "E_INPUT_VALUE");
        assert.throws(() => compiler.executeSync([], undefined, () => ({then(resolve) { resolve(4); }})),
            error => error.code === "E_ASYNC_CALLBACK");
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    test(`${optimization}: repeated runs have independent memory, input cursors, and outputs`, async () => {
        const compiler = new Compiler(inputProgram("STRING"), {optimization});
        const a = compiler.execute(["first"]), b = compiler.execute(["second"]);
        const results = await Promise.all([a, b]);
        assert.deepEqual(results.map(r => r.outputs), [["first"], ["second"]]);
        results[0].outputs.push("changed");
        assert.deepEqual(compiler.executeSync(["third"]).outputs, ["third"]);
    });
}

test("legacy helpers and runCode remain usable with synchronous hosts", async () => withoutJspi(async () => {
    const compiler = new Compiler("OUTPUT 42");
    assert.equal(await compiler.test(42), true);
    assert.equal(await compiler.test([], [42]), true);
    assert.equal(await compiler.test([], [43]), false);
    assert.equal(await compiler.test([], []), false);
    const seen = [];
    assert.ok(await compiler.runtime(value => seen.push(value)) >= 0);
    assert.ok(await runCode(inputProgram("INTEGER"), value => seen.push(value), () => 7) >= 0);
    assert.deepEqual(seen, [42, 7]);
}));

test("compileBinary owns its temporary module on success and every failure path", () => {
    for (const failure of ["none", "validation", "emission"]) {
        let disposals = 0;
        const compiler = new Compiler("OUTPUT 1");
        const expected = new Error("emission");
        const bytes = Uint8Array.of(1, 2, 3);
        compiler.compile = () => ({
            validate: () => failure !== "validation",
            emitBinary: () => { if (failure === "emission") throw expected; return bytes; },
            dispose: () => { disposals++; },
        });
        if (failure === "none") {
            const result = compiler.compileBinary();
            result[0] = 99;
            assert.equal(bytes[0], 1, "owned copy survives module disposal");
        } else assert.throws(() => compiler.compileBinary(), error => failure === "validation" ? /validation/.test(error.message) : error === expected);
        assert.equal(disposals, 1);
    }
});
