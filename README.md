# OAC

#### 介绍
OAC (Oh a compiler)
灵感来源于zjj

###
Pseudo2Wasm,
is an improvement to OAC(Web version),
adds an IR generation layer implemented with binaryen.
still in progress

### Usage

```js
import * as promise from "pseudo2wasm";

let pseudo2wasm;
promise.then((foo) => pseudo2wasm = foo);

pseudo2wasm.runCode(`OUTPUT 1`, console.log)

```
