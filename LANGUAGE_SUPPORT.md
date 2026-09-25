# Language support and semantics

Reference: the repository's *Cambridge 9618 Pseudocode Guide for Teachers*,
version 1.3 (for examination from 2021). The guide explicitly describes a
notation, not a mandatory programming-language grammar. This document is the
compiler's more precise contract. A feature marked **partial** works only in
the stated subset; unsupported forms should be rejected before Wasm lowering.

| Guide area | Status | This compiler's contract |
| --- | --- | --- |
| Identifiers, declarations, constants (§2–3) | Partial | Typed declarations work; identifier spelling is currently case-sensitive, unlike the guide. DATE, enumerated types and constants are not implemented. |
| INTEGER, REAL, CHAR, STRING, BOOLEAN (§3) | Partial | INTEGER is signed i32, REAL is f64. Strings work for literals, variables, INPUT/OUTPUT and LENGTH/UCASE/LCASE; DATE and several guide string operations are missing. |
| Arrays and records (§3, §5) | Partial | Fixed-size inclusive-index arrays and named records work. Whole-value assignment copies all bytes; arrays require equal shape and element type, records require the same declared type. Arrays passed as callable parameters currently behave as pointer-like aliases, an intentional deviation from whole-value BYVAL semantics. RECORD parameters/returns are rejected. |
| Assignment, arithmetic, relations (§4) | Partial | Same-type assignment and INTEGER→REAL widening only. `+`, `-`, `*` are numeric; `/` returns REAL; `DIV` and `MOD` require INTEGER. Mixed INTEGER/REAL comparisons widen to REAL. CHAR comparisons and BOOLEAN equality work. String comparison and `&` concatenation are not yet supported. |
| INPUT and OUTPUT (§4) | Partial | Basic values can be input/output. `OUTPUT a, b` evaluates left to right and emits two output callback events, not one combined line. Formatting is host-controlled. |
| IF / CASE (§6) | Partial | IF requires BOOLEAN. CASE matches the first ordered label or inclusive range, then OTHERWISE; its selector is evaluated once. INTEGER, REAL, CHAR and BOOLEAN selectors work; STRING CASE is rejected. |
| WHILE / REPEAT / FOR (§6) | Partial | WHILE/UNTIL require BOOLEAN. FOR bounds are inclusive; positive and negative integer-literal STEP work; omitted STEP is 1. STEP 0 and dynamic STEP are rejected. The TO expression is evaluated at each comparison. |
| Functions and procedures (§7) | Partial | BYVAL copies basic/pointer values; BYREF aliases an assignable, exactly typed basic value and writes are visible to the caller. Functions require RETURN on every statically visible path. Composite parameter/return value semantics remain incomplete. |
| File handling (§8) | Unsupported | No implicit browser or Node filesystem. Before implementation, define an explicit async host-file capability (open/read/write/close, handles, EOF, errors, encoding and permission policy) and test it in both runtimes. |
| Pointers | Extension | Typed address-of/dereference are an extension. Pointer arithmetic is intentionally rejected until scaling, bounds, provenance and lifetime semantics are specified. |

Evaluation is left to right for expression operands and callable arguments.
`AND`/`OR` short-circuit. Assignment resolves the destination address before
evaluating the right-hand value; composite copies use `memory.copy`.
INTEGER `+`, `-` and `*` use Wasm i32 wraparound; signed division and remainder
trap on zero divisor (and signed division also traps on MIN_INT / -1). REAL uses
IEEE-754 f64. There is no general implicit conversion among CHAR, BOOLEAN and
numeric types. Equality uses numeric value after INTEGER→REAL widening, or the
same CHAR/BOOLEAN type; string equality is not implemented.

Strings are stored as UTF-8 bytes in linear memory and exposed to the host as
JavaScript strings. String indexing, concatenation, comparison, RIGHT and MID
are not yet supported. The current fixed memory layout and incomplete pointer
provenance checks are documented in the README and targeted for Milestone 5.

`RETURN` terminates a function path; the checker requires a return on every
statically visible path, including all CASE branches when OTHERWISE exists.
The compiler does not yet perform general definite-assignment analysis for
variables: declarations without explicit initialization have Wasm's zeroed
memory representation. Treat that as an implementation detail, not a CAIE rule.
