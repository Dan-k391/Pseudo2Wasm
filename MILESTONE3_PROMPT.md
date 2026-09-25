# Milestone 3 implementation prompt

Build a compiler-grade diagnostics pipeline for Pseudo2Wasm. You may refactor
the scanner, parser, checker, errors, and public API. Preserve valid-program
behavior and the existing thrown-error API for a single failure.

1. Define a stable structured diagnostic with code, phase, severity, message,
   exact source span, and optional related locations. Render a one-based
   `line:column` with the source line and caret/range; retain machine-readable
   zero-based columns. Do not turn internal bugs into user diagnostics.
2. Make the scanner and parser recover at safe boundaries and collect independent
   errors up to a documented limit. Continue semantic checking only on sound
   parsed statements; skip malformed or failed declarations to prevent cascades.
   Never generate Wasm from a program with diagnostics.
3. Give callers a non-throwing way to inspect all compilation diagnostics while
   keeping `compile()` and `execute()` errors compatible. If several errors exist,
   throw an aggregate carrying the same diagnostics.
4. Replace vague, incorrect, and misspelled user-facing messages. Preserve
   source positions across host/Wasm runtime errors, including stack and heap
   failures, without hiding unrelated internal errors.
5. Add tests for exact spans, formatting, independent lex/syntax/semantic errors,
   cascade suppression, error limits, runtime locations, and compatibility.
   Run `npm test` and update README/ROADMAP only for verified outcomes.

Acceptance: one compile can report several actionable errors, editor clients
can consume positions without parsing text, the same source never silently
compiles after recovery, and existing valid programs still pass.
