# Milestone 4 implementation prompt

Use the repository's Cambridge 9618 Pseudocode Guide for Teachers, version 1.3
(for examination from 2021), as the reference. It describes a notation, not a
formal programming language, so specify every choice it leaves open. You may
replace compiler structures when needed, but explain significant changes.

1. Publish a feature matrix tied to the guide's sections: supported, partial,
   unsupported, or intentional extension/difference. Verify claims against
   scanner, parser, checker, generated Wasm, and execution tests.
2. Define evaluation order, numeric conversion and overflow, Boolean logic,
   string representation/operations, array and record value semantics, parameter
   passing, returns and definite assignment. State where the guide is silent.
3. Implement `CASE OF` end to end, including ordered first-match selection,
   inclusive ranges, `OTHERWISE`, no match, type checking, and useful errors.
   Evaluate the selector once. Match the guide's line-oriented syntax.
4. Prioritize further guide-backed gaps only when they can be implemented across
   all stages with positive and negative tests. Do not silently accept a syntax
   construct that the Wasm backend cannot execute. Decide pointer arithmetic
   semantics explicitly before enabling it; decide a file-I/O host contract
   before adding file operations.
5. Build end-to-end reference programs and table-driven edge tests, run the
   complete `npm test`, and only mark roadmap items done when verified. Preserve
   package compatibility unless a deliberate, documented change is necessary.

Acceptance: documented supported programs have specified results, unsupported
ones fail before code generation with precise diagnostics, and the guide's
examples are either executable or explicitly listed as gaps.
