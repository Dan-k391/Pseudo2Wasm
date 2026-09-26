# Compiler source style and organization

AssemblyScript is a **source-style and organization reference**, not a required
variable, function, memory, or stack design. Its compiler source demonstrates
explicit types, named compiler concepts, and imports
grouped around responsibilities:
[AssemblyScript compiler source](https://github.com/AssemblyScript/assemblyscript/blob/main/src/compiler.ts).
We use those readable conventions without copying its GC/runtime or claiming
that every implementation detail should match. This project uses four-space
indentation and keeps the author's personal voice in comments.

Optimization choices are evaluated independently. For example, promotion of
memory-backed values is a common compiler technique, also described by
[LLVM's mem2reg pass](https://llvm.org/docs/Passes.html#mem2reg-promote-memory-to-register).
Our structured analysis is not LLVM SSA or a port of that pass. Techniques from
LLVM/Clang, Emscripten, Binaryen, or other compilers are welcome when their
preconditions match this language and measurements justify the change.

## Formatting

```sh
npm run format
npm run format:check
```

These cover all TypeScript under `src/` and `test/`, including older compiler
modules. They use the existing, locked TypeScript language-service formatter;
no new formatter dependency is needed. `npm test` checks formatting first.
`.editorconfig` supplies matching four-space defaults for editors.

The formatter changes whitespace, not identifier spellings or string/template
contents. It preserves existing LF/CRLF line endings, and fixture tests verify
literal-byte preservation and idempotence. Avoid regex-based indentation edits:
multiline pseudocode strings contain meaningful diagnostic source positions.

- Use four spaces, spaces around operators, and consistent comma/brace spacing.
- Prefer double quotes in new ordinary TypeScript strings; retain existing
  literal spellings when changing them serves no purpose.
- Use PascalCase for new types/classes, camelCase for values and functions.
  Legacy exported names such as `tokenType`, `nodeKind`, and `lookUp` remain
  compatible; do not rename the public surface solely for appearance.
- Use explicit parameter/return types at module boundaries and inference where
  the type is immediately apparent. Keep invariant comments close to their code.
- Preserve personal/funny comments and attribution alongside useful explanations
  of behavior and constraints. Remove misleading or redundant comments,
  commented-out dead code, and TODOs for already implemented features.
- Formatting is a mechanical change. Review semantic changes separately with
  `git diff -w`, and test them; formatting alone is not an optimization.

## Module boundaries

| Location | Responsibility |
| --- | --- |
| `src/lex/` | Tokens, scanning, lexical source spans |
| `src/syntax/` | AST, parsing/recovery, structural traversal |
| `src/type/` | Semantic symbols, scopes, type resolution/checking |
| `src/analysis/` | Read-only assignment, alias/call, and loop-range proofs |
| `src/codegen/` | Storage locations, function contexts, Wasm emission |
| `src/codegen/runtime-abi.ts` | Imported host names and Wasm signatures |
| `src/codegen/runtime-checks.ts` | Located stack/index/pointer checks |
| `src/compiler.ts` | Public compilation pipeline and JS execution host |

Analysis modules do not create Binaryen IR or write backend state into semantic
symbols. Storage and temporary locals belong to a particular generator/function.
Host ABI changes require matching host, browser, and packed-package tests.
Source locations must survive every relevant analysis and lowering decision.

Scope lookup shares one iterative implementation across distinct semantic
namespaces. Case selectors and scratch slots belong to their function context,
not mutable module-wide globals. Function exits converge before one frame
cleanup, which must occur **after** the return expression finishes evaluation.

See [COMPILER_ARCHITECTURE.md](COMPILER_ARCHITECTURE.md) for safety contracts and
[BENCHMARKS.md](BENCHMARKS.md) for measured performance, including regressions and
tradeoffs. Favor explicit boundaries over either a single ever-growing generator
or a large abstraction hierarchy with no demonstrated need.
