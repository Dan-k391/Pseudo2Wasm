# Performance measurement and optimization policy

For comparisons with C/Emscripten and AssemblyScript, see
[Cross-compiler performance](#cross-compiler-performance) below. The original
suite in this first section tracks changes within Pseudo2Wasm only.

Run `npm run bench` after `npm ci` to build the Node package and print a JSON
report. `node scripts/benchmark.mjs --quick` shortens repetitions for a smoke
run; `--mode=none` or `--workload=array-loop` isolates a case. `npm test` runs
the quick size/host-call budget check, the differential suite, and both Wasm
modes in headless Edge. The recorded full baseline is
[benchmarks/baseline.json](benchmarks/baseline.json).

The benchmark compiles each program nine times after two warmups and reports
median/p95 compile time. It compiles a Wasm module and creates an instance 25
times after three warmups, reporting median/p95 startup and execution times.
It records emitted Wasm bytes, output digest/count, and all program I/O and
failure-host calls. Startup includes Wasm module compilation and instantiation;
runtime is the synchronous exported `main()` call. This direct Node harness
does **not** measure JSPI suspension, browser startup, asynchronous input, or
the package's `Compiler.execute()` overhead. Run on an otherwise idle machine,
repeat the full command several times, and compare distributions—not one
microsecond-scale sample. The recorded machine is Windows 10.0.26200, Node
22.23.1, Ryzen 9 9955HX3D, and Binaryen 132.0.0.

| Workload | No-opt compile / run / bytes | Binaryen O2 compile / run / bytes | Host I/O calls |
| --- | --- | --- | ---: |
| Numeric loop | 0.676 / 0.608 ms / 597 B | 1.153 / 1.022 ms / 142 B | 1 |
| Array loop | 0.503 / 0.067 ms / 799 B | 2.602 / 0.054 ms / 349 B | 1 |
| Pointer-array loop | 0.770 / 0.120 ms / 1010 B | 6.644 / 0.105 ms / 587 B | 1 |
| Function calls | 0.463 / 0.486 ms / 761 B | 2.016 / 0.203 ms / 319 B | 1 |
| Recursion | 0.325 / 0.964 ms / 796 B | 1.455 / 0.957 ms / 357 B | 1 |
| String/I/O | 0.234 / 0.091 ms / 592 B | 1.496 / 0.082 ms / 228 B | 300 |

These are observed medians, not guaranteed speedups. O2 shrank all six Wasm
modules but increased compilation time and made the numeric loop slower on this
machine. It remains opt-in:

```ts
const compiler = new Compiler(source, { optimization: "binaryen-o2" });
const result = await compiler.execute(input);
```

Optimizing Binaryen's live generator module triggered a LocalCSE assertion in
version 132. The opt-in path first serializes and re-reads the Wasm, restores
the non-serialized `BulkMemoryOpt` feature flag, and then runs O2. The default
path now performs reachability cleanup only. Forty-eight deterministic Node differential cases compare
outputs, host calls, and failure locations between modes; the browser suite
also executes every sample in both modes, including JSPI input and runtime
errors. These tests are a safety net, not a proof for every possible program.

The compiler-owned optimizations are deliberately local to typed Wasm lowering:
an in-range integer-literal array index has no runtime bounds branch, while an
invalid literal retains the runtime error path; pointer-array indexing checks
the whole declared view and each dimension, then omits the provably redundant
final element-address range check. The pointer-loop module shrank from 1041 B
to 1010 B before Binaryen O2. Repeated timing runs did not show a reliable
runtime gain from that specific change, so no speedup is claimed. No separate
IR or generic constant-folding pass was added: the checked AST
already carries the types and spans needed for these local transformations,
while Binaryen O2 provides broader folding and dead-code removal when chosen.

## Follow-up: lean default modules

Default lowering now runs Binaryen's `remove-unused-module-elements` pass to
remove unreachable functions and imports. Callable entry reserves the saved
frame pointer and local storage with one capacity check instead of repeating
checks. This does not remove array or pointer checks without a proof.

| Workload | Original default Wasm | Lean default Wasm |
| --- | ---: | ---: |
| Numeric loop | 597 B | 144 B |
| Array loop | 799 B | 371 B |
| Pointer-array loop | 1010 B | 595 B |
| Function calls | 761 B | 301 B |
| Recursion | 796 B | 337 B |
| String/I/O | 592 B | 245 B |

These are emitted binary sizes, not WAT text length or compiler-bundle size.
A same-machine before/after run showed mixed execution timings; the size
reduction is clear, but a general runtime speedup is not established. The
original JSON baseline is retained for comparison and budget provenance.

`Compiler.execute()` now releases temporary Binaryen modules after emission,
including validation failures; direct `compile()` callers must dispose their
returned modules. String output decodes only bytes up to the NUL terminator,
instead of decoding the entire remaining memory region. The direct benchmark
host does not exercise that package-runtime string path, so its timing cannot
be used to claim a speedup from this change. Browser regressions cover UTF-8,
empty strings, repeated execution, and exact-fit/overflow stack frames in both
optimization modes.

`npm test` derives review budgets from the recorded baseline: no workload may
grow beyond 110% of its measured Wasm size or change its expected successful
host-call count. Timing is reported but not gated in CI because the current
short runs vary with JIT tiering and host load. A controlled benchmark runner
and multiple-machine baseline should precede any timing gate. Further work:
profile browser JSPI execution; improve string/CHAR representation; investigate
loop-range proofs that remain sound when loop variables or bounds are mutated;
and assess whether the 14.4 MiB browser compiler bundle can be split or reduced.

## Cross-compiler performance

The portable comparison suite is in [benchmarks/comparison](benchmarks/comparison)
and runs through [scripts/compare-compilers.mjs](scripts/compare-compilers.mjs).
It compares equivalent algorithms compiled to **WebAssembly in the same Node/V8
process**, not Wasm against native C executables. These are small, portable
microbenchmarks, not an official universal benchmark or a claim about all
applications. The JavaScript references verify results; they are not a timed
competitor.

### Workloads and equivalence

| Workload | Work per invocation | Main pressure |
| --- | --- | --- |
| Integer recurrence | 200,000 steps of `(state * 17 + 23) % 65521` | Dependent integer arithmetic |
| Prime sieve | Sieve up to `4000 + seed % 31` using 8,192 i32 slots | Array initialization, indexing, branching |
| Matrix multiplication | Initialize and multiply two 24×24 integer matrices, then checksum the result | Nested loops, address calculations, array access |
| Recursive Fibonacci | Naive recursive `fib(22 + seed % 3)` | Function calls, recursion, frame management |

Each invocation gets its size and seed through **two runtime imports** and
reports one integer through **one output import**, identically in all languages.
Seeds cycle through 1, 17, 123, and 9. Inputs are not compiler constants, and the
host checks every output against a precomputed independent reference. Array
contents are reset before each calculation. Boundary cases include zero work,
maximum array capacity, and small hand-checkable results. All supplied values
stay within signed i32 range, so C signed-overflow undefined behavior is not
used to explain differences. The compiler is allowed to inline or transform
the algorithm; this is not a forced no-inline call-cost experiment.

The four configurations are:

- **Pseudo2Wasm default:** current lowering and unreachable-element cleanup.
- **Pseudo2Wasm O2:** the public `{ optimization: "binaryen-o2" }` compilation path.
- **AssemblyScript 0.28.20:** optimize level 3, shrink level 0, `stub` runtime;
  checked `StaticArray<i32>` accesses, no `unchecked()` or `--noAssert`. Arrays
  are allocated once during module initialization, not repeatedly in timed calls.
- **Emscripten 6.0.10:** C compiled with `-O3`, standalone `--no-entry` reactor,
  static arrays, no filesystem, and no SIMD/vectorization flags enabled. The
  runner invokes `_initialize` before calling `run`.

All configurations use fixed 30-page memories. Emscripten's C does **not**
provide Pseudo2Wasm/AssemblyScript array bounds checks or equivalent located
errors. This comparison measures each implementation with the stated safety
contract; it does not isolate optimizer quality at equal safety. No compiler
is modified just to improve its benchmark score. See the official
[AssemblyScript options](https://www.assemblyscript.org/compiler.html),
[runtime variants](https://www.assemblyscript.org/runtime.html), and
[Emscripten standalone output](https://emscripten.org/docs/compiling/Building-Projects.html#emscripten-linker-output-files)
for the relevant build behavior. Exact flags are saved in each report.

### How measurements are taken

Compilation finishes for every configuration before runtime timing begins.
Each instance is checked against seven input cases, warmed for at least 200 ms,
and calibrated to batches targeting at least 50 ms. Nine batches per mode
reuse that instance, with compiler order rotated between rounds. Every timed
invocation still verifies its output and exactly two input/one output calls;
that common JS overhead is included, not subtracted. Reports retain all batch
means and their median/p95/min/max. **p95 here describes batch averages, not
individual-call tail latency.** Timings are observations, not regression gates.

The report also records emitted binary size, tool versions, flags, source/Wasm
hashes, Node/V8/CPU/OS, and three compiler-process build times following an
untimed cache-priming build. Build times include launching Node/Python/compiler
processes, loading tools, validation/emission, and writing files; they are not
comparable to the earlier in-process compilation timings. `firstStartupMs`
includes module compilation, allocation and initialization, but is a single
observation and not a guaranteed cold-cache measurement. It is not used for
the runtime ranking.

The harness does not measure browser loading, JSPI, async input, GC-heavy
applications, floating-point/SIMD kernels, large applications, or compiler
download size. A single CPU/engine cannot establish a universal ranking.

### Measured performance

Recorded on 2026-09-26 UTC (September 25 local time), on Windows 10.0.26200,
Ryzen 9 9955HX3D, Node 22.23.1 / V8 12.4.254.21-node.56. Pseudo2Wasm is the
baseline 1.2.0 source snapshot before Milestone 7's parameter-read refactor,
with Binaryen 132.0.0 and the lean-default changes described
above, **not necessarily the published npm 1.2.0 artifact**. The exact compiler
source fingerprint is recorded in the reports. AssemblyScript uses its own
locked Binaryen dependency; its backend is not replaced with ours.

The table shows **microseconds per invocation, lower is better**, using the
median of three independent process-run medians. Each process contributed nine
timed batches per cell. All three runs passed all reference cases and every
timed output/host-call check; emitted binaries were identical across runs.

| Workload | Pseudo2Wasm default | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 |
| --- | ---: | ---: | ---: | ---: |
| Integer recurrence | 584.9 µs | 584.0 µs | 583.1 µs | 583.5 µs |
| Prime sieve | 15.49 µs | 12.87 µs | 22.44 µs | 2.45 µs |
| Matrix multiplication | 35.29 µs | 31.06 µs | 45.35 µs | 7.15 µs |
| Recursive Fibonacci | 268.8 µs | 279.8 µs | 113.4 µs | 56.72 µs |

Interpretation:

- The dependent-integer kernel is effectively tied; the sub-percent differences
  are not evidence of one compiler being faster.
- Emscripten takes substantially less time on the other three kernels.
  Pseudo2Wasm O2 takes approximately **5.3×** its sieve time, **4.3×** its matrix
  time, and **4.9×** its recursive Fibonacci time. C's unchecked array accesses
  are an important qualification for the first two, not a complete explanation
  or a measurement of the cost of checks alone.
- Pseudo2Wasm O2 takes less time than checked AssemblyScript on these two array
  workloads, but about **2.5×** its time on recursion. This does not establish
  superiority on general AssemblyScript applications or different array APIs.
- O2 helps the array cases here, but does not establish a recursion speedup.
  Smaller code is not automatically faster code. These results motivate
  profiling scalar-to-Wasm-local lowering, frame handling, and loop/index
  optimization; they do not isolate the contribution of any one cause.

There is measurable variability: the three matrix medians ranged from
30.47–32.67 µs for Pseudo2Wasm O2 and 45.04–51.71 µs for AssemblyScript.
Do not interpret the displayed decimals as precision guarantees. The raw
reports preserve all samples, build commands, flags, correctness inputs, and
hashes: [run 1](benchmarks/comparison/results-run1.json),
[run 2](benchmarks/comparison/results-run2.json),
[run 3](benchmarks/comparison/results-run3.json).

Emitted **binary size**, including each tool's runtime/exports/metadata overhead:

| Workload | Pseudo2Wasm default | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 |
| --- | ---: | ---: | ---: | ---: |
| Integer recurrence | 382 B | 348 B | 144 B | 446 B |
| Prime sieve | 868 B | 752 B | 798 B | 577 B |
| Matrix multiplication | 1136 B | 989 B | 917 B | 781 B |
| Recursive Fibonacci | 342 B | 313 B | 142 B | 355 B |

These sizes exclude the JS host and compiler downloads and are not direct
counts of executable instructions. They also should not be compared to the
earlier internal-suite numbers: these are different programs with runtime inputs.

Median compiler-process wall times across these four workloads ranged from
272–324 ms (Pseudo2Wasm default), 386–432 ms (Pseudo2Wasm O2), 563–675 ms
(AssemblyScript), and 881–920 ms (Emscripten). These include process/tool startup;
they are **not** a claim that our frontend is proportionally faster, nor a
comparison of large-project build throughput.

### Reproduce the comparison

For the first Milestone 7 follow-up, see
[Parameter-read lowering](#parameter-read-lowering) after the setup instructions.

Optional tools are isolated from the npm package and normal `npm ci`. On a fresh
checkout, install the locked AssemblyScript tools and a repository-local SDK:

```powershell
npm ci
Push-Location benchmarks/toolchains
npm ci
Pop-Location
git clone --depth 1 https://github.com/emscripten-core/emsdk.git benchmarks/.toolchains/emsdk
.\benchmarks\.toolchains\emsdk\emsdk.bat install 6.0.10
.\benchmarks\.toolchains\emsdk\emsdk.bat activate 6.0.10
npm run bench:compare -- --require-all --output=benchmarks/comparison/build/latest.json
```

The SDK is a substantial download into an ignored directory; it is not installed
globally. An existing activated SDK can instead be selected using `EMSDK` (and
`EMSDK_PYTHON` if needed). On Unix, use `./emsdk` instead of `emsdk.bat`; an `emcc`
executable on PATH is also supported. The runner never downloads tools itself.

`npm run bench:compare -- --quick --require-all` performs a shorter smoke run,
not a publication-quality measurement. Without `--require-all`, absent external
tools are explicitly reported as unavailable and skipped, never assigned a fake
time. A detected compiler that fails to compile a workload fails the run.
Normal `npm test` checks the references, harness, and both Pseudo2Wasm modes
without requiring either external compiler. Cross-compiler correctness is
checked whenever the comparison runs.

### Parameter-read lowering

The first AssemblyScript-inspired architecture slice reuses initialized,
immutable scalar Wasm parameters for reads, while retaining frame sizes and
initialization stores. It does not promote mutable locals or eliminate frames.
See [COMPILER_ARCHITECTURE.md](COMPILER_ARCHITECTURE.md) for its conservative
whole-program alias fallback and compatibility constraints.

A full follow-up run with all four modes passed reference and host-call checks.
Raw data: [parameter-read report](benchmarks/comparison/results-parameter-reads.json).
The baseline below is the median of the original three run medians; the new
column is **one** full run of nine batches, not three repeated runs.

| Workload (Pseudo2Wasm O2) | Baseline time | Follow-up time | Binary before → after |
| --- | ---: | ---: | ---: |
| Integer recurrence | 584.0 µs | 582.9 µs | 348 → 340 B |
| Prime sieve | 12.87 µs | 12.59 µs | 752 → 744 B |
| Matrix multiplication | 31.06 µs | 27.38 µs | 989 → 947 B |
| Recursive Fibonacci | 279.8 µs | 238.9 µs | 313 → 296 B |

Size reductions and removed parameter loads are directly observable. Runtime
changes are preliminary: unchanged competitor binaries also varied (for
example, Emscripten Fibonacci measured 62.54 µs versus the earlier 56.72 µs
aggregate). Do not treat this as an isolated causal timing experiment or a
guaranteed speedup. The remaining stack-frame and mutable-local traffic is
still a target for later milestone work.
