# Runtime and package API

Milestone 8 separates compilation from execution hosting. This document describes
the current working source; it does not imply that the same changes have already
been published to npm. No recursion transformation or new memory model is added.

## Entry points and ownership

```ts
import { Compiler, getRuntimeCapabilities } from "pseudo2wasm";

const compiler = new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x + 1");
const result = compiler.executeSync([41]);
console.log(result.outputs); // [42], no JSPI needed

const awaited = await compiler.execute([41]); // also no JSPI needed
const binary = compiler.compileBinary(); // owned Uint8Array<ArrayBuffer>
console.log(getRuntimeCapabilities().jspi);
```

| API | Contract |
| --- | --- |
| `diagnose()` | Up to 20 structured errors from the earliest failing compiler phase; no Wasm generation or execution. |
| `compile(log = false)` | Synchronous, caller-owned Binaryen module. Always dispose it after use, including when emission fails. |
| `compileBinary()` | Synchronous validated Wasm bytes. The temporary Binaryen module is disposed in `finally`; the returned array is an owned copy. |
| `executeSync(input = [], output?, inputProvider?)` | Synchronous `ExecutionResult`; never uses JSPI. Throws on a Promise-returning callback. |
| `execute(input = [], output?, inputProvider?)` | Always `Promise<ExecutionResult>`; supports synchronous hosts without JSPI, asynchronous hosts with JSPI. |
| `getRuntimeCapabilities()` | Feature detection of both `WebAssembly.Suspending` and `WebAssembly.promising`; returns `{ jspi: boolean }`. |
| `runtime(output = console.log, inputProvider?)` | Retained compatibility helper returning the execution time in milliseconds. |
| `test(expected)` / `test(input, expectedOutputs)` | Retained Promise-returning compatibility helpers; compare output count and values using `Object.is`. Execution errors still reject. |
| `runCode(code, output, inputProvider?)` | Retained convenience wrapper returning execution time. It uses the same host behavior as `execute()`. |

`ExecutionResult` contains `outputs: (number | string)[]`, `inputsConsumed`, and
`executionTimeMs`. Exported types also include `CompilerOptions`, `InputProvider`,
`OutputConsumer`, `OutputValue`, and the existing diagnostic types.

An ES module consumer imports the Node bundle via package exports. The legacy
CommonJS entry remains awaitable: `const { Compiler } = await require("pseudo2wasm")`.
The browser UMD bundle remains `await window.pseudo2wasm`. These entry points all
wait for Binaryen's initialization before exposing the API; that initialization
is separate from whether a program needs asynchronous I/O.

The packed-artifact tests run a TypeScript ESM consumer with strict declaration
checking in NodeNext and bundler resolution, then execute its emitted JavaScript.
They also exercise the actual CommonJS package export and browser UMD bundle.

## Execution and callbacks

The input queue is shallow-copied when execution is prepared. An input provider,
when supplied, takes precedence over the entire queue. Each INPUT requests one
value, once. Extra queued values are allowed and unused; exhaustion of the queue
is an error. Queue entries must already be resolved values, not Promises.

An output callback is invoked once for each output value, in program order.
INTEGER/REAL produce numbers; CHAR/STRING produce strings; BOOLEAN retains the
published representation `"TRUE"` / `"FALSE"`. `OUTPUT a, b` produces two events,
not an implicitly formatted line. Ordinary callback return values are ignored,
so `value => results.push(value)` remains valid.

With `execute()` and JSPI available, Promise-returning input **and output**
callbacks are awaited before the program proceeds. Providers may mix immediate
values and Promises. Thenables are normalized to real Promises. Only imported
I/O functions with supplied callbacks get JSPI wrappers; preloaded-input runs
with no output callback use direct Wasm calls. A wrapped immediate return does
not suspend, as specified by [JSPI](https://v8.dev/blog/jspi-newapi).

```ts
const result = await compiler.execute([], async value => {
    await saveOutput(value);
}, async () => {
    return await requestInput();
});
```

`saveOutput` and `requestInput` above are application callbacks. Check capabilities
before choosing an async host. Without JSPI, immediate callbacks work normally;
if a callback returns a Promise, the run stops with `E_JSPI_UNAVAILABLE` instead
of feeding a Promise to an i32/f64 import. `executeSync()` instead reports
`E_ASYNC_CALLBACK`, even on a JSPI-capable engine. No speculative callback call,
program replay, background interpreter, or automatic async fallback is used.

The unsupported callback has already been invoked, so its side effects cannot
be rolled back or canceled. Its eventual rejection is observed to avoid an
unhandled-rejection event. Async work should only be started when the selected
execution mode supports it. Synchronous throws and supported async rejections
propagate their **original value**, including non-Error values. No later Wasm
statements run, but earlier output/external effects remain observable. A failed
execution does not return a partial `ExecutionResult`.

Each run compiles and creates fresh memory, cursors, collected output, and string
allocation state. Repeated runs, concurrent suspended runs, and runs after a
failure do not share this state. The host callbacks themselves remain owned by
the caller and can still share external state.

`executionTimeMs` uses the monotonic `performance.now()` timer around main
execution, including callback execution and awaited I/O, excluding compiler
work and Wasm compilation/instantiation. It is not the benchmark harness's
CPU-only measurement. `execute()` is Promise-based, **not a worker**: compilation
and synchronous Wasm work can block the current thread and may happen before
the call returns its Promise. There is no built-in timeout or cancellation;
use an application-owned worker if termination/isolation is required.

## Strict INPUT values

Validation happens before a value crosses into Wasm. No object/string coercion
hooks or partial `parseInt`/`parseFloat` parsing are used.

| Pseudocode type | Accepted input |
| --- | --- |
| INTEGER | A whole JS number within signed i32 range, or trimmed signed decimal digits in that range. No fractions, exponents in strings, hexadecimal, NaN, infinity, Boolean, or bigint. |
| REAL | A finite JS number or trimmed decimal text with optional fractional/exponent parts. Normal IEEE-754 rounding/underflow applies; overflow to infinity is rejected. |
| BOOLEAN | JS `true`/`false`, or trimmed uppercase `"TRUE"`/`"FALSE"` only. `0`, `1`, `"yes"`, and lowercase spellings are not silently converted. |
| CHAR | Exactly one non-surrogate UTF-16 code unit, without trimming. `"é"`, `"中"`, and a single space work. Supplementary characters such as emoji require STRING. |
| STRING | A JS string containing well-formed Unicode text, including empty strings and emoji, but no embedded NUL. No implicit conversion from numbers/objects. |

STRING input uses the existing NUL-terminated UTF-8 heap. CHAR input now matches
the compiler's code-unit representation instead of incorrectly taking the first
UTF-8 byte. This does not redesign string literals, character builtins, or the
other Unicode limitations documented in the language/memory model.

Invalid values raise `RuntimeError` with `E_INPUT_VALUE`; missing values use
`E_INPUT_EXHAUSTED`. Both include the INPUT statement's source location. Async
capability errors at INPUT also carry its location. Output callback errors are
left unchanged, not wrapped with an invented source location. Existing array,
pointer, stack, and input-heap failures retain their source diagnostics. Native
engine traps (for example integer division by zero) remain engine errors and
may lack pseudocode locations.

## Compatibility and support boundary

Existing positional arguments, Promise-returning `execute()`, `runtime()`,
`runCode()`, and both `test()` overloads remain supported. `test()` is a legacy
convenience, not a replacement for assertions. No removal is scheduled; an
incompatible removal/signature change requires a documented major release.
New code should prefer `diagnose()`, `compileBinary()`, and explicit execution.

Strict input rejection, corrected CHAR input, and awaiting async output are
intentional behavioral corrections: callers relying on malformed-value coercion
or fire-and-forget output must adapt. Previously generated low-level modules
are not an API compatibility promise. Current scalar input imports now receive
`(line, column)` like string input; hand-written hosts must account for this ABI
if they inspect arguments or supply typed Wasm imports. Plain JS callbacks that
ignore extra arguments continue to work. No package version is bumped or
published by this milestone; the release must call out these changes.

| Environment capability | Supported use |
| --- | --- |
| WebAssembly, no JSPI | Diagnosis, compilation, sync execution, queued values, and synchronous callbacks through either execution API. |
| WebAssembly plus both JSPI APIs | All of the above, plus Promise-returning I/O callbacks through `execute()`/compatibility wrappers. |

Tests cover Node 22 without JSPI, feature-disabled browser execution, and actual
JSPI in headless Edge. This is not a claim that every browser/version was tested.
The fixed memory cap, incomplete pointer provenance, and engine-dependent native
call-stack limit remain unchanged; see [MEMORY_MODEL.md](MEMORY_MODEL.md).
