# Pseudo2Wasm roadmap

This is the project's working plan. Check off an item only when its acceptance
criteria are met. Each section can also become a GitHub milestone, with its
checkboxes turned into issues if we want public progress tracking.

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

## Milestone 3: Predictable runtime and package API

- [ ] Detect missing JSPI APIs and report the supported execution options.
- [ ] Document and test sync/async `INPUT` callbacks, output ordering, and
      error propagation in browser and Node environments.
- [ ] Separate compile-only use from execution in the public documentation;
      clarify which operations require JSPI.
- [ ] Replace or justify the fixed 30-page memory layout and test allocation
      limits and string encoding.
- [ ] Define a compatibility/deprecation policy for `Compiler.test()` and other
      public exports before changing them.

Done when the published package's documented examples work in every stated
environment and unsupported environments fail clearly.

## Milestone 4: Language coverage

- [ ] Turn the CAIE pseudocode guide into a feature matrix: supported,
      partially supported, unsupported, or intentionally different.
- [ ] Add `CASE` with tests for matching, default/no match, and invalid cases.
- [ ] Specify and test string operations such as concatenation and comparison.
- [ ] Decide the scope of file operations and implement them only after a host
      API and browser/Node behavior are specified.
- [ ] Update grammar, examples, and tests together for each new construct.

Done when users can see exactly which pseudocode constructs work and how any
intentional differences from the guide behave.

## Milestone 5: Release and contributor experience

- [ ] Provide a short quick-start example for browser and Node users.
- [ ] Add a supported-environments table and troubleshooting notes for JSPI.
- [ ] Add a changelog and a repeatable release checklist, including version,
      build, tests, `npm pack --dry-run`, and npm publish verification.
- [ ] Consolidate the historical roadmap notes in the README and `roadmap.txt`
      so this file is the single current plan.
- [ ] Add focused contributor instructions for adding a language feature and
      its tests.

Done when a new user can install and run a documented example, and a release
can be prepared from a clean checkout without relying on the old archives.

## Later possibilities

- A VS Code pseudocode extension (syntax highlighting, run command, and
  diagnostics), after source locations and the runtime API are stable.
- An online playground with sharable examples.
- Optimization benchmarks and larger-program performance work.

These are ideas, not commitments; prioritize them based on actual user demand.
