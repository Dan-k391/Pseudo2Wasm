import assert from "node:assert/strict";
import { compile, instantiate } from "./benchmark.mjs";

const cases = [
    {name: "numeric-overflow", code: "OUTPUT 2147483647 + 1, 5 / 2, 5 DIV 2"},
    {name: "short-circuit", code: `DECLARE calls: INTEGER
FUNCTION bump() RETURNS BOOLEAN
    calls <- calls + 1
    RETURN TRUE
ENDFUNCTION
OUTPUT FALSE AND bump(), TRUE OR bump(), calls`},
    {name: "index-side-effect", code: `DECLARE calls: INTEGER
DECLARE a: ARRAY[0:1] OF INTEGER
FUNCTION next() RETURNS INTEGER
    calls <- calls + 1
    RETURN 0
ENDFUNCTION
a[next()] <- 7
OUTPUT calls, a[0]`},
    {name: "multidimensional", code: `DECLARE a: ARRAY[2:3,5:6] OF INTEGER
a[3,6] <- 17
OUTPUT a[3,6]`},
    {name: "index-failure", code: `DECLARE a: ARRAY[2:3,5:6] OF INTEGER
OUTPUT a[2,7]`},
    {name: "null-pointer", code: `TYPE ip = ^INTEGER
DECLARE p: ip
OUTPUT p^`},
    {name: "recursion", code: `FUNCTION f(n: INTEGER) RETURNS INTEGER
IF n = 0 THEN
    RETURN 0
ENDIF
RETURN 1 + f(n - 1)
ENDFUNCTION
OUTPUT f(30)`},
    {name: "input-string", code: `DECLARE s: STRING
INPUT s
OUTPUT LENGTH(s), s`, input: ["ABC abc"]},
];

// A fixed-seed matrix catches optimizer mistakes at both valid and invalid
// constant array indexes while keeping failures reproducible.
let seed = 0x13579bdf;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 40; i++) {
    const value = random() % 1000;
    const index = (random() % 7) - 2;
    cases.push({name: `generated-${i}`, code: `DECLARE a: ARRAY[0:3] OF INTEGER
a[0] <- ${value}
OUTPUT a[${index}]`});
}

function run(testCase, mode) {
    const bytes = compile(testCase.code, mode);
    const runtime = instantiate(bytes, testCase.input);
    let failure;
    try {
        runtime.instance.exports.main();
    } catch (error) {
        failure = String(error);
    }
    return {outputs: runtime.outputs, calls: runtime.calls, failure};
}

for (const testCase of cases) {
    const baseline = run(testCase, "none");
    const optimized = run(testCase, "binaryen-o2");
    assert.deepEqual(optimized, baseline, `Optimization changed ${testCase.name}`);
}
console.log(`${cases.length} unoptimized/Binaryen O2 differential cases passed`);
