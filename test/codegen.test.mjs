import assert from "node:assert/strict";
import test from "node:test";
import { Compiler, Scanner, Parser, Checker, Generator } from "../dist/pseudo2wasm.node.mjs";
import { instantiate } from "../scripts/benchmark.mjs";

function inspect(source, action) {
    const module = new Compiler(source).compile();
    try {
        assert.equal(module.validate(), 1);
        action(module.emitText());
    } finally { module.dispose(); }
}

function callable(text, name) {
    const start = text.search(new RegExp(` \\(func \\$${name}(?:\\s|\\))`));
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

test("scalar-only callables omit memory frames but preserve logical stack checks", () => {
    const source = `FUNCTION twice(n: INTEGER) RETURNS INTEGER
RETURN n + n
ENDFUNCTION
OUTPUT twice(21)`;
    inspect(source, text => {
        const body = callable(text, "twice");
        assert.equal((body.match(/\(local\.get \$0\)/g) ?? []).length, 2);
        assert.doesNotMatch(body, /i32\.(store|load)|__stackBase/);
        assert.match(body, /i32.const 8/); // original saved-base + INTEGER parameter
        assert.match(body, /call \$failStack/);
    });
    execute(source, [42]);
});

test("promoted parameter mutations stay visible through nested control flow", () => {
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

test("INPUT and FOR induction parameters remain writable promoted values", () => {
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

test("CASE reads and branch writes use the same value abstraction", () => {
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

test("BYREF pins the target symbol and aliases observe writes", () => {
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

test("must-analysis promotes branch joins, REPEAT, INPUT and early-return continuations", () => {
    const source = `FUNCTION choose(n: INTEGER) RETURNS REAL
DECLARE x: REAL
IF n < 0 THEN
    RETURN 7.5
ELSE
    x <- 2.5
ENDIF
REPEAT
    x <- x + 1.0
UNTIL x >= 4.0
RETURN x
ENDFUNCTION
OUTPUT choose(1), choose(-1)`;
    inspect(source, text => assert.doesNotMatch(callable(text, "choose"), /\.(load|store)/));
    execute(source, [4.5, 7.5]);
});

test("CASE joins require OTHERWISE or an already assigned value", () => {
    const source = `FUNCTION choose(n: INTEGER) RETURNS INTEGER
DECLARE x: INTEGER
CASE OF n
    1: x <- 11
    OTHERWISE: x <- 22
ENDCASE
RETURN x
ENDFUNCTION
OUTPUT choose(1), choose(0)`;
    inspect(source, text => assert.doesNotMatch(callable(text, "choose"), /\.(load|store)/));
    execute(source, [11, 22]);
});

test("partial branches and zero-trip loops retain legacy uninitialized reads", () => {
    for (const statement of ["IF flag THEN\nx <- 5\nENDIF", "WHILE flag\nx <- 5\nflag <- FALSE\nENDWHILE",
        "CASE OF flag\nTRUE: x <- 5\nENDCASE"]) {
        const source = `FUNCTION read(flag: BOOLEAN) RETURNS INTEGER
DECLARE x: INTEGER
${statement}
RETURN x
ENDFUNCTION
OUTPUT read(TRUE), read(FALSE)`;
        inspect(source, text => assert.match(callable(text, "read"), /i32.load/));
        execute(source, [5, 5]);
    }
});

test("a use-before-write is not promoted even if later assignments exist", () => {
    execute(`FUNCTION accumulate() RETURNS INTEGER
DECLARE x: INTEGER
x <- x + 1
RETURN x
ENDFUNCTION
OUTPUT accumulate(), accumulate(), accumulate()`, [1, 2, 3]);
});

test("BYREF forwarding pins only actual arguments; unrelated scalars stay local", () => {
    const source = `PROCEDURE bump(BYREF x: INTEGER)
x <- x + 1
ENDPROCEDURE
PROCEDURE forward(BYREF x: INTEGER)
CALL bump(x)
ENDPROCEDURE
FUNCTION change(n: INTEGER) RETURNS INTEGER
DECLARE stable: INTEGER
stable <- 100
CALL forward(n)
RETURN n + stable
ENDFUNCTION
FUNCTION pure(n: INTEGER) RETURNS INTEGER
RETURN n + 2
ENDFUNCTION
OUTPUT change(9), pure(8)`;
    inspect(source, text => {
        const body = callable(text, "pure");
        assert.doesNotMatch(body, /\.(load|store)|__stackBase/);
        assert.match(callable(text, "change"), /local.set/);
    });
    execute(source, [110, 10]);
});

test("call effects propagate raw alias writes through intermediate calls", () => {
    execute(`PROCEDURE poke(p: ARRAY[0:1] OF INTEGER)
p[1] <- 99
ENDPROCEDURE
PROCEDURE forward(p: ARRAY[0:1] OF INTEGER)
CALL poke(p)
ENDPROCEDURE
FUNCTION change(a: INTEGER, b: INTEGER) RETURNS INTEGER
CALL forward(^a)
RETURN b
ENDFUNCTION
OUTPUT change(1, 2)`, [99]);
});

test("a pure callee still spills when a raw caller can observe reused child slots", () => {
    const source = `FUNCTION pure(n: INTEGER) RETURNS INTEGER
n <- n + 1
RETURN n
ENDFUNCTION
PROCEDURE outer(p: ARRAY[0:262146] OF INTEGER)
OUTPUT pure(72), p[262146]
ENDPROCEDURE
DECLARE a: INTEGER
CALL outer(^a)`;
    // a is at byte 4; the child parameter occupies byte 1048588.
    // The unsafe array-view contract permits observing that old child slot.
    inspect(source, text => {
        const body = callable(text, "pure");
        assert.equal((body.match(/i32.store/g) ?? []).length, 3); // saved-base + init + assignment
        assert.match(body, /local.tee/);
    });
    execute(source, [73, 73]);
});

test("a raw BYREF argument may alias a future callee parameter slot", () => {
    execute(`PROCEDURE alias(BYREF x: INTEGER, y: INTEGER)
x <- 99
OUTPUT y
ENDPROCEDURE
PROCEDURE outer(p: ARRAY[0:262146] OF INTEGER)
CALL alias(p[262146], 2)
ENDPROCEDURE
DECLARE a: INTEGER
CALL outer(^a)`, [99]);
});

test("unreachable uninitialized reads do not block otherwise safe promotion", () => {
    const source = `FUNCTION f(n: INTEGER) RETURNS INTEGER
DECLARE unused: INTEGER
RETURN n
OUTPUT unused
ENDFUNCTION
OUTPUT f(3)`;
    inspect(source, text => assert.doesNotMatch(callable(text, "f"), /\.(load|store)/));
    execute(source, [3]);
});

test("constant monotone loop indexes eliminate checks in both directions", () => {
    for (const [start, end, step] of [[0, 3, 1], [3, 0, -1]]) {
        const source = `DECLARE a: ARRAY[0:3] OF INTEGER
DECLARE i: INTEGER
FOR i <- ${start} TO ${end} STEP ${step}
a[i] <- i * 2
NEXT i
OUTPUT a[0], a[3]`;
        inspect(source, text => assert.doesNotMatch(text, /call \$failIndex/));
        execute(source, [0, 6]);
    }
});

test("nested non-unit loop ranges remove only independently proven dimensions", () => {
    const source = `DECLARE a: ARRAY[0:4,0:4] OF INTEGER
DECLARE i: INTEGER
DECLARE j: INTEGER
FOR i <- 0 TO 4 STEP 2
FOR j <- 4 TO 0 STEP -2
a[i,j] <- i + j
NEXT j
NEXT i
OUTPUT a[0,4], a[4,0]`;
    inspect(source, text => {
        assert.doesNotMatch(text, /call \$failIndex/);
    });
    execute(source, [4, 4]);
});

test("nested induction writes invalidate the outer loop proof", () => {
    const source = `DECLARE a: ARRAY[0:3] OF INTEGER
DECLARE i: INTEGER
FOR i <- 0 TO 3
FOR i <- 3 TO 3
NEXT i
OUTPUT a[i]
NEXT i`;
    inspect(source, text => assert.match(text, /call \$failIndex/));
    for (const optimization of ["none", "binaryen-o2"]) {
        const module = new Compiler(source, {optimization}).compile();
        try {
            assert.throws(() => instantiate(module.emitBinary()).instance.exports.main(), /index:\[4,0,3,6,9\]/);
        } finally { module.dispose(); }
    }
});

test("loop proofs keep checks for mutation, calls, dynamic bounds, and overflow", () => {
    const sources = [
        `FOR i <- 0 TO 3\ni <- 4\nOUTPUT a[i]\nNEXT i`,
        `FOR i <- 0 TO limit\nOUTPUT a[i]\nNEXT i`,
        `FOR i <- 0 TO 3\nOUTPUT identity(i), a[i]\nNEXT i`,
        `FOR i <- 2147483646 TO 2147483647\nOUTPUT a[i]\nNEXT i`,
    ];
    for (const loop of sources) inspect(`FUNCTION identity(n: INTEGER) RETURNS INTEGER
RETURN n
ENDFUNCTION
DECLARE a: ARRAY[0:3] OF INTEGER
DECLARE i: INTEGER
DECLARE limit: INTEGER
limit <- 3
${loop}`, text => assert.match(text, /call \$failIndex/));
});

test("BYREF aliases cannot invalidate a loop proof", () => {
    const source = `PROCEDURE fill(BYREF i: INTEGER, BYREF alias: INTEGER)
DECLARE a: ARRAY[0:3] OF INTEGER
FOR i <- 0 TO 3
alias <- 4
OUTPUT a[i]
NEXT i
ENDPROCEDURE
DECLARE n: INTEGER
CALL fill(n, n)`;
    inspect(source, text => assert.match(text, /call \$failIndex/));
    for (const optimization of ["none", "binaryen-o2"]) {
        const module = new Compiler(source, {optimization}).compile();
        try {
            const runner = instantiate(module.emitBinary());
            assert.throws(() => runner.instance.exports.main(), /index:\[4,0,3,5,9\]/);
        } finally { module.dispose(); }
    }
});

test("backend storage never leaks Binaryen references into semantic symbols", () => {
    const ast = new Parser(new Scanner(`FUNCTION f(n: INTEGER) RETURNS INTEGER
DECLARE x: INTEGER
x <- n + 1
RETURN x
ENDFUNCTION
OUTPUT f(8)`).scan()).parse();
    new Checker(ast).check();
    const symbols = [...ast.global.elems.values(), ...ast.global.children.flatMap(scope => [...scope.elems.values()])];
    const first = new Generator(ast).generate();
    const second = new Generator(ast).generate();
    try {
        assert.equal(first.validate(), 1);
        assert.equal(second.validate(), 1);
        assert.deepEqual(first.emitBinary(), second.emitBinary());
        for (const symbol of symbols) assert.equal(symbol.pointer, undefined);
    } finally { first.dispose(); second.dispose(); }
});

test("mutable local arithmetic matches a JavaScript reference across generated inputs", () => {
    const source = `FUNCTION sum(n: INTEGER) RETURNS INTEGER
DECLARE i: INTEGER
DECLARE total: INTEGER
total <- 7
FOR i <- 1 TO n
IF i MOD 2 = 0 THEN
total <- total + i * 3
ELSE
total <- total - i
ENDIF
NEXT i
RETURN total
ENDFUNCTION
${Array.from({length: 35}, (_, n) => `OUTPUT sum(${n - 3})`).join("\n")}`;
    const expected = Array.from({length: 35}, (_, n) => {
        let total = 7;
        for (let i = 1; i <= n - 3; i++) total += i % 2 === 0 ? i * 3 : -i;
        return total;
    });
    execute(source, expected);
});

test("frameless recursion retains exact logical stack capacity and source location", () => {
    // 1023 INTEGER slots + the logical saved-base word = 4096 bytes/call.
    const declarations = Array.from({length: 1022}, (_, i) => `DECLARE unused${i}: INTEGER`).join("\n");
    const source = `FUNCTION deep(n: INTEGER) RETURNS INTEGER
${declarations}
IF n = 0 THEN
RETURN 0
ENDIF
RETURN 1 + deep(n - 1)
ENDFUNCTION
OUTPUT deep(127)
OUTPUT deep(128)`;
    inspect(source, text => assert.doesNotMatch(callable(text, "deep"), /\.(load|store)|__stackBase/));
    for (const optimization of ["none", "binaryen-o2"]) {
        const module = new Compiler(source, {optimization}).compile();
        try {
            const runner = instantiate(module.emitBinary());
            assert.throws(() => runner.instance.exports.main(), /stack:\[1576960,1,10\]/);
            assert.deepEqual(runner.outputs, [127]);
            assert.equal(runner.calls.failures, 1);
        } finally { module.dispose(); }
    }
});

test("simple entry points allocate no unused scratch locals", () => {
    inspect("OUTPUT 42", text => assert.doesNotMatch(callable(text, "__main"), /\(local /));
});

test("all early returns converge on one epilogue after evaluating their values", () => {
    const source = `DECLARE calls: INTEGER
FUNCTION side(n: INTEGER) RETURNS INTEGER
calls <- calls + 1
RETURN n * 10
ENDFUNCTION
FUNCTION choose(n: INTEGER) RETURNS INTEGER
IF n < 0 THEN
RETURN side(1)
ENDIF
IF n = 0 THEN
RETURN side(2)
ENDIF
RETURN side(3)
ENDFUNCTION
OUTPUT choose(-1), choose(0), choose(1), calls`;
    inspect(source, text => {
        const body = callable(text, "choose");
        assert.equal((body.match(/global.set \$__stackTop/g) ?? []).length, 2);
        assert.equal((body.match(/br \$__return/g) ?? []).length, 3);
    });
    execute(source, [10, 20, 30, 3]);
});

test("recursive REAL CASE selectors are local and independent across calls", () => {
    const source = `FUNCTION choose(n: REAL) RETURNS REAL
CASE OF n
0.0: RETURN 0.5
1.0: RETURN 1.5
OTHERWISE: RETURN choose(n - 1.0) + 1.0
ENDCASE
ENDFUNCTION
OUTPUT choose(3.0), choose(0.0), choose(2.0)`;
    inspect(source, text => {
        assert.doesNotMatch(text, /__caseI32|__caseF64/);
        assert.match(callable(text, "choose"), /local.set/);
    });
    execute(source, [3.5, 0.5, 2.5]);
});

test("unsigned index checks match inclusive bounds across extreme i32 values", () => {
    for (const [lower, upper] of [[0, 2], [7, 9], [2147483646, 2147483647]]) {
        const source = `DECLARE a: ARRAY[${lower}:${upper}] OF INTEGER
DECLARE i: INTEGER
a[${lower}] <- 11
a[${upper}] <- 22
INPUT i
OUTPUT a[i]`;
        inspect(source, text => {
            assert.equal((text.match(/i32.gt_u/g) ?? []).length, 1);
            assert.doesNotMatch(text, /i32.lt_s|i32.gt_s|i32.or/);
        });
        for (const optimization of ["none", "binaryen-o2"]) {
            const module = new Compiler(source, {optimization}).compile();
            try {
                const memory = new WebAssembly.Memory({initial: 30, maximum: 30});
                let index = 0;
                const outputs = [];
                const instance = new WebAssembly.Instance(new WebAssembly.Module(module.emitBinary()), {env: {
                    buffer: memory, inputInteger: () => index, logInteger: value => outputs.push(value),
                    failIndex: (...args) => { throw new Error(JSON.stringify(args)); },
                }});
                let random = 12345;
                const values = [lower, upper, lower - 1, (upper + 1) | 0, 0, -1, -2147483648, 2147483647];
                for (let sample = 0; sample < 64; sample++) {
                    random = (Math.imul(random, 1664525) + 1013904223) | 0;
                    values.push(random);
                }
                for (index of values) {
                    outputs.length = 0;
                    if (index >= lower && index <= upper) {
                        instance.exports.main();
                        assert.deepEqual(outputs, [index === lower ? 11 : index === upper ? 22 : 0]);
                    } else {
                        assert.throws(() => instance.exports.main(), error => {
                            assert.deepEqual(JSON.parse(error.message), [index, lower, upper, 6, 9]);
                            return true;
                        });
                        assert.deepEqual(outputs, []);
                    }
                }
            } finally { module.dispose(); }
        }
    }
});

test("unsigned pointer checks keep null, signed patterns, and exact endpoints correct", () => {
    for (const [type, size] of [["INTEGER", 4], ["REAL", 8]]) {
        const source = `TYPE pointer = ^${type}
DECLARE p: pointer
OUTPUT p^`;
        for (const optimization of ["none", "binaryen-o2"]) {
            const module = new Compiler(source, {optimization}).compile();
            try {
                const memory = new WebAssembly.Memory({initial: 30, maximum: 30});
                const bytes = new DataView(memory.buffer);
                const outputs = [];
                const instance = new WebAssembly.Instance(new WebAssembly.Module(module.emitBinary()), {env: {
                    buffer: memory, logInteger: value => outputs.push(value), logReal: value => outputs.push(value),
                    failPointer: (...args) => { throw new Error(JSON.stringify(args)); },
                }});
                const end = memory.buffer.byteLength;
                for (const pointer of [0, 1, 3, 8, end - size, end - size + 1, end, -1, -2147483648, 2147483647]) {
                    outputs.length = 0;
                    bytes.setInt32(4, pointer, true);
                    if (pointer >= 4 && pointer <= end - size) {
                        if (size === 4) bytes.setInt32(pointer, 37, true);
                        else bytes.setFloat64(pointer, 37, true);
                        instance.exports.main();
                        assert.deepEqual(outputs, [37]);
                    } else {
                        assert.throws(() => instance.exports.main(), error => {
                            assert.deepEqual(JSON.parse(error.message).slice(0, 3), [pointer, size, 3]);
                            return true;
                        });
                    }
                }
            } finally { module.dispose(); }
        }
    }
});

test("checked side-effecting indexes are evaluated exactly once", () => {
    execute(`DECLARE calls: INTEGER
DECLARE a: ARRAY[1:2] OF INTEGER
FUNCTION index() RETURNS INTEGER
calls <- calls + 1
RETURN 2
ENDFUNCTION
a[index()] <- 42
OUTPUT a[2], calls`, [42, 1]);
});

test("pointer-view destinations count their base pointer as a read during analysis", () => {
    const ast = new Parser(new Scanner(`TYPE ip = ^INTEGER
PROCEDURE store()
DECLARE p: ip
p[0] <- 1
ENDPROCEDURE
CALL store()`).scan()).parse();
    new Checker(ast).check();
    const procedure = ast.body.find(node => node.ident?.lexeme === "store");
    const generator = new Generator(ast);
    const module = generator.generate();
    try {
        // Inspect this internal analysis contract without making it a package API.
        assert.ok(generator.valuePlans.get(procedure).uninitialized.has(procedure.local.lookUp("p")));
        assert.equal(module.validate(), 1);
    } finally { module.dispose(); }
});

test("scope lookup keeps namespaces, lexical shadowing, and legacy metadata distinct", () => {
    const ast = new Parser(new Scanner(`DECLARE x: INTEGER
FUNCTION f() RETURNS INTEGER
RETURN x
ENDFUNCTION`).scan()).parse();
    new Checker(ast).check();
    const Scope = ast.global.constructor;
    const rootSymbol = ast.global.lookUp("x");
    const siblingAst = new Parser(new Scanner("DECLARE x: REAL").scan()).parse();
    new Checker(siblingAst).check();
    const innerSymbol = siblingAst.global.lookUp("x");
    const child = new Scope(true, ast.global, rootSymbol.type, 0);
    child.insert("x", innerSymbol);
    assert.equal(child.lookUp("x"), innerSymbol);
    assert.equal(ast.global.lookUp("x"), rootSymbol);
    assert.equal(child.lookUpFunc("f"), ast.global.lookUpFunc("f"));
    assert.equal(child.returnIndex, 0);
    child.setPointer("x", 123);
    assert.equal(innerSymbol.pointer, 123);
    assert.equal(rootSymbol.pointer, undefined);
    assert.throws(() => child.lookUpProc("f"), /Unknown PROCEDURE 'f'/);
    assert.throws(() => child.lookUpType("x"), /Unknown TYPE 'x'/);
    let deep = child;
    for (let i = 0; i < 12000; i++) deep = new Scope(false, deep);
    assert.equal(deep.lookUp("x"), innerSymbol);
    assert.throws(() => deep.lookUp("absent"), /Unknown variable 'absent'/);
});
