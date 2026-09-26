# Compiler architecture: values before storage

The direction is inspired by AssemblyScript's statically typed, direct-to-Wasm
approach ([introduction](https://www.assemblyscript.org/introduction.html)), not
an attempt to copy its implementation or introduce its source syntax. CAIE
pseudocode and the published API remain the contracts of this project.

## Current stage boundaries

1. Scanner/parser build syntax and recover source diagnostics.
2. Checker resolves scopes and types and rejects invalid programs.
3. Read-only backend analyses inspect checked syntax.
4. Generator lowers the checked program using explicit per-callable state.
5. Binaryen reachability cleanup always runs; broader O2 remains optional.

`src/syntax/walk.ts` visits executable expressions/statements exhaustively.
It does not recurse through scope parents, resolved types, or symbol tables.
Call names are not treated as variable reads. The visitor is structural, not
a control-flow graph or execution-order model; CASE/FOR identifier fields need
explicit handling by analyses that care about reads/writes.

`src/codegen/parameter-reads.ts` performs analysis without creating Wasm or
mutating semantic symbols. Results map **symbol identity** to Wasm parameter
indices, so same-spelled variables in different callables do not collide.

`src/codegen/function-context.ts` owns return-value and memory-check temporary
indices and the callable's read plan. Generator saves/restores the complete
context and scope in `finally`, including the enclosing frame offset.
Function and procedure emission share one lowering path; explicit returns and
fallthrough use one epilogue implementation.

## First optimization: immutable scalar parameter reads

An initialized, basic BYVAL parameter can be read with `local.get` rather than
repeated stack-memory loads if no assignment, INPUT, or FOR induction writes
it anywhere in its body. CASE selector reads use the same read abstraction.
All basic types, including f64 REAL and pointer-valued STRING, preserve their
existing value representation.

The optimization currently opts out for the **entire program** if executable
syntax contains address-taking, dereference, pointer-valued expressions, or a
callable has pointer/BYREF parameters. This is intentionally conservative:
our unsafe raw pointers have no provenance and can alias adjacent objects or
reused stack slots. Absence of `^parameter` alone is not proof of no aliases.
Array views resolved to pointer parameters also trigger the fallback.

Parameter initialization stores and all frame sizes/offsets remain unchanged.
This preserves exhaustion checks and reused-memory contents, including current
uninitialized-local behavior. Only subsequent proven-immutable reads change.
Ordinary mutable locals are **not** silently converted into zero-initialized
Wasm locals, and no stack checks or source locations are removed.

## Remaining architectural work

Semantic `Symbol.pointer` and `Scope.returnIndex` remain legacy coupling; the
new context no longer uses the latter, but both fields stay compatible for
existing low-level consumers. Replace storage pointers with backend-owned
location descriptors before general local promotion. Keep taking an address
separate from reading a value or assigning a value.

General promotion requires definite-assignment and alias/effect analysis.
Frameless functions also require an explicit recursion-exhaustion contract:
otherwise a located compiler stack error could become an engine stack trap.
Loop-range proofs must account for mutable loop bounds and induction variables.

New internal modules use descriptive PascalCase types, camelCase members,
explicit discriminated cases, and comments documenting invariants. Refactor
one tested boundary at a time; preserve the existing exported names and CAIE
behavior. Do not add unsafe modes, classes/generics, or change the source
language merely because AssemblyScript has those features.

## Verification

`test/codegen.test.mjs` checks generated code and execution for eligible reads,
mutation, nested control flow, CASE/FOR/INPUT, aliases, scope separation, mixed
parameter types, and frame reuse. Browser tests cover suspension and the
existing exact-fit/overflow memory boundaries in both optimization modes.
The portable benchmarks compare results against independent references; old
measurement reports remain historical rather than being silently overwritten.
