import { performance } from "node:perf_hooks";
import os from "node:os";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import binaryen from "binaryen";
import { Compiler } from "../dist/pseudo2wasm.node.mjs";

const quick = process.argv.includes("--quick");
const compileSamples = quick ? 3 : 9;
const runSamples = quick ? 5 : 25;
const selectedMode = process.argv.find(arg => arg.startsWith("--mode="))?.slice(7);
const selectedWorkload = process.argv.find(arg => arg.startsWith("--workload="))?.slice(11);
const modes = selectedMode ? [selectedMode] : ["none", "binaryen-o2"];
const workloads = [
    {name: "numeric-loop", code: `DECLARE i: INTEGER
DECLARE total: INTEGER
total <- 0
FOR i <- 1 TO 2000000
    total <- total + i
NEXT i
OUTPUT total`},
    {name: "array-loop", code: `DECLARE a: ARRAY[0:255] OF INTEGER
DECLARE i: INTEGER
DECLARE pass: INTEGER
DECLARE total: INTEGER
FOR i <- 0 TO 255
    a[i] <- i
NEXT i
total <- 0
FOR pass <- 1 TO 200
    FOR i <- 0 TO 255
        total <- total + a[i]
    NEXT i
NEXT pass
OUTPUT total`},
    {name: "pointer-array-loop", code: `PROCEDURE sum(a: ARRAY[0:255] OF INTEGER)
    DECLARE i: INTEGER
    DECLARE pass: INTEGER
    DECLARE total: INTEGER
    total <- 0
    FOR pass <- 1 TO 200
        FOR i <- 0 TO 255
            total <- total + a[i]
        NEXT i
    NEXT pass
    OUTPUT total
ENDPROCEDURE
DECLARE a: ARRAY[0:255] OF INTEGER
DECLARE i: INTEGER
FOR i <- 0 TO 255
    a[i] <- i
NEXT i
CALL sum(a)`},
    {name: "function-calls", code: `FUNCTION twice(x: INTEGER) RETURNS INTEGER
    RETURN x + x
ENDFUNCTION
DECLARE i: INTEGER
DECLARE total: INTEGER
total <- 0
FOR i <- 1 TO 100000
    total <- total + twice(i)
NEXT i
OUTPUT total`},
    {name: "recursion", code: `FUNCTION descend(n: INTEGER) RETURNS INTEGER
    IF n = 0 THEN
        RETURN 0
    ENDIF
    RETURN 1 + descend(n - 1)
ENDFUNCTION
DECLARE i: INTEGER
DECLARE total: INTEGER
total <- 0
FOR i <- 1 TO 10000
    total <- total + descend(32)
NEXT i
OUTPUT total`},
    {name: "string-io", code: `DECLARE s: STRING
DECLARE i: INTEGER
FOR i <- 1 TO 100
    INPUT s
    OUTPUT LENGTH(s), s
NEXT i`, input: Array(100).fill("hello pseudocode")},
];

const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
};
const p95 = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.95) - 1];
};

export function compile(code, mode) {
    let module = new Compiler(code).compile();
    try {
        if (mode.startsWith("binaryen-o")) {
            // Keep optimizer-owned mutable IR separate from generator IR.
            const features = module.getFeatures();
            const canonical = binaryen.readBinary(module.emitBinary());
            module.dispose();
            module = canonical;
            module.setFeatures(features);
            const previous = binaryen.getOptimizeLevel();
            try {
                binaryen.setOptimizeLevel(Number(mode.slice("binaryen-o".length)));
                module.optimize();
            } finally {
                binaryen.setOptimizeLevel(previous);
            }
        }
        if (!module.validate()) throw new Error("Invalid generated Wasm");
        return new Uint8Array(module.emitBinary());
    } finally {
        module.dispose();
    }
}

export function instantiate(bytes, suppliedInput = []) {
    const memory = new WebAssembly.Memory({initial: 30, maximum: 30});
    const outputs = [];
    const calls = {io: 0, failures: 0};
    let inputIndex = 0;
    let heap = 24 * 65536;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const emit = value => { calls.io++; outputs.push(value); };
    const input = () => { calls.io++; return suppliedInput[inputIndex++]; };
    const failure = kind => (...args) => {
        calls.failures++;
        throw new Error(`${kind}:${JSON.stringify(args)}`);
    };
    const env = {
        buffer: memory,
        logInteger: emit, logReal: emit,
        logChar: value => emit(String.fromCharCode(value)),
        logBoolean: value => emit(value ? "TRUE" : "FALSE"),
        logString: ptr => {
            const bytes = new Uint8Array(memory.buffer, ptr);
            const length = bytes.indexOf(0);
            emit(decoder.decode(bytes.subarray(0, length)));
        },
        inputInteger: () => Number(input()), inputReal: () => Number(input()),
        inputChar: () => String(input()).charCodeAt(0),
        inputBoolean: () => input() ? 1 : 0,
        inputString: () => {
            const bytes = encoder.encode(String(input()));
            const address = heap;
            new Uint8Array(memory.buffer, heap, bytes.length + 1).set(bytes);
            heap += bytes.length + 1;
            return address;
        },
        failIndex: failure("index"), failPointer: failure("pointer"),
        failStack: failure("stack"),
        randomInteger: () => 0, startTime: () => {}, endTime: () => {},
    };
    const wasmModule = new WebAssembly.Module(bytes);
    const instance = new WebAssembly.Instance(wasmModule, {env});
    return {instance, outputs, calls};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
const rows = [];
for (const workload of workloads.filter(item => !selectedWorkload || item.name === selectedWorkload)) {
    for (const mode of modes) {
        const compileMs = [];
        for (let i = 0; i < compileSamples + 2; i++) {
            const start = performance.now();
            compile(workload.code, mode);
            if (i >= 2) compileMs.push(performance.now() - start);
        }
        const bytes = compile(workload.code, mode);
        const startupMs = [];
        const runtimeMs = [];
        let result;
        for (let i = 0; i < runSamples + 3; i++) {
            const start = performance.now();
            result = instantiate(bytes, workload.input);
            const started = performance.now();
            result.instance.exports.main();
            const ended = performance.now();
            if (i >= 3) {
                startupMs.push(started - start);
                runtimeMs.push(ended - started);
            }
        }
        rows.push({workload: workload.name, mode, wasmBytes: bytes.length,
            compileMedianMs: median(compileMs), compileP95Ms: p95(compileMs),
            startupMedianMs: median(startupMs), startupP95Ms: p95(startupMs),
            runtimeMedianMs: median(runtimeMs), runtimeP95Ms: p95(runtimeMs),
            hostCalls: result.calls, outputCount: result.outputs.length,
            outputDigest: createHash("sha256").update(JSON.stringify(result.outputs)).digest("hex")});
    }
}
const report = {environment: {node: process.version, platform: process.platform,
    release: os.release(), cpu: os.cpus()[0]?.model,
    binaryen: JSON.parse(readFileSync(new URL("../node_modules/binaryen/package.json", import.meta.url))).version,
    compileSamples, runSamples, wasmMemoryPages: 30,
    note: "Synchronous direct Wasm invocation; excludes browser JSPI and async I/O."}, rows};
for (const workload of workloads) {
    const pair = rows.filter(row => row.workload === workload.name);
    if (pair.length !== 2) continue;
    assert.equal(pair[1].outputDigest, pair[0].outputDigest,
        `${workload.name}: optimization changed outputs`);
    assert.deepEqual(pair[1].hostCalls, pair[0].hostCalls,
        `${workload.name}: optimization changed host calls`);
}
if (process.argv.includes("--check")) {
    const baseline = JSON.parse(readFileSync(new URL("../benchmarks/baseline.json", import.meta.url)));
    for (const row of rows) {
        const previous = baseline.rows.find(item => item.workload === row.workload && item.mode === row.mode);
        if (!previous) throw new Error(`Missing budget for ${row.workload}/${row.mode}`);
        if (row.wasmBytes > Math.ceil(previous.wasmBytes * 1.10)) {
            throw new Error(`${row.workload}/${row.mode} Wasm grew from ${previous.wasmBytes} to ${row.wasmBytes} bytes`);
        }
        if (row.hostCalls.io !== previous.ioCalls || row.hostCalls.failures !== 0) {
            throw new Error(`${row.workload}/${row.mode} host-call budget changed`);
        }
    }
    console.log(`${rows.length} measured Wasm-size and host-call budgets passed`);
} else {
    console.log(JSON.stringify(report, null, 2));
}
}
