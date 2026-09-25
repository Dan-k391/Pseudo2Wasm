# Performance measurement and optimization policy

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
path is unchanged. Forty-eight deterministic Node differential cases compare
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
IR or generic constant-folding/dead-code pass was added: the checked AST
already carries the types and spans needed for these local transformations,
while Binaryen O2 provides broader folding and dead-code removal when chosen.

`npm test` derives review budgets from the recorded baseline: no workload may
grow beyond 110% of its measured Wasm size or change its expected successful
host-call count. Timing is reported but not gated in CI because the current
short runs vary with JIT tiering and host load. A controlled benchmark runner
and multiple-machine baseline should precede any timing gate. Further work:
profile browser JSPI execution; improve string/CHAR representation; investigate
loop-range proofs that remain sound when loop variables or bounds are mutated;
and assess whether the 14.4 MiB browser compiler bundle can be split or reduced.
