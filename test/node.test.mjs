import assert from "node:assert/strict";
import test from "node:test";
import { Checker, Compiler, Parser, Scanner, runCode } from "../dist/pseudo2wasm.node.mjs";

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
