import assert from "node:assert/strict";
import test from "node:test";
import { Compiler } from "../dist/pseudo2wasm.node.mjs";
import { instantiate } from "../scripts/benchmark.mjs";

function inspect(source, action) {
    const module = new Compiler(source).compile();
    try {
        assert.equal(module.validate(), 1);
        action(module.emitText());
    } finally { module.dispose(); }
}

function callable(text, name) {
    const start = text.indexOf(` (func $${name} `);
    assert.ok(start >= 0, `Missing function ${name}`);
    const end = text.indexOf("\n (func ", start + 1);
    return text.slice(start, end < 0 ? undefined : end);
}

function execute(source, expected, input = []) {
    for (const optimization of ["none", "binaryen-o2"]) {
        const module = new Compiler(source, {optimization}).compile();
        try {
            assert.equal(module.validate(), 1);
            const runner = instantiate(module.emitBinary(), input);
            runner.instance.exports.main();
            assert.deepEqual(runner.outputs, expected, optimization);
            assert.equal(runner.calls.failures, 0);
        } finally { module.dispose(); }
    }
}

test("immutable scalar parameters use Wasm values while preserving their frame store", () => {
    const source = `FUNCTION twice(n: INTEGER) RETURNS INTEGER
RETURN n + n
ENDFUNCTION
OUTPUT twice(21)`;
    inspect(source, text => {
        const body = callable(text, "twice");
        // Incoming spill plus two reads: reads must use local 0, not stack loads.
        assert.equal((body.match(/\(local\.get \$0\)/g) ?? []).length, 3);
        assert.match(body, /i32\.store/);
        assert.match(body, /call \$failStack/);
    });
    execute(source, [42]);
});

test("parameter mutation through nested control flow is never cached", () => {
    execute(`FUNCTION change(n: INTEGER) RETURNS INTEGER
IF n > 0 THEN
    REPEAT
        n <- n - 1
    UNTIL n = 2
ENDIF
WHILE n < 4
    n <- n + 1
ENDWHILE
RETURN n
ENDFUNCTION
OUTPUT change(5)`, [4]);
});

test("INPUT and FOR induction parameters remain writable memory values", () => {
    execute(`FUNCTION read(n: INTEGER) RETURNS INTEGER
INPUT n
RETURN n
ENDFUNCTION
FUNCTION count(n: INTEGER) RETURNS INTEGER
FOR n <- 1 TO 3
NEXT n
RETURN n
ENDFUNCTION
OUTPUT read(0), count(0)`, [17, 4], [17]);
});

test("CASE reads use the value abstraction and branch writes invalidate promotion", () => {
    execute(`FUNCTION choose(n: INTEGER) RETURNS INTEGER
CASE OF n
    1: RETURN 10
    OTHERWISE: RETURN 20
ENDCASE
ENDFUNCTION
FUNCTION change(n: INTEGER) RETURNS INTEGER
CASE OF n
    1: n <- 7
ENDCASE
RETURN n
ENDFUNCTION
OUTPUT choose(1), choose(9), change(1)`, [10, 20, 7]);
});

test("BYREF disables promotion and parameter aliases observe writes", () => {
    execute(`PROCEDURE bump(BYREF x: INTEGER)
x <- x + 1
ENDPROCEDURE
FUNCTION change(n: INTEGER) RETURNS INTEGER
CALL bump(n)
RETURN n
ENDFUNCTION
OUTPUT change(9)`, [10]);
});

test("raw pointer writes to adjacent parameters disable the optimization", () => {
    execute(`PROCEDURE poke(p: ARRAY[0:1] OF INTEGER)
p[1] <- 99
ENDPROCEDURE
FUNCTION change(a: INTEGER, b: INTEGER) RETURNS INTEGER
CALL poke(^a)
RETURN b
ENDFUNCTION
OUTPUT change(1, 2)`, [99]);
});

test("mixed scalar types and sibling scopes have independent local contexts", () => {
    execute(`FUNCTION scale(n: REAL, x: INTEGER) RETURNS REAL
RETURN n * x
ENDFUNCTION
FUNCTION other(n: INTEGER) RETURNS INTEGER
n <- n + 1
RETURN n
ENDFUNCTION
PROCEDURE show(n: CHAR, yes: BOOLEAN, text: STRING)
OUTPUT n, yes, text
ENDPROCEDURE
CALL show('z', TRUE, "ok")
OUTPUT scale(1.5, 4), other(5), scale(2.5, 2)`, ["z", "TRUE", "ok", 6, 6, 5]);
});

test("recursion preserves parameters and independent caller/callee values", () => {
    execute(`FUNCTION fib(n: INTEGER) RETURNS INTEGER
IF n < 2 THEN
    RETURN n
ENDIF
RETURN fib(n - 1) + fib(n - 2)
ENDFUNCTION
OUTPUT fib(12), fib(1), fib(10)`, [144, 1, 55]);
});

test("retained parameter spills preserve current frame-reuse behavior", () => {
    // This documents an implementation detail, not a recommended source idiom.
    execute(`FUNCTION save(n: INTEGER) RETURNS INTEGER
RETURN n
ENDFUNCTION
FUNCTION read() RETURNS INTEGER
DECLARE n: INTEGER
RETURN n
ENDFUNCTION
OUTPUT save(73), read()`, [73, 73]);
});
