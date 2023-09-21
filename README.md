# OAC

#### 介绍
OAC (Oh a compiler)
灵感来源于zjj

###
Pseudo2Wasm,
is an improvement to OAC(Web version),
adds an IR generation layer implemented with binaryen.
still in progress

### How it works
This compiler, compiles CAIE PseudoCode into WebAssembly.
It uses the following process.
1. Lexical Analysis
2. Syntax Analysis
3. Semantic Analysis(Type Check) and IR Generation(with binaryen)
4. Code Generation
5. Optimization
6. Runtime

Notice that the Semantic Analysis and IR Generation are done at the same time.
