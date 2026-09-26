# Compiler architecture and source organization

AssemblyScript is a reference for **source formatting and organization**, not a
constraint on variable, function, or stack design. Runtime choices are based on
this project's semantics and evidence; techniques from LLVM/Clang, Emscripten,
Binaryen, and other compilers are welcome. CAIE pseudocode and the published API
remain the contracts. See [CODE_STYLE.md](CODE_STYLE.md) for conventions and
module ownership.

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

## Backend storage and per-callable state

`src/codegen/storage.ts` defines discriminated locations: Wasm local/parameter,
linear-memory global address, frame-relative slot, and indirect BYREF parameter.
A local can additionally have a memory shadow for compatibility. Source globals
remain in linear memory; this milestone does not promote them to Wasm globals.
Generator's `readVariable`, `writeVariable`, and `getPointer` separate reading,
writing, and address formation. Addresses are fresh Binaryen expressions, not
cached expression graphs on semantic symbols.

`src/codegen/function-context.ts` owns storage maps, temporary/local allocation,
active loop ranges, and frame policy. Maps use **symbol identity**, not spelling.
Generator saves/restores context, scope, and offset in `finally`. Functions and
procedures share prologue/body/epilogue lowering. Scalar assignment, INPUT, FOR,
CASE, and ordinary expressions all use the same storage abstraction.

The obsolete parameter-read-only pass was replaced by `analysis/value-analysis.ts`.
`Symbol.pointer`, `Scope.setPointer`, and `Scope.returnIndex` remain deprecated
compatibility members, but normal code generation neither reads nor populates
them. Low-level consumers must use Generator's address methods instead of
expecting module-owned references to appear on a checked AST. Generator's legacy
`setPointer` method stores a backend-owned explicit location. Re-lowering the
same checked AST with independent generators is covered by a regression test.

## Control flow and definite assignment

`analysis/definite-assignment.ts` is a structured forward must-analysis on checked syntax:
assignment and INPUT establish values, IF/CASE joins intersect live predecessors,
RETURN removes a predecessor, WHILE/FOR may run zero times, REPEAT runs at least
once, and FOR initializes its induction variable even on a zero-trip loop.
Declarations do not reset storage. BYREF calls are conservatively reads, not
guaranteed writes. This is deliberately not SSA or an unstructured CFG: the
source language has only structured flow and no GOTO/break/continue.

Only basic local symbols whose reads are definitely assigned are candidates.
REAL gets an f64 local; INTEGER, CHAR, BOOLEAN, and STRING use i32. Incoming
BYVAL parameters reuse parameter indices and can now be mutated directly.
Unproven reads are **not new compilation errors** and are not silently zeroed:
they retain legacy memory behavior, including contents from previous calls.
This optimization analysis does not promise complete user-facing
definite-assignment diagnostics or field/element initialization analysis.

## Address and call effects

`analysis/value-analysis.ts` records symbol-specific BYREF/address exposure and a call
graph. A monotone fixed point propagates raw-memory effects through transitive
and recursive calls. Ordinary BYREF pins its actual target, not unrelated scalar
locals. An unrelated BYREF routine no longer disables every function's local
reads. Unknown pointer provenance is never assumed to be object-local.

Two separate safety decisions are intentional:

- **Value coherence:** a callable with a reachable raw-memory effect retains
  memory reads. In a program with raw pointers, BYREF callees also have a raw
  effect: a forged argument can point into their own future parameter slots.
- **Observable memory history:** any raw-address use, unproven local read, or
  local aggregate conservatively retains original frames and scalar shadow
  writes throughout the program. Even a pure function's old slots may later be
  read through an unsafe view. Its reads can still use locals when coherent.

The second rule is a residual whole-program *layout/spill* fallback, not the old
whole-program ban on optimized reads. Refining it requires provenance/lifetime
or aggregate initialization proofs; dropping it would change supported behavior.

## Frameless calls and recursion

When every local is promoted and memory history need not be preserved, no
saved-base memory slot, parameter spill, or frame-base update is emitted.
However, the original `4 + scope.size()` bytes are still charged to `__stackTop`
and released on return. The same Wasm capacity check and declaration location
remain. This preserves exact-fit and exhaustion semantics without memory-frame
traffic; it is not an unlimited-recursion mode.

The engine's native Wasm call stack is a separate resource. Very deep recursion
with tiny logical frames can still exhaust it first, as before this milestone;
its engine-specific trap is not promised to carry a pseudocode location. No
tail-call elimination or recursion-to-loop rewrite is applied because skipping
logical charges would alter the specified exhaustion behavior. Recursive
benchmarks evaluate the frame/value transformation, not a different algorithm.

## Proven loop checks

`analysis/loop-ranges.ts` proves inclusive ranges for constant, monotone FOR loops with
nonzero steps, no i32 overflow on the final increment, and no induction writes
in the body (including nested FOR and INPUT). Calls and pointer effects in the
body, and BYREF parameters in the current callable, conservatively reject the
proof. Bounds are attached to the induction symbol only while lowering its body.
Each matching array dimension is unchecked only if its full proven range fits.
Nested loops and non-unit/descending steps are covered. Dynamic bounds, affine
index expressions, WHILE induction, pointer-view range checks, and all uncertain
cases retain checks. No speculative guard or unsafe optimization mode is added.

## Emission refinements independent of compiler inspiration

`runtime-abi.ts` owns import names/signatures; `runtime-checks.ts` owns the Wasm
failure paths. The generator chooses when a proof permits omitting a check but
does not duplicate the check formulas. Failure imports still receive the original
index/pointer and original source coordinates.

For a non-wrapping signed i32 interval `[lower, upper]`, an index is invalid when
`unsigned(index - lower) > unsigned(upper - lower)`. Underflow maps a below-bound
index above the allowed unsigned extent. This replaces two comparisons plus OR
with one unsigned comparison; a zero lower bound also needs no subtraction.
Pointer checks use the same interval identity with the valid byte-address range.
Inputs are evaluated once, invalid sizes still fail, and no safety condition is
weakened. Extreme i32 values and exact memory endpoints have regression coverage.

All function RETURN sites branch with a value to one typed return block. The
return expression, including calls or async input, finishes while the frame is
still active; one epilogue then releases/restores the frame. The unreachable
fallthrough marker expresses the checker's all-paths-return invariant to Wasm.
This is shared-exit lowering, not tail-call elimination.

Only scratch locals actually requested by checks are allocated. CASE uses a
per-function i32/f64 selector local instead of module globals. Simple output-only
entry points therefore need no unused scratch locals at all. Frame byte charges,
pointer semantics, and runtime error contracts remain unchanged.

## Naming and extension rules

New internal modules use descriptive PascalCase types, camelCase members,
explicit discriminated cases, and comments documenting invariants. Refactor
one tested boundary at a time; preserve the existing exported names and CAIE
behavior. Do not add unsafe modes, classes/generics, or change the source
language merely because AssemblyScript has those features.

## Verification

`test/codegen.test.mjs` checks generated code and execution for value promotion,
branch joins, nested control flow, CASE/FOR/INPUT, transitive and forged aliases,
scope separation, mixed types, frame reuse, repeatable lowering, and loop-proof
rejections. Frameless recursion tests exact logical capacity and error location.
Browser tests cover promoted values across asynchronous suspension and existing
exact-fit/overflow memory boundaries in both optimization modes.
The portable benchmarks compare results against independent references; old
measurement reports remain historical rather than being silently overwritten.
