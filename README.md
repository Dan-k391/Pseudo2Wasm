# OAC

See [ROADMAP.md](ROADMAP.md) for the current milestones and progress checklist.
See [LANGUAGE_SUPPORT.md](LANGUAGE_SUPPORT.md) for the supported CAIE subset and
precise language semantics.
See [MEMORY_MODEL.md](MEMORY_MODEL.md) for the fixed Wasm layout and pointer-safety
boundary.
See [BENCHMARKS.md](BENCHMARKS.md) for reproducible performance measurements and
the optional Binaryen O2 mode.

## Development setup

Use Node.js 22 or newer and npm, then install the locked dependencies with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check source and browser tests without writing JavaScript. |
| `npm run build` | Check types, then build the browser and Node packages and declarations. |
| `npm run build:test` | Build the browser test page in `dist-test/`. |
| `npm test` | Build, run Node and headless-browser tests, then test the packed npm artifact; exits nonzero on failure. |
| `npm run test:browser` | Serve the browser test page for interactive debugging. |
| `npm run bench` | Build the Node package and benchmark unoptimized versus Binaryen O2 Wasm. |

`tsconfig.json` is the shared editor/type-checking configuration. It uses
TypeScript's `bundler` module resolution because Webpack resolves the source's
extensionless imports. `tsconfig.build.json` extends it only to emit package
declarations. `webpack.config.js` builds the browser test page; the two explicit
targets in `webpack.package.config.js` create the browser UMD bundle and Node
ES module. These TypeScript resolution settings do not choose an npm entry point:
the `exports` field in `package.json` does that for consumers.

`npm test` requires a recent Chrome or Edge with WebAssembly JSPI. Set
`PSEUDO2WASM_BROWSER` to the browser executable path if it is not in a standard
location. The tests run without opening a visible browser or DevTools.
`npm run test:browser` remains available for interactive debugging. Programs
using `INPUT` also need an input callback.

## npm package

The npm package is built from this repository. Install it with `npm install pseudo2wasm`.
In a browser project, `runCode` compiles and executes pseudocode and sends each
`OUTPUT` value to your callback:

```ts
import { runCode } from "pseudo2wasm";

await runCode("OUTPUT 1 + 2", value => console.log(value));
```

CommonJS consumers can use `const compiler = await require("pseudo2wasm")`.
The CommonJS entry is awaitable because Binaryen initializes asynchronously.

Programs that use `INPUT` need a third callback. The runtime uses WebAssembly
JSPI (`WebAssembly.Suspending` and `WebAssembly.promising`), so execution requires
a browser with those APIs enabled. Compiling alone does not require JSPI.

To prepare a package release, run `npm run build` and `npm pack --dry-run`.
The build creates browser and Node entry points plus TypeScript declarations in
`dist/`. `npm run build:test` builds the browser tests into `dist-test/`.
The `prepack` script rebuilds the package when `npm pack` or `npm publish` runs.

## About

OAC (Oh a compiler)
Inspired by zjj
灵感来源于zjj


### Pseudo2Wasm
Is an improvement to OAC(Web version),
adds an IR generation layer implemented with binaryen.
still in progress

### How it works
This compiler, compiles CAIE PseudoCode into WebAssembly.
It uses the following process.
1. Lexical Analysis
2. Syntax Analysis
3. Semantic Analysis(Type Check)
4. IR Generation(with binaryen)
5. Code Generation
6. Optimization
7. Runtime

The checker validates names, types, function returns, array dimensions, and
assignment targets before WebAssembly generation.

### RoadMap
The notes below are historical. See [ROADMAP.md](ROADMAP.md) for the current plan.
- [x] OUTPUT
- [x] 变量操作
- [x] IF
- [x] 循环 (WHILE, REPEAT, FOR)
- [x] FUNCTION & PROCEDURE 
- [x] 优先实现CHAR
确实，得先实现数组和字符串，再搞指针
- [x] 数组和字符串
就快实现数组了，现在遇到一个问题
是否加入语义分析模块（虽然加入这个项目做到后期肯定会加）
比如数组越界等问题就很棘手，当然可以直接让数组第一位存长度
但这样太麻烦了，让整个编译器好像是半静态半动态内存一样
比如在wasm中判断是否越界就又要考虑报错方法加入abort函数
然后考虑是否将整个过程整合成单独的wasm函数，实在不伦不类
所以目前的数组是静态的，所有的长度以及大小都是固定生成
- [x] 指针
- [ ] 文件操作
- [x] 结构体

- [x] INPUT

## Precautions

This compiler treats pseudocode as a statically typed language. Array indexes
must be `INTEGER` values within every declared inclusive dimension. Invalid
reads and writes raise `RuntimeError` before accessing memory:

So, for example
```
DECLARE i: ARRAY[0: 9] OF INTEGER

i[10] <- 20
```
This now raises `Array index 10 outside [0:9]` with a source location.

Address zero is null, and null dereferences trap. Pointer arithmetic is
rejected by the checker. The checker also rejects pointer writes to nonlocal
storage from inside a function or procedure. Pointers outside linear memory
trap, but this is **not a fully memory-safe pointer system**: provenance is not
tracked, so an alias to reused stack storage may still become stale. Do not
rely on C-style arbitrary pointer manipulation.

Memory is currently fixed at 30 WebAssembly pages (1.875 MiB): global data
ends at page 16, stack space occupies pages 16–24, and input strings use pages
24–30. Exceeding a region raises an explicit error. Function local frames are
reserved once per call, including declarations inside loops. Routine index,
pointer-range, and stack checks execute in Wasm; JavaScript is called only on
their failure paths to report a located error.

Every `FUNCTION` must have a `RETURN` on every statically visible path.
`INPUT` needs an assignable basic-type target. Compatible whole-array and
whole-record assignments copy their values.

Syntax and semantic errors include a 1-based `line:column` in their message.
Their `startColumn` property is zero-based for editor integrations.

For all source diagnostics without generating Wasm, use `new Compiler(code).diagnose()`.
It returns entries with `code`, `severity`, `phase`, `message`, and a source
`span` (`line`/`endLine` are one-based; columns are zero-based). It collects up
to 20 errors at safe statement/declaration boundaries. Compilation still throws
the familiar `SyntaxError` or `RuntimeError` for a single problem; multiple
problems throw `CompilationError` with a `diagnostics` array. Error text includes
the source line and caret. The scanner, parser, and checker stop at the first
phase with errors rather than guessing later errors from malformed input, and
no WebAssembly is generated when diagnostics exist. Runtime array, pointer,
stack, and input-string heap failures also include a source location where one
is available. A stack overflow points to the function/procedure declaration.

The type checker permits same-type assignment and INTEGER-to-REAL widening;
it rejects cross-type CHAR/BOOLEAN/numeric operations. `/` produces REAL,
while `DIV` and `MOD` require INTEGER operands.

## Basic Grammar

#### Comments
```
// This is a comment
```

#### Declarations

***Look for examples here***

```
// Variable declaration
DECLARE <Identifier>: <Type>
// Array declaration
DECLARE <Identifier>: ARRAY[<Upper>: <Lower>] OF <Type>

// Examples
DECLARE i: INTEGER
DECLARE j: ARRAY[0: 9] OF INTEGER
```
Only supports static length arrays.

#### Assignments
```
<Expression> <- <Expression>

// Examples
i <- 9
j[2] <- 3
k.y <- 4.1
f <- 'd'
```
The type of right side of the assignment is resolved and the compiler attempts to convert it to the type of the left hand side and assigns the value to it.

**Implicit type conversion**

Only INTEGER widens implicitly to REAL. Other basic types do not implicitly
interconvert.

INTEGER, CHAR and BOOLEAN are all i32 types after converted to wasm. REAL is f64.

#### If statements
```
IF <Expression> THEN
    <Statements>
ELSE
    <Statements>
ENDIF

// Examples
IF 1 > 2 THEN
    OUTPUT 'a'
ELSE
    OUTPUT 'b'
ENDIF
```

#### While loop
```
WHILE <Expression>
    <Statements>
ENDWHILE

// Examples
WHILE i < 10
    OUTPUT i
    i <- i + 1
ENDWHILE
```

#### For loop
```
// The default step is 1
FOR <Identifier> <- <Int_Expr> TO <Int_Expr>
    <Statements>
NEXT <Identifier>

// Use step
FOR <Identifier> <- <Int_Expr> TO <Int_Expr> STEP <Int_Expr>
    <Statements>
NEXT <Identifier>

// Examples
FOR i <- 0 TO 10
    OUTPUT i
NEXT i

FOR i <- 0 TO 10 STEP 2
    OUTPUT i
NEXT i
```
Before performing a for loop on a variable, you have to declare it first.

The start and end of the loop are inclusive, and has to be integer expressions.

#### Function/Procedure definitions
```
FUNCTION <Identifier> (<Params>) RETURNS <Type>
    <Statements>
ENDFUNCTION

PROCEDURE <Identifier> (<Params>)
    <Statements>
ENDPROCEDURE

// Param passtype is default BYVAL
FUNCTION foo (i: INTEGER) RETURNS INTEGER
    RETURN i
ENDFUNCTION

// BYREF passes an assignable basic-type variable by reference
PROCEDURE foo (BYREF i: INTEGER)
    i <- i + 1
ENDPROCEDURE

// Examples
FUNCTION foo (i: INTEGER, j: INTEGER) RETURNS INTEGER
    RETURN i + j
ENDFUNCTION

PROCEDURE foo (i: INTEGER, j: INTEGER)
    OUTPUT i + j
ENDPROCEDURE
```

#### User-defined data types
RECORDs:
```
TYPE <Identifier> 
    <Declarations>
ENDTYPE

// Examples
TYPE Point
    DECLARE x: INTEGER
    DECLARE y: INTEGER
ENDTYPE

DECLARE p: Point
p.x <- 1
p.y <- 2

OUTPUT p.x + p.y
```
POINTERs:
```
TYPE <Identifier> = ^<TYPE>

// Examples
TYPE intptr = ^INTEGER
DECLARE i: INTEGER
DECLARE a: intptr

i <- 19
a <- ^i
OUTPUT a^
```
Pointer arithmetic is not supported; dereference only a valid pointer to a
live object.

#### Case
```
CASE OF <Identifier>
    <Value>: <Statements>;
    <Value>: <Statements>;
    ...
ENDCASE
```
CASE is implemented with first-match behavior, inclusive ranges and optional
`OTHERWISE`. No semicolon is needed. STRING selectors are not yet supported.

#### Output
```
OUTPUT <Expression>

// Examples
OUTPUT 'a'
```

Currently OUTPUT supports whatever basic type.

#### Input
```
INPUT <Expression>

// Examples
INPUT i
```

Currently INPUT supports whatever basic type. 

