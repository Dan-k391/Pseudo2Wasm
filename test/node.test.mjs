import assert from "node:assert/strict";
import test from "node:test";
import { Checker, CompilationError, Compiler, Parser, Scanner, SyntaxError, runCode } from "../dist/pseudo2wasm.node.mjs";

function parse(source) {
    return new Parser(new Scanner(source).scan()).parse();
}

test("scanner preserves keyword, identifier, literal, and line positions", () => {
    const tokens = new Scanner("DECLARE x: INTEGER\nOUTPUT x + 2").scan();
    assert.deepEqual(tokens.slice(0, 4).map(token => token.lexeme),
        ["DECLARE", "x", ":", "INTEGER"]);
    assert.equal(tokens.find(token => token.lexeme === "OUTPUT").line, 2);
    assert.equal(tokens.at(-1).lexeme, "");
});

test("parser builds nested control flow and expressions", () => {
    const ast = parse(`DECLARE x: INTEGER
IF TRUE THEN
    x <- 2 + 3 * 4
ENDIF`);
    assert.equal(ast.body.length, 2);
    assert.equal(ast.body[1].constructor.name, "IfNode");
});

test("checker accepts a scoped function and attaches its global scope", () => {
    const ast = parse(`FUNCTION double(x: INTEGER) RETURNS INTEGER
    RETURN x * 2
ENDFUNCTION
OUTPUT double(3)`);
    const checked = new Checker(ast).check();
    assert.ok(checked.global);
    assert.equal(checked.body.length, 2);
});

test("checker rejects an unknown variable", () => {
    assert.throws(() => new Checker(parse("OUTPUT missing")).check(),
        error => String(error).includes("Unknown variable 'missing'"));
});

test("public compiler API emits a valid WebAssembly module without JSPI", () => {
    const module = new Compiler("OUTPUT 1 + 2").compile();
    assert.equal(module.validate(), 1);
    assert.ok(module.emitBinary().length > 0);
    assert.equal(typeof runCode, "function");
});

function expectLocatedFailure(source, fragment, line, column) {
    assert.throws(() => new Compiler(source).compile(), error => {
        assert.ok(error instanceof Error);
        assert.match(String(error), new RegExp(fragment));
        assert.equal(error.line, line);
        assert.ok(Number.isInteger(error.startColumn));
        assert.ok(error.startColumn >= 0);
        if (column !== undefined) assert.equal(error.startColumn, column - 1);
        return true;
    });
}

test("scanner and parser failures carry source locations", () => {
    expectLocatedFailure("OUTPUT 1\nOUTPUT @", "Unexpected character", 2, 8);
    expectLocatedFailure("OUTPUT 1\nIF TRUE THEN\nOUTPUT 2", "Expected 'ENDIF'", 3);
    assert.throws(() => new Compiler("OUTPUT @").compile(), error => error.name === "SyntaxError");
});

test("semantic failures identify the relevant nested token", () => {
    expectLocatedFailure("OUTPUT 1\nIF TRUE THEN\n  OUTPUT missing\nENDIF", "Unknown variable", 3, 10);
    expectLocatedFailure("OUTPUT 1\nOUTPUT \"text\" + 2", "Arithmetic requires INTEGER or REAL", 2);
    expectLocatedFailure("FUNCTION f(x: INTEGER) RETURNS INTEGER\nRETURN x\nENDFUNCTION\nOUTPUT f()", "expects 1 arguments", 4);
    expectLocatedFailure("DECLARE x: INTEGER\nDECLARE x: INTEGER", "Duplicate variable", 2);
    expectLocatedFailure("FUNCTION f(x: INTEGER, x: INTEGER) RETURNS INTEGER\nRETURN x\nENDFUNCTION", "Duplicate parameter", 1);
    expectLocatedFailure("FUNCTION f() RETURNS INTEGER\nIF TRUE THEN\nRETURN 1\nENDIF\nENDFUNCTION", "may finish without RETURN", 1);
    expectLocatedFailure("INPUT 1", "INPUT target must be assignable", 1);
    expectLocatedFailure("1 <- 2", "Assignment target must be", 1);
    expectLocatedFailure("TYPE ip = ^INTEGER\nDECLARE p: ip\nOUTPUT (p + 1)^", "Pointer arithmetic is not supported", 3);
    expectLocatedFailure(`FUNCTION f() RETURNS INTEGER
DECLARE secret: INTEGER
RETURN secret
ENDFUNCTION
OUTPUT secret`, "Unknown variable", 5);
    expectLocatedFailure(`TYPE A
DECLARE value: INTEGER
ENDTYPE
TYPE B
DECLARE value: STRING
ENDTYPE
DECLARE a: A
DECLARE b: B
a <- b`, "Cannot convert", 9);
    expectLocatedFailure(`TYPE ip = ^INTEGER
DECLARE saved: ip
PROCEDURE leak()
DECLARE local: INTEGER
saved <- ^local
ENDPROCEDURE`, "Cannot store a pointer outside", 5);
    expectLocatedFailure(`DECLARE a: ARRAY[0:1] OF INTEGER
DECLARE b: ARRAY[0:2] OF INTEGER
a <- b`, "Cannot convert", 3);
    expectLocatedFailure("RETURN 2", "RETURN is only valid inside", 1, 1);
    expectLocatedFailure('OUTPUT "a" & "b"', "String concatenation is not supported", 1);
    assert.throws(() => new Compiler("OUTPUT missing").compile(), error => error.name === "SemanticError");
});

test("invalid array declarations and index types fail before code generation", () => {
    expectLocatedFailure("DECLARE a: ARRAY[5:2] OF INTEGER", "lower bound", 1);
    expectLocatedFailure("DECLARE a: ARRAY[0:2] OF INTEGER\nOUTPUT a[TRUE]", "index must be INTEGER", 2);
});

test("oversized static data and local frames are rejected explicitly", () => {
    expectLocatedFailure("DECLARE a: ARRAY[0:300000] OF INTEGER", "Global data exceeds", 1);
    expectLocatedFailure(`FUNCTION f() RETURNS INTEGER
DECLARE a: ARRAY[0:200000] OF INTEGER
RETURN 1
ENDFUNCTION
OUTPUT f()`, "Local data exceeds", 2);
});

test("scanner collects independent errors with exact structured spans", () => {
    const compiler = new Compiler("OUTPUT @\nOUTPUT #");
    const diagnostics = compiler.diagnose();
    assert.deepEqual(diagnostics.map(d => d.code), ["E_LEX", "E_LEX"]);
    assert.deepEqual(diagnostics.map(d => d.span), [
        {line: 1, endLine: 1, startColumn: 7, endColumn: 8},
        {line: 2, endLine: 2, startColumn: 7, endColumn: 8},
    ]);
    assert.throws(() => compiler.compile(), error => {
        assert.ok(error instanceof CompilationError);
        assert.equal(error.diagnostics.length, 2);
        assert.match(String(error), /OUTPUT @\n\s*\^/);
        return true;
    });
});

test("parser recovers at statement boundaries without compiling a partial program", () => {
    const compiler = new Compiler("OUTPUT\nOUTPUT\nOUTPUT 2");
    const diagnostics = compiler.diagnose();
    assert.equal(diagnostics.length, 2);
    assert.deepEqual(diagnostics.map(d => d.phase), ["parse", "parse"]);
    assert.deepEqual(diagnostics.map(d => d.span.line), [1, 2]);
    assert.throws(() => compiler.compile(), CompilationError);
    const nested = new Compiler(`FUNCTION f() RETURNS INTEGER
OUTPUT
OUTPUT
RETURN 1
ENDFUNCTION`);
    assert.deepEqual(nested.diagnose().map(d => d.span.line), [2, 3]);
    const malformedBlock = new Compiler("IF THEN\nOUTPUT 1\nENDIF\nOUTPUT\nOUTPUT 2");
    assert.deepEqual(malformedBlock.diagnose().map(d => d.span.line), [1, 4]);
    const missingEnd = new Compiler("IF TRUE THEN\nOUTPUT 1").diagnose();
    assert.deepEqual(missingEnd[0].span, {
        line: 2, endLine: 2, startColumn: 8, endColumn: 9,
    });
});

test("checker collects independent errors and preserves single-error compatibility", () => {
    const compiler = new Compiler("OUTPUT missing\nOUTPUT absent");
    const diagnostics = compiler.diagnose();
    assert.deepEqual(diagnostics.map(d => d.message), [
        "Unknown variable 'missing'", "Unknown variable 'absent'",
    ]);
    assert.deepEqual(diagnostics.map(d => d.span.startColumn), [7, 7]);
    assert.throws(() => compiler.compile(), CompilationError);

    const single = new Compiler("OUTPUT missing");
    assert.throws(() => single.compile(), error => {
        assert.equal(error.name, "SemanticError");
        assert.match(String(error), /OUTPUT missing\n\s*\^{7}/);
        return true;
    });
    assert.throws(() => new Compiler("OUTPUT @").compile(), SyntaxError);
});

test("diagnostics are capped and failed declarations are not lowered", () => {
    const many = new Compiler(Array.from({length: 25}, (_, i) => `OUTPUT unknown${i}`).join("\n"));
    assert.equal(many.diagnose().length, 20);
    const failedDeclaration = new Compiler("DECLARE x: MISSING\nOUTPUT 1");
    assert.equal(failedDeclaration.diagnose().length, 1);
    assert.match(failedDeclaration.diagnose()[0].message, /Unknown TYPE/);
    assert.throws(() => failedDeclaration.compile());
    const dependentUse = new Compiler("DECLARE x: MISSING\nOUTPUT x\nOUTPUT independent");
    assert.deepEqual(dependentUse.diagnose().map(d => d.message), [
        "Unknown TYPE 'MISSING'", "Unknown variable 'independent'",
    ]);
    const failedCallable = new Compiler(`FUNCTION f(x: INTEGER, x: INTEGER) RETURNS INTEGER
RETURN x
ENDFUNCTION
OUTPUT f(1, 2)
OUTPUT independent`);
    assert.deepEqual(failedCallable.diagnose().map(d => d.message), [
        "Duplicate parameter 'x'", "Unknown variable 'independent'",
    ]);
});

test("CASE parsing and checking follow the guide's line-oriented branches", () => {
    const source = `DECLARE choice: INTEGER
choice <- 2
CASE OF choice
1 : OUTPUT 10
2 TO 3 : OUTPUT 20
OTHERWISE : OUTPUT 30
ENDCASE`;
    const compiler = new Compiler(source);
    assert.deepEqual(compiler.diagnose(), []);
    assert.equal(compiler.compile().validate(), 1);
    const node = parse(source).body[2];
    assert.equal(node.constructor.name, "CaseNode");
    assert.equal(node.bodies.length, 2);
    assert.equal(node.bodies[0].length, 1);
    assert.equal(node.otherwiseBody.length, 1);
});

test("CASE rejects mismatched and invalid labels before lowering", () => {
    expectLocatedFailure(`DECLARE x: INTEGER
CASE OF x
"text" : OUTPUT 1
ENDCASE`, "CASE label must be INTEGER", 3);
    expectLocatedFailure(`DECLARE x: INTEGER
CASE OF x
5 TO 2 : OUTPUT 1
ENDCASE`, "CASE range lower value exceeds", 3);
    expectLocatedFailure(`DECLARE x: INTEGER
CASE OF x
OTHERWISE : OUTPUT 1
2 : OUTPUT 2
ENDCASE`, "OTHERWISE must be the last", 4);
    expectLocatedFailure(`DECLARE x: STRING
CASE OF x
"a" : OUTPUT 1
ENDCASE`, "STRING CASE selectors are not supported", 2);
});

test("numeric and Boolean rules reject accidental cross-type operations", () => {
    expectLocatedFailure("OUTPUT TRUE + 1", "Arithmetic requires INTEGER or REAL", 1);
    expectLocatedFailure("OUTPUT NOT 1", "NOT requires a BOOLEAN", 1);
    expectLocatedFailure("IF 1 THEN\nOUTPUT 1\nENDIF", "IF condition must be BOOLEAN", 1);
    expectLocatedFailure("DECLARE x: INTEGER\nx <- 1.5", "Cannot convert", 2);
    expectLocatedFailure("OUTPUT 1 DIV 0.5", "DIV and MOD require INTEGER", 1);
    assert.equal(new Compiler("OUTPUT 5 / 2, 5 DIV 2, 2.5 > 2").compile().validate(), 1);
});

test("whole-value array and record copies validate before execution", () => {
    assert.equal(new Compiler(`DECLARE a: ARRAY[1:2] OF INTEGER
DECLARE b: ARRAY[3:4] OF INTEGER
b <- a`).compile().validate(), 1);
    assert.equal(new Compiler(`TYPE Pair
DECLARE x: INTEGER
ENDTYPE
DECLARE a: Pair
DECLARE b: Pair
b <- a`).compile().validate(), 1);
});

test("BYREF requires an assignable exact-type argument", () => {
    expectLocatedFailure(`PROCEDURE set(BYREF x: INTEGER)
x <- 1
ENDPROCEDURE
CALL set(1)`, "BYREF argument must be an assignable", 4);
    expectLocatedFailure(`DECLARE n: REAL
PROCEDURE set(BYREF x: INTEGER)
x <- 1
ENDPROCEDURE
CALL set(n)`, "BYREF argument must be an assignable", 5);
    expectLocatedFailure(`TYPE Pair
DECLARE x: INTEGER
ENDTYPE
PROCEDURE use(p: Pair)
ENDPROCEDURE`, "RECORD parameters are not supported", 4);
});

test("FOR rejects unsupported dynamic and zero steps before lowering", () => {
    expectLocatedFailure(`DECLARE i: INTEGER
FOR i <- 1 TO 3 STEP 0
OUTPUT i
NEXT i`, "FOR STEP must not be zero", 2);
    expectLocatedFailure(`DECLARE i: INTEGER
DECLARE step: INTEGER
FOR i <- 1 TO 3 STEP step
OUTPUT i
NEXT i`, "dynamic steps are not supported", 3);
});
