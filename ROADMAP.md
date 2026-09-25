# Pseudo2Wasm roadmap

This is the project's working plan. Check off an item only when its acceptance
criteria are met. Each section can also become a GitHub milestone, with its
checkboxes turned into issues if we want public progress tracking.

The current lexer, parser, checker, error model, intermediate representation,
and memory layout are not architectural constraints. Refactor or replace them
when a clearer compiler design is needed for correctness, diagnostics, or
performance. Preserve documented behavior through tests, measure performance
changes, and explain significant structural changes and tradeoffs afterwards.

## Milestone 1: Trustworthy tests

- [x] Make `npm test` a non-interactive command that exits nonzero on failure.
- [x] Add fast Node tests for the scanner, parser, type checker, and public API.
- [x] Keep browser execution tests for WebAssembly JSPI, including `INPUT` and
      string input/output; run them automatically in a supported browser.
- [x] Test the contents of `npm pack`, including the Node and browser entry
      points, before publishing.

Done: a fresh checkout can run the checks with a documented command that
reports a clear pass or failure without manually opening DevTools.

## Milestone 2: Correctness and useful errors

- [x] Add source locations to scanner, parser, and type-checker errors.
- [x] Add regression tests for invalid syntax, names and scopes, type errors,
      function calls, and nested control flow.
- [x] Decide and document the behavior of out-of-bounds array access, then
      enforce it with tests.
- [x] Define and test invalid/null pointer behavior and memory limits.
- [x] Remove generic failures such as "Module validation error" where a
      specific source-level error can be reported.

Done: common mistakes point to the relevant pseudocode line, array accesses
trap before leaving declared bounds, and null/out-of-memory pointer accesses
trap. This is not full pointer provenance or lifetime safety; see README.

## Milestone 3: Diagnostics that help fix programs

- [x] Define one structured diagnostic shape (code, severity, phase, message,
      source span, and optional related locations) for scanner, parser, checker,
      and runtime failures. Keep the existing thrown-error API usable.
- [x] Render the source line, caret/range, and a specific explanation; replace
      vague, misleading, and misspelled messages, including `Not implemented yet`.
- [x] Add parser recovery at safe statement/declaration boundaries, then collect
      independent semantic errors without cascades. Set a documented error limit.
- [x] Attach locations to runtime failures such as stack/heap exhaustion and
      preserve them across the Wasm/host boundary.
- [x] Test exact spans, error codes, recovery, and no-cascade behavior with
      programs containing several independent mistakes.

Done when a compile call can report multiple actionable errors, an editor can
consume their spans without parsing text, and a failure never masquerades as
successful compilation. Recovery must not hide or invent errors.

Implemented with a 20-error cap and phase gating: lexical errors stop parsing,
and syntax errors stop semantic checking. This avoids reporting speculative
errors from malformed input; independent errors within a sound phase accumulate.

## Milestone 4: Specified language semantics

- [x] Make a CAIE pseudocode feature matrix with supported, partial, unsupported,
      and intentionally different behavior; turn each supported rule into tests.
- [x] Define expression evaluation order, numeric conversions and overflow,
      equality, string encoding/operations, array and record value semantics,
      parameter passing, and function return/definite-assignment rules.
- [x] Decide whether pointer arithmetic belongs in the language. If it does,
      specify element scaling, bounds, and lifetime behavior before implementing
      it; otherwise keep it explicitly rejected.
- [x] Implement `CASE` and other prioritized language gaps with parser, checker,
      backend, positive, and negative tests together. Decide the file-I/O host
      contract before adding file operations.
- [x] Add table-driven edge cases and end-to-end reference programs so backend
      behavior is checked against the specified semantics, not just Wasm validity.

Done when the supported language is explicit and the checker rejects programs
the backend cannot faithfully execute. Features are complete across every
compiler stage, not merely recognized by the parser.

Implemented subset and remaining gaps: [LANGUAGE_SUPPORT.md](LANGUAGE_SUPPORT.md).
The Milestone 4 prompt and acceptance criteria are in
[MILESTONE4_PROMPT.md](MILESTONE4_PROMPT.md). `npm test` passes the Node,
headless Edge, and packed-package checks.

## Milestone 5: Safe, efficient Wasm execution

- [x] Specify the memory model: globals, stack, heap, strings, allocation growth,
      alignment, pointer validity, and what happens when each region is exhausted.
      Replace or justify the fixed 30-page layout.
- [x] Choose and implement a pointer safety contract. Track allocation bounds
      and lifetime if promising safe pointers; otherwise document and test the
      exact unsafe cases rather than implying linear-memory checks are enough.
- [x] Lower common array/pointer/stack checks to Wasm. Keep host calls for
      reporting failures and genuine I/O, not on every successful memory access.
- [x] Preserve source locations for Wasm-side traps and verify reads, writes,
      multidimensional bounds, recursion, and string allocation at the limits.
- [x] Audit generated Wasm for validation, alignment, evaluation-once behavior,
      overflow in address calculations, and unsupported constructs. Add focused
      regression tests for each corrected code-generation bug.

Done when valid memory-heavy programs run without a JS callback per access,
invalid accesses fail deterministically, and the documented safety contract
matches what the generated Wasm actually enforces.

The chosen contract is **linear-memory range checking, not allocation-safe
pointers**. The fixed 30-page partition is retained as a deterministic cap.
See [MEMORY_MODEL.md](MEMORY_MODEL.md) for layout, alignment, exhaustion,
unsafe aliases, and known limits; [MILESTONE5_PROMPT.md](MILESTONE5_PROMPT.md)
records the implementation brief. The generated-Wasm test checks that failure
imports are conditional; browser tests exercise the memory boundaries.

## Milestone 6: Measured compiler and runtime performance

- [x] Establish reproducible benchmarks for compile time, Wasm size, startup,
      numeric loops, array loops, function calls, recursion, and string/I/O
      workloads; record a baseline and the test environment.
- [x] Separate typed semantic representation from Wasm lowering where needed so
      optimization passes can preserve source spans and language semantics.
- [x] Add safe constant folding, dead-code elimination, and redundant-check
      removal where benchmarks justify them. Evaluate Binaryen optimization
      levels separately from compiler-owned transformations.
- [x] Compare optimized and unoptimized execution on the same correctness suite;
      add differential or property-based tests for edge cases and optimizer bugs.
- [x] Track compile latency, runtime, binary size, and host-call counts. Set
      regression budgets from measured baselines rather than an arbitrary speed
      claim; document tradeoffs when one metric improves at another's expense.

Done when performance claims have reproducible evidence, hot loops stay in Wasm,
and optimization cannot silently change program results or diagnostics.

The existing checked AST already separates semantic analysis from Wasm
lowering; no new IR was needed for the demonstrated local transforms. Binaryen
O2 is opt-in because measured compile/runtime tradeoffs vary by workload.
See [BENCHMARKS.md](BENCHMARKS.md), its recorded baseline and budgets, and
[MILESTONE6_PROMPT.md](MILESTONE6_PROMPT.md). Timing budgets remain advisory
until measurements are stable in a controlled environment.

## Milestone 7: Predictable runtime and package API

- [ ] Detect missing JSPI APIs and explain supported compile-only and execution
      options without a cryptic platform exception.
- [ ] Test sync/async `INPUT`, output ordering, thrown/rejected callbacks, and
      runtime-error propagation in supported browser and Node environments.
- [ ] Define the public compile/execute/diagnostics API and a compatibility or
      deprecation policy for `Compiler.test()` and other existing exports.
- [ ] Test Node and browser entry points from the packed npm artifact, including
      TypeScript declarations and documented examples.

Done when consumers can tell which APIs require JSPI and every supported entry
point behaves consistently; unsupported environments fail clearly.

## Milestone 8: Release and contributor experience

- [ ] Provide short browser and Node quick starts, a supported-environments
      table, and troubleshooting guidance for JSPI and compiler diagnostics.
- [ ] Add a changelog and release checklist covering version, build, full tests,
      benchmark comparison, `npm pack --dry-run`, and publish verification.
- [ ] Consolidate historical roadmap notes in the README and `roadmap.txt` so
      this file is the single current plan.
- [ ] Document how to add a language feature across scanner, parser, checker,
      Wasm lowering, diagnostics, and tests.

Done when a new contributor can implement and verify a feature, and a release
can be prepared from a clean checkout without the old archives.

## Later possibilities

- A VS Code pseudocode extension using structured diagnostics and the stable
  package API.
- An online playground with shareable examples.

These are ideas, not commitments; prioritize them based on actual user demand.
