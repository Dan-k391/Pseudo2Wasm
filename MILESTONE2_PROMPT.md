# Milestone 2 implementation brief

Improve Pseudo2Wasm's correctness and diagnostics without changing its public
entry points. Treat this as compiler work, not as a collection of string checks.

1. Preserve source spans from scanning through parsing and type checking. Syntax
   and semantic errors should be real `Error` objects with a stable diagnostic
   category, message, line, and column. Point at the smallest relevant token;
   never replace a precise nested error with a less precise outer one.
2. Specify and enforce array bounds for every dimension, including nonzero
   lower bounds and multidimensional arrays. Evaluate each index expression
   exactly once. Out-of-bounds reads and writes must raise a useful runtime
   error before touching adjacent memory.
3. Reserve address zero as null. Dereferencing or writing through null must
   trap. Reject pointer accesses outside linear memory. State clearly what
   pointer provenance is and is not checked; do not claim arbitrary pointer
   arithmetic is safe if the representation cannot prove it.
4. Validate compile-time data placement and runtime stack/heap growth against
   the fixed memory layout. Errors should identify the exhausted region.
5. Add negative regression tests for lexing, parsing, scopes, types, function
   calls, nested control flow, bounds, null pointers, and memory exhaustion.
   Assert diagnostic type, message, and source position where available. Keep
   all existing tests passing. Do not accept generic WebAssembly validation
   failures as ordinary user errors.
6. Document the actual safety contract and limitations, update the roadmap
   only for fully verified work, and run the complete `npm test` command.

Acceptance: invalid source points to its pseudocode location; bad indexes and
null/out-of-memory accesses fail deterministically; no test relies on manually
opening DevTools; existing valid programs remain compatible.
