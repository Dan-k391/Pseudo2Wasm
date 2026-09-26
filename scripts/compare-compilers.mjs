import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { casesFor, workloads } from "../benchmarks/comparison/workloads.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceDir = path.join(root, "benchmarks/comparison");
const buildDir = path.join(sourceDir, "build");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function compilerSourceHash() {
    const src = path.join(root, "src");
    const digest = createHash("sha256");
    for (const file of readdirSync(src, {recursive: true}).filter(file => file.endsWith(".ts")).sort()) {
        digest.update(file.replaceAll("\\", "/"));
        digest.update(readFileSync(path.join(src, file)));
    }
    return digest.digest("hex");
}

export function summarize(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return {median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1], min: sorted[0], max: sorted.at(-1)};
}

export function rotated(items, round) {
    const offset = round % items.length;
    return [...items.slice(offset), ...items.slice(0, offset)];
}

function launch(tool, args) {
    const result = spawnSync(tool.command, [...tool.prefix, ...args], {
        cwd: root, env: {...process.env, ...tool.env}, encoding: "utf8",
        timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
    });
    if (result.error || result.status !== 0) {
        throw new Error(`${tool.command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`);
    }
    return result.stdout.trim();
}

function discoverTools() {
    const node = {command: process.execPath, prefix: []};
    const sdk = path.resolve(process.env.EMSDK || path.join(root, "benchmarks/.toolchains/emsdk"));
    const emcc = path.join(sdk, "upstream/emscripten/emcc.py");
    let emscripten;
    if (existsSync(emcc)) {
        const pythonDir = path.join(sdk, "python");
        const python = process.env.EMSDK_PYTHON || (process.platform === "win32"
            ? (existsSync(pythonDir) ? readdirSync(pythonDir) : [])
                .map(name => path.join(pythonDir, name, "python.exe")).find(existsSync) || "python"
            : "python3");
        emscripten = {command: python, prefix: [emcc], env: {EM_CONFIG: path.join(sdk, ".emscripten")}};
    } else {
        // On Windows use an activated SDK via EMSDK, rather than invoking a batch file through a shell.
        emscripten = {command: process.env.EMCC || "emcc", prefix: []};
    }
    const asc = path.join(root, "benchmarks/toolchains/node_modules/assemblyscript/bin/asc.js");
    const tools = [
        {id: "pseudo-none", ...node, prefix: [path.join(root, "scripts/compile-comparison.mjs")],
            version: JSON.parse(readFileSync(path.join(root, "package.json"))).version,
            extension: "pseudo", flags: ["none"]},
        {id: "pseudo-o2", ...node, prefix: [path.join(root, "scripts/compile-comparison.mjs")],
            version: JSON.parse(readFileSync(path.join(root, "package.json"))).version,
            extension: "pseudo", flags: ["binaryen-o2"]},
        {id: "assemblyscript-o3", ...node, prefix: [asc], extension: "ts",
            flags: ["--optimizeLevel", "3", "--shrinkLevel", "0", "--runtime", "stub",
                "--initialMemory", "30", "--maximumMemory", "30"]},
        {id: "emscripten-o3", ...emscripten, extension: "c",
            flags: ["-O3", "-fno-vectorize", "-fno-slp-vectorize", "--no-entry",
                "-Wl,--export=run", "-sINITIAL_MEMORY=1966080", "-sMAXIMUM_MEMORY=1966080",
                "-sALLOW_MEMORY_GROWTH=0", "-sSTACK_SIZE=524288", "-sFILESYSTEM=0"]},
    ];
    for (const tool of tools) {
        if (tool.version) { tool.status = "available"; continue; }
        try {
            tool.version = launch(tool, ["--version"]).split(/\r?\n/)[0];
            tool.status = "available";
        } catch (error) {
            tool.status = "unavailable";
            tool.reason = error.message;
        }
    }
    return tools;
}

export function createRunner(bytes, cases) {
    const start = performance.now();
    let active = cases[0], inputCount = 0, outputCount = 0;
    const fail = (...args) => { throw new Error(`Unexpected runtime failure: ${args.join(",")}`); };
    const env = {
        inputInteger() {
            inputCount++;
            if (inputCount > 2) throw new Error("Too many inputs");
            return inputCount === 1 ? active.n : active.seed;
        },
        logInteger(value) {
            outputCount++;
            if (value !== active.expected) {
                throw new Error(`Incorrect result for ${active.n}/${active.seed}: ${value} != ${active.expected}`);
            }
        },
        failIndex: fail, failPointer: fail, failStack: fail, abort: fail,
    };
    const module = new WebAssembly.Module(bytes);
    if (WebAssembly.Module.imports(module).some(item => item.module === "env" && item.name === "buffer")) {
        env.buffer = new WebAssembly.Memory({initial: 30, maximum: 30});
    }
    const instance = new WebAssembly.Instance(module, {env});
    // Emscripten standalone reactor initialization. AS start executes on instantiation.
    instance.exports._initialize?.();
    const run = instance.exports.run ?? instance.exports.main;
    assert.equal(typeof run, "function", "missing benchmark entry");
    const startupMs = performance.now() - start;
    let sequence = 0;
    function invoke(testCase) {
        active = testCase;
        inputCount = outputCount = 0;
        run();
        if (inputCount !== 2 || outputCount !== 1) throw new Error("Expected exactly two inputs and one output");
    }
    return {
        startupMs,
        invoke,
        batch(count) {
            const begin = performance.now();
            for (let i = 0; i < count; i++) invoke(cases[sequence++ % cases.length]);
            return performance.now() - begin;
        },
    };
}

function calibrate(runner, targetMs) {
    let count = 1;
    while (count < 1048576) {
        if (runner.batch(count) >= targetMs) return count;
        count *= 2;
    }
    return count;
}

export async function main(args = process.argv.slice(2)) {
    for (const arg of args) {
        if (!["--quick", "--require-all"].includes(arg) && !arg.startsWith("--output=")) {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    const quick = args.includes("--quick");
    const samples = quick ? 3 : 9;
    const buildSamples = quick ? 1 : 3;
    const targetBatchMs = quick ? 10 : 50;
    const warmupMs = quick ? 30 : 200;
    const tools = discoverTools();
    for (const tool of tools.filter(t => t.status === "unavailable")) console.error(`SKIPPED ${tool.id}: ${tool.reason}`);
    if (args.includes("--require-all") && tools.some(t => t.status !== "available")) {
        throw new Error("Missing comparison tools; see BENCHMARKS.md setup instructions");
    }
    mkdirSync(buildDir, {recursive: true});
    const available = tools.filter(t => t.status === "available");
    const rows = [];
    // Finish compilation before any runtime measurement so compiler processes do not compete with it.
    for (const workload of workloads) {
        for (const tool of available) {
            console.error(`Building ${workload.name}/${tool.id}`);
            const source = path.join(sourceDir, `${workload.name}.${tool.extension}`);
            const output = path.join(buildDir, `${workload.name}.${tool.id}.wasm`);
            const commandArgs = tool.extension === "pseudo"
                ? [source, output, ...tool.flags] : [source, ...tool.flags, "-o", output];
            const buildMs = [];
            // Untimed build primes tool caches; reported builds still launch fresh processes.
            launch(tool, commandArgs);
            for (let i = 0; i < buildSamples; i++) {
                const start = performance.now();
                launch(tool, commandArgs);
                buildMs.push(performance.now() - start);
            }
            const bytes = readFileSync(output);
            if (!WebAssembly.validate(bytes)) throw new Error(`Invalid module: ${output}`);
            rows.push({workload: workload.name, tool: tool.id, wasmBytes: bytes.length,
                sourceSha256: hash(readFileSync(source)), wasmSha256: hash(bytes),
                command: [tool.command, ...tool.prefix, ...commandArgs].map(p => p.replaceAll(root, "<repo>/")),
                buildWallMs: {...summarize(buildMs), samples: buildMs}, bytes});
        }
    }
    for (const workload of workloads) {
        console.error(`Measuring ${workload.name}`);
        const group = rows.filter(row => row.workload === workload.name);
        const cases = casesFor(workload);
        for (const row of group) {
            const runner = createRunner(row.bytes, cases);
            // This is first instantiation in this process, not a guaranteed cold OS/engine cache.
            row.firstStartupMs = runner.startupMs;
            for (const [n, seed] of workload.edges) runner.invoke({n, seed, expected: workload.reference(n, seed)});
            row.correctnessCases = [...workload.edges.map(([n, seed]) => ({n, seed, expected: workload.reference(n, seed)})), ...cases];
            for (const testCase of cases) runner.invoke(testCase);
            let warmed = 0;
            do { warmed += runner.batch(4); } while (warmed < warmupMs);
            row.runner = runner;
            row.batchIterations = calibrate(runner, targetBatchMs);
            row.runtimeSamplesMs = [];
        }
        for (let round = 0; round < samples; round++) {
            for (const row of rotated(group, round)) {
                row.runtimeSamplesMs.push(row.runner.batch(row.batchIterations) / row.batchIterations);
            }
        }
        for (const row of group) {
            row.runtimeMs = summarize(row.runtimeSamplesMs);
            row.hostCallsPerInvocation = {input: 2, output: 1, failures: 0};
            delete row.runner;
            delete row.bytes;
        }
    }
    const report = {
        schemaVersion: 1, recordedAt: new Date().toISOString(),
        environment: {node: process.version, v8: process.versions.v8, platform: process.platform,
            os: os.release(), cpu: os.cpus()[0]?.model,
            binaryen: JSON.parse(readFileSync(path.join(root, "node_modules/binaryen/package.json"))).version,
            compilerSourceSha256: compilerSourceHash(),
            execArgv: process.execArgv},
        methodology: {quick, samples, buildSamples, targetBatchMs, warmupMs,
            timed: "Warmed instance, synchronous I/O and result verification included; rotated batches; no JSPI",
            build: "Fresh compiler process wall time after an untimed cache-priming build; not frontend-only time",
            safety: "Pseudo2Wasm and AssemblyScript retain bounds checks; C has no array bounds checks",
            memoryPages: 30, simd: false},
        tools: tools.map(({id, status, version, reason, flags}) => ({id, status, version, reason, flags})),
        rows,
    };
    const json = JSON.stringify(report, null, 2) + "\n";
    const output = args.find(arg => arg.startsWith("--output="))?.slice(9);
    if (output) writeFileSync(path.resolve(output), json);
    console.log(json);
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => { console.error(error); process.exitCode = 1; });
}
