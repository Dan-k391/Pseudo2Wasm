# Performance measurement and optimization policy

For the latest five-way comparison, see
[Native C++ and larger algorithmic workloads](#native-c-and-larger-algorithmic-workloads).
The earlier C/Emscripten and AssemblyScript baselines are under
[Cross-compiler performance](#cross-compiler-performance). The original
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
The original four-way baseline below compares equivalent algorithms compiled to
**WebAssembly in the same Node/V8 process**. The later native section extends
this with MSVC executables and three larger workloads. These are portable
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
These commands now run the expanded suite: `--require-all` additionally requires
Windows/MSVC as described in the native section below. Omit that option to run
the available Wasm tools on other platforms.

`npm run bench:compare -- --quick --require-all` performs a shorter smoke run,
not a publication-quality measurement. Without `--require-all`, absent external
tools are explicitly reported as unavailable and skipped, never assigned a fake
time. A detected compiler that fails to compile a workload fails the run.
Normal `npm test` checks the references, harness, and both Pseudo2Wasm modes
without requiring external compiler SDKs. Cross-compiler correctness is
checked whenever the comparison runs.

### Parameter-read lowering

The first scalar-read architecture slice (historical) reused initialized,
immutable scalar Wasm parameters for reads, while retaining frame sizes and
initialization stores. It did not promote mutable locals or eliminate frames.
Its whole-program alias fallback has since been refined; see the completed
milestone results below and [COMPILER_ARCHITECTURE.md](COMPILER_ARCHITECTURE.md)
for the current safety boundaries.

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
guaranteed speedup. The follow-up below targets the remaining stack-frame and
mutable-local traffic.

### Milestone 7 value and frame lowering

The completed backend promotes definitely assigned basic locals and mutable
BYVAL parameters, separates storage from semantic symbols, and omits eligible
memory frames while retaining their logical stack budget. Constant monotone
FOR ranges can remove proven dimension checks. The portable array kernels use
dynamic bounds/affine indexes, so their bounds checks are **still present**;
their improvements primarily accompany value/frame lowering, not unchecked C
semantics. See [COMPILER_ARCHITECTURE.md](COMPILER_ARCHITECTURE.md) for alias and
uninitialized-memory fallbacks.

Three full runs on 2026-09-26 UTC passed every reference and host-call check:
[run 1](benchmarks/comparison/results-milestone7.json),
[run 2](benchmarks/comparison/results-milestone7-run2.json), and
[run 3](benchmarks/comparison/results-milestone7-run3.json).
These use Node 22.23.1, Binaryen 132, AssemblyScript 0.28.20, and Emscripten
6.0.10 on the same Ryzen 9 9955HX3D Windows machine. Each retains nine rotating
runtime batches and three fresh-process build samples. All three reports record
compiler source hash `94adbd57c44a1f9f42ce1f679e6f81b7e4a1b91e87c391de5e4466da748636c0`.
Package version remains 1.2.0; these are working-source measurements, not a claim
that an already published artifact contains this milestone.

Runtime below is the **median of three run medians**, in microseconds/invocation:

| Workload | Pseudo2Wasm default | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 |
| --- | ---: | ---: | ---: | ---: |
| Integer recurrence | 553.01 | 555.68 | 554.92 | 553.81 |
| Prime sieve | 6.95 | 8.57 | 21.05 | 2.27 |
| Matrix multiplication | 17.15 | 17.14 | 39.54 | 6.70 |
| Recursive Fibonacci | 162.32 | 161.62 | 120.76 | 52.31 |

Compared with the immediately preceding parameter-read report (one full run):

| Workload, Pseudo2Wasm O2 | Previous time → current median | Previous → current Wasm |
| --- | ---: | ---: |
| Integer recurrence | 582.89 → 555.68 µs | 340 → 237 B |
| Prime sieve | 12.59 → 8.57 µs | 744 → 522 B |
| Matrix multiplication | 27.38 → 17.14 µs | 947 → 679 B |
| Recursive Fibonacci | 238.88 → 161.62 µs | 296 → 244 B |

Default binaries are now 262, 599, 771, and 256 bytes respectively (previously
370, 856, 1064, and 318). O2 binaries shrank **18–30%**. These exact size
reductions and generated-code tests provide structural evidence independent of
CPU scheduling. Timing is less isolated: unchanged competitor binaries also got
faster across sessions, so the entire before/after time difference must not be
attributed to this patch. Current O2 run medians ranged from 554.11–575.57 µs,
8.54–9.35 µs, 17.11–17.20 µs, and 161.41–164.32 µs respectively.

O2 is **not universally faster**: sieve is about 23% slower than the new default
in this set, while its binary is smaller. Keep O2 opt-in. Emscripten still leads
the array/recursive workloads, with different safety and optimizer contracts;
Pseudo2Wasm now beats AssemblyScript on these two array kernels but not Fibonacci.
The arithmetic recurrence remains approximately tied across all four modes.
No tail-recursion elimination, algorithm rewrite, SIMD, or safety-check disabling
was introduced to obtain these results.

Median fresh-process build times across the four workloads were 271–317 ms
(default), 372–432 ms (O2), 556–663 ms (AssemblyScript), and 895–913 ms
(Emscripten). These include startup and are not frontend-only timings. Every
timed invocation retained two input calls, one output call, and zero failure
calls. The internal suite's 12 size/host-call budgets also passed unchanged.

### Source organization and backend refinement

AssemblyScript is a formatting/organization reference, not a runtime mandate.
This follow-up separates analysis and runtime-check emission, unifies function
return cleanup, allocates scratch locals on demand, and replaces two-sided
index/pointer comparisons with equivalent unsigned interval checks. These are
general backend techniques; no source-language or stack-budget change is needed.
The broad TypeScript formatting pass itself is **not** a runtime optimization.

Three full runs on 2026-09-26 UTC used the same tools, host, reference cases,
warmup, and rotated-batch methodology as above:
[run 1](benchmarks/comparison/results-organization.json),
[run 2](benchmarks/comparison/results-organization-run2.json), and
[run 3](benchmarks/comparison/results-organization-run3.json).
All report compiler source hash
`256475ce64a891532be3943277643350d5f9e2133275d2598c85aaabf5842324`.
This is still unreleased working source under package version 1.2.0.
The subsequent four-space formatting and personal-comment restoration change
the source hash, not the measured Wasm: rebuilding matched all 24 Pseudo2Wasm
binary hashes across these three reports. The historical reports are unchanged.

Median of three run medians, microseconds per invocation:

| Workload | Pseudo2Wasm default | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 |
| --- | ---: | ---: | ---: | ---: |
| Integer recurrence | 551.89 | 552.37 | 551.73 | 552.03 |
| Prime sieve | 4.40 | 4.25 | 20.60 | 2.25 |
| Matrix multiplication | 11.76 | 11.76 | 39.67 | 6.69 |
| Recursive Fibonacci | 105.01 | 103.84 | 119.71 | 51.99 |

Compared with the preceding milestone-7 three-run medians:

| Workload, Pseudo2Wasm O2 | Previous → current time | Previous → current Wasm |
| --- | ---: | ---: |
| Integer recurrence | 555.68 → 552.37 µs | 237 → 237 B |
| Prime sieve | 8.57 → 4.25 µs | 522 → 498 B |
| Matrix multiplication | 17.14 → 11.76 µs | 679 → 643 B |
| Recursive Fibonacci | 161.62 → 103.84 µs | 244 → 234 B |

Default Wasm sizes changed from 262/599/771/256 to 264/565/719/248 bytes.
The arithmetic kernel is **two bytes larger** without O2 because shared-exit
lowering adds control structure; O2 removes the size difference. The other
default kernels shrink. O2 run medians ranged from 551.80–553.03 µs, 4.25–4.27 µs,
11.71–11.88 µs, and 103.48–103.94 µs respectively.

Sieve, matrix, and Fibonacci show about 50%, 31%, and 36% lower O2 execution
times in these snapshots. Those are workload-specific measurements, not a
universal compiler speedup or proof of how much each individual transform
contributed. Arithmetic is effectively unchanged, and Emscripten still leads
the other three workloads. This run puts Pseudo2Wasm ahead of AssemblyScript on
all three, but their runtime/safety contracts differ; do not generalize that
ordering to other programs. O2 remains optional, not inherently faster.

All bounds/pointer checks still enforce the same conditions and report original
values and locations. Each timed invocation still made two input calls, one
output call, and no failure calls. Median fresh-process build times ranged from
266–315 ms (default), 356–407 ms (O2), 547–638 ms (AssemblyScript), and 874–890 ms
(Emscripten). The full correctness suite and existing size/host-call budgets
remain the acceptance gates; do not loosen them to obtain a favorable chart.

## Native C++ and larger algorithmic workloads

The suite now compares **five configurations**: Pseudo2Wasm default and O2,
AssemblyScript O3, Emscripten O3, and native **MSVC x64 C++ `/O2`**. The first
four execute Wasm in Node/V8; the fifth is a real Windows executable built by
the installed Visual Studio 2026 Community toolchain, MSVC 19.51.36244.
The same `.c` kernel used by Emscripten is compiled as C++ with `/TP` for MSVC;
there is no different native algorithm or hard-coded answer.

Milestone 8 subsequently adds source-location arguments to scalar INPUT imports
and separates execution hosting. The measurements below remain historical
snapshots, not remeasured Milestone 8 timings; current size/host-call budgets are
checked independently. `execute()` timing includes awaited host I/O, unlike the
synchronous benchmark harness; do not compare those numbers interchangeably.

### Added workloads

| Workload | Timed work per invocation | Independent correctness reference |
| --- | --- | --- |
| N-Queens | Enumerate all 2,680 solutions for 11 queens using recursive backtracking and column/diagonal occupancy arrays; seed rotates column traversal | JavaScript bitset search plus known counts (5 queens = 10, 8 = 92, 12 = 14,200) |
| Heapsort | Generate, heap-sort, and compute an order-sensitive checksum of 16,384 integers | JavaScript numeric sort and the same checksum |
| Floyd–Warshall | Initialize a directed 96-vertex weighted graph, perform 884,736 relaxation attempts, and sum all shortest-path distances | Repeated dense Dijkstra, not a second Floyd–Warshall implementation |

These complement the original four kernels, not replace them. Every invocation
resets its own arrays. Four runtime seeds cycle through every measured batch;
batch sizes are multiples of four, including quick runs. All N-Queens versions
use short-circuit occupancy checks. Boundary tests cover empty/single-element
problems and maximum supported capacities, including
12-Queens outside the timed 11-Queens cases. Arithmetic remains within signed
32-bit range. Each invocation checks one result and exactly two inputs/one
output. Sort/graph correctness is checked through a checksum, not an exhaustive
comparison of every output element; these checks are not a formal proof.

The kernels are heavier, reproducible algorithmic benchmarks, **not SPEC,
an official standardized suite, or a substitute for application profiling**.
They still omit floating-point/SIMD-specific code, strings, allocation-heavy
applications, async I/O, and browser startup.

### Native timing and fairness

- One native process stays alive for correctness checks, warmup, calibration,
  and all nine measured batches. `std::chrono::steady_clock` measures the loop
  **inside** that process. Process launch and command/response pipe traffic are
  excluded; input dispatch, output verification, and loop overhead are included.
- The Wasm configurations retain the existing synchronous JS host and
  `performance.now()` batch timer. Native input/output are C++ function calls,
  **not** JS/Wasm boundary crossings. This is an end-to-end configuration
  comparison, not an isolated measurement of the Wasm execution penalty.
- Full runs warm each configuration for at least 200 ms and calibrate batches
  to at least 50 ms. Compiler order rotates between batches; all builds finish
  before timing. Raw samples, median/p95/min/max, build times, input cases,
  exact commands, source/harness hashes, and artifact hashes are saved. Here
  too, p95 describes batch averages, not individual-invocation tail latency.
- Native uses ordinary `/O2` optimization, which permits automatic
  vectorization. The Wasm configurations do not enable SIMD. No undocumented
  optimizer-disabling flag is used to make native slower. See Microsoft's
  [optimization options](https://learn.microsoft.com/en-us/cpp/build/reference/o1-o2-minimize-size-maximize-speed?view=msvc-170)
  and [auto-vectorization documentation](https://learn.microsoft.com/en-us/cpp/parallel/auto-parallelization-and-auto-vectorization?view=msvc-170).
- Native and Emscripten kernels have unchecked C/C++ array access; the checked
  languages keep their normal safety behavior. MSVC also has its own native
  stack/runtime, not Pseudo2Wasm's logical stack budget or 30-page Wasm memory.
  Differences cannot be attributed exclusively to bounds checks or to Wasm.
- Native kernel and host are separate translation units without `/GL` or
  link-time optimization. Runtime inputs and verified outputs prevent the
  timed work from being folded into a constant or hoisted out of the host loop.
  Ordinary inlining and optimization *inside* the kernel are allowed.
- PE executable bytes include native host/CRT/PE overhead and are recorded as
  `executableBytes`, not `wasmBytes`. Do not rank them directly against Wasm
  module sizes. PE timestamps can also change executable hashes across builds.

### Five-way measured results

Three full sequential runs on 2026-09-26 UTC, on the same Ryzen 9 9955HX3D /
Windows 10.0.26200 host, used Node 22.23.1 / V8 12.4.254.21-node.56,
Binaryen 132.0.0, AssemblyScript 0.28.20, Emscripten 6.0.10, and the MSVC version
above. Compiler source hash:
`8424c0927e28557cfb8bd7a19936ed9dec70940a1a1dd8abf693a6d27fab40a1`.
This remains working source under package version 1.2.0, not a new npm release.
No compiler optimization was changed for this benchmark expansion.

**Microseconds per invocation, lower is better; median of three run medians.**
Every run contributes nine batch averages per cell.

| Workload | Pseudo2Wasm default | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 | Native MSVC O2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Integer recurrence | 553.98 | 552.57 | 551.79 | 551.91 | 590.11 |
| Prime sieve | 4.44 | 4.29 | 20.12 | 2.25 | 1.57 |
| Matrix multiplication | 11.82 | 11.81 | 42.22 | 6.67 | 5.72 |
| Recursive Fibonacci | 105.11 | 103.81 | 119.02 | 52.28 | 74.61 |
| 11-Queens | 8599.59 | 8391.80 | 10997.41 | 7639.03 | 7644.28 |
| Heapsort, 16,384 values | 1165.69 | 649.03 | 3048.91 | 508.50 | 539.31 |
| Floyd–Warshall, 96 vertices | 1377.23 | 1388.95 | 3152.19 | 387.70 | 480.21 |

Interpretation:

- Pseudo2Wasm O2 takes about **1.10× native time on N-Queens**, **1.20× on
  heapsort**, and **2.89× on Floyd–Warshall**. The graph kernel exposes a much
  larger gap than the search kernel; there is no single Wasm/native multiplier.
- Native MSVC leads sieve and matrix multiplication. Emscripten/Wasm takes
  less time than MSVC on Fibonacci, heapsort, and Floyd–Warshall; N-Queens is
  effectively tied between those two. Native is not automatically the winner:
  compiler optimization and generated machine code matter as well as target.
  This does not mean Wasm is inherently faster than native C++.
- The four Wasm recurrence results are effectively tied and slightly faster
  than this MSVC build. Do not read their sub-percent differences as a ranking.
- O2 cuts the heapsort execution time by about **44%** versus Pseudo2Wasm
  default here. It does not materially improve Floyd–Warshall. Smaller Wasm
  and higher optimization settings still do not guarantee faster execution.
- Pseudo2Wasm beats this checked AssemblyScript configuration on the six
  non-recurrence workloads, but that is not a claim about all AssemblyScript
  programs, array APIs, runtime modes, or machines.

The heavier-workload **ranges of the three run medians**, also in microseconds:

| Workload | Pseudo2Wasm O2 | AssemblyScript O3 | Emscripten O3 | Native MSVC O2 |
| --- | ---: | ---: | ---: | ---: |
| 11-Queens | 8383.30–8451.71 | 10962.51–11015.63 | 7623.36–7654.81 | 7640.51–7674.44 |
| Heapsort | 643.96–652.41 | 3025.86–3089.17 | 506.98–510.56 | 537.10–540.70 |
| Floyd–Warshall | 1377.68–1389.29 | 3140.33–3243.59 | 385.16–388.69 | 479.84–483.68 |

These are observations, not confidence intervals or regression thresholds.
Reports: [run 1](benchmarks/comparison/results-native-run1.json),
[run 2](benchmarks/comparison/results-native-run2.json), and
[run 3](benchmarks/comparison/results-native-run3.json). All **105 result rows**
passed their reference and timed-output checks. Inputs, tool versions/flags,
source/harness hashes, and Wasm hashes match across runs. Native executable
hashes are recorded individually rather than assumed identical.

Across seven workloads, median fresh-process build times ranged from 265–322 ms
(Pseudo2Wasm default), 359–404 ms (O2), 550–641 ms (AssemblyScript), 874–895 ms
(Emscripten), and 632–648 ms (MSVC, including the native host and linking).
These are small-program build wall times, not a large-project compiler-throughput
ranking. Further optimization work should profile nested-loop/index-address
generation and scalar storage in the graph kernel; these timings alone cannot
isolate the costs of checks, branches, memory accesses, or frame management.

### Reproducing the five-way comparison

Keep the existing AssemblyScript/Emscripten setup described above. For native
C++, install Visual Studio's **Desktop development with C++** workload (MSVC
x64 tools and a Windows SDK). The harness discovers it with `vswhere`, activates
`vcvars64.bat` in a child process, and leaves your current shell unchanged.
No Visual Studio window is opened and no additional toolchain is downloaded.

```sh
npm run bench:compare -- --require-all --output=benchmarks/comparison/results-native-run1.json
node scripts/compare-compilers.mjs --require-all --output=benchmarks/comparison/results-native-run2.json
node scripts/compare-compilers.mjs --require-all --output=benchmarks/comparison/results-native-run3.json
```

Use `--quick` only for a smoke test, not a published timing claim. Run on an
otherwise idle machine, sequentially, not in parallel. `--require-all` now
requires all five configurations; without it missing tools are explicitly
reported as skipped. Native discovery currently supports Windows/MSVC only.
Executables and objects stay in the ignored `benchmarks/comparison/build/`
directory. `npm test` exercises the new pseudocode/reference cases and native
process-protocol failures/timeouts without requiring optional compiler SDKs;
the five-tool command checks the actual native and external Wasm binaries.
