# Milestone 6 implementation prompt

Make performance claims reproducible and subordinate to correctness.

1. Preserve the current default compiler and package behavior. Define benchmark
   workloads for compile latency, Wasm bytes, instantiation/startup, numeric
   loops, array loops, calls, recursion, and string/input/output. Record Node,
   CPU, OS, Binaryen, repetitions, warmup, and summary statistics. Keep host
   callback counts explicit. Measure the current unoptimized baseline first.
2. Audit the typed AST → Binaryen lowering boundary. Add compiler-owned
   transformations only when their proof obligations are clear: no lost source
   locations, no duplicated side effects, no changed trap ordering, and exact
   i32/f64 semantics. Prefer small local transformations to a new IR without
   demonstrated need.
3. Evaluate Binaryen optimization separately from compiler-owned changes.
   Compare at least unoptimized and optimized Wasm on the same deterministic
   programs, including errors, side effects, boundary indexes, and recursion.
   Do not enable a default optimization if differential tests expose a change.
4. Optimize a demonstrated hot path, then rerun benchmarks. Track compile
   latency, startup, execution time, binary size, and host-call counts. Record
   tradeoffs and establish future regression budgets from actual measurements,
   not arbitrary speedup targets.
5. Run the full Node, browser, and packed-package test suite. Mark roadmap
   checkboxes only for completed, reproducible work. Document remaining
   optimization opportunities and why they were not applied.

Acceptance: a contributor can repeat the baseline and optimized comparison;
both modes pass differential behavior checks; every claimed improvement has
measurement evidence; normal execution remains semantically unchanged.
