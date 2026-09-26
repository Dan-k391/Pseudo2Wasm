import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { formatSource } from "../scripts/format-source.mjs";

function literals(source) {
    const values = [];
    const ast = ts.createSourceFile("fixture.ts", source, ts.ScriptTarget.Latest, true);
    const visit = node => {
        if (ts.isLiteralExpression(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            values.push(node.getText(ast));
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    return values;
}

test("formatter uses four spaces, is idempotent, and preserves literal bytes", () => {
    for (const newline of ["\n", "\r\n"]) {
        const source = ['function example(){', '  const n=2;', '  return `OUTPUT 1',
            '        OUTPUT "indentation matters"  ', '  OUTPUT ${n}`;', '}'].join(newline);
        const result = formatSource(source);
        assert.match(result, /^    const n = 2;\r?$/m);
        assert.equal(formatSource(result), result);
        assert.deepEqual(literals(result), literals(source));
    }
});

test("formatting every browser fixture preserves embedded source text", () => {
    for (const name of readdirSync("test/samples").filter(name => name.endsWith(".ts"))) {
        const source = readFileSync(path.join("test/samples", name), "utf8");
        const result = formatSource(source);
        assert.deepEqual(literals(result), literals(source), name);
        assert.equal(formatSource(result), result, name);
    }
});

test("formatter preserves personal comments", () => {
    const source = [
        "function example(){",
        "  // stupid naming, i know, plz do not blame me",
        "  /* String Lol */",
        "  return 1;",
        "}",
    ].join("\n");
    const result = formatSource(source);
    assert.match(result, /^    \/\/ stupid naming, i know, plz do not blame me$/m);
    assert.match(result, /^    \/\* String Lol \*\/$/m);
    assert.equal(formatSource(result), result);
});
