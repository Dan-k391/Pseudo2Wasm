import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Syntax-aware whitespace formatting using the project's locked TypeScript. */
function formatOnce(source, fileName) {
    if (!source.trim()) return "";
    const snapshot = ts.ScriptSnapshot.fromString(source);
    const host = {
        getScriptFileNames: () => [fileName],
        getScriptVersion: () => "0",
        getScriptSnapshot: name => name === fileName ? snapshot : undefined,
        getCurrentDirectory: () => ".",
        getCompilationSettings: () => ({ target: ts.ScriptTarget.ESNext }),
        getDefaultLibFileName: () => "lib.d.ts",
        fileExists: name => name === fileName,
        readFile: name => name === fileName ? source : undefined,
    };
    const service = ts.createLanguageService(host);
    const newLineCharacter = source.includes("\r\n") ? "\r\n" : "\n";
    try {
        const edits = service.getFormattingEditsForDocument(fileName, {
            indentSize: 4,
            tabSize: 4,
            convertTabsToSpaces: true,
            newLineCharacter,
            indentStyle: ts.IndentStyle.Smart,
            insertSpaceAfterCommaDelimiter: true,
            insertSpaceAfterSemicolonInForStatements: true,
            insertSpaceBeforeAndAfterBinaryOperators: true,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
            placeOpenBraceOnNewLineForFunctions: false,
            placeOpenBraceOnNewLineForControlBlocks: false,
        });
        let result = source;
        for (const edit of edits.sort((a, b) => b.span.start - a.span.start)) {
            result = result.slice(0, edit.span.start) + edit.newText + result.slice(edit.span.start + edit.span.length);
        }
        const literals = [];
        const ast = ts.createSourceFile(fileName, result, ts.ScriptTarget.Latest, true);
        const visit = node => {
            if (ts.isLiteralExpression(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
                literals.push([node.getStart(ast), node.end]);
            }
            ts.forEachChild(node, visit);
        };
        visit(ast);
        result = result.replace(/[ \t]+(?=\r?$)/gm, (whitespace, offset) =>
            literals.some(([start, end]) => offset >= start && offset < end) ? whitespace : "");
        return result.trimEnd() + newLineCharacter;
    } finally {
        service.dispose();
    }
}

export function formatSource(source, fileName = "source.ts") {
    // TypeScript may realign a multiline construct after its enclosing whitespace
    // changed. Reach a fixed point so one format run always satisfies --check.
    for (let pass = 0; pass < 5; pass++) {
        const result = formatOnce(source, fileName);
        if (result === source) return result;
        source = result;
    }
    throw new Error(`Formatting did not converge: ${fileName}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL("../", import.meta.url));
    const check = process.argv.includes("--check");
    let changed = 0;
    for (const directory of ["src", "test"]) {
        for (const file of readdirSync(path.join(root, directory), { recursive: true }).filter(file => file.endsWith(".ts")).sort()) {
            const fileName = path.join(root, directory, file);
            const source = readFileSync(fileName, "utf8");
            const formatted = formatSource(source, fileName);
            if (source === formatted) continue;
            changed++;
            if (check) console.error(`Needs formatting: ${path.relative(root, fileName)}`);
            else writeFileSync(fileName, formatted);
        }
    }
    console.log(check ? `${changed} TypeScript files need formatting` : `Formatted ${changed} TypeScript files`);
    if (check && changed) process.exitCode = 1;
}
