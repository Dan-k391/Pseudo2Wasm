import type { Token } from "./lex/token";

export type DiagnosticPhase = "lex" | "parse" | "semantic" | "runtime";
export interface SourceSpan {
    line: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}
export interface Diagnostic {
    code: string;
    severity: "error";
    phase: DiagnosticPhase;
    message: string;
    span?: SourceSpan;
    related?: ReadonlyArray<{ message: string; span: SourceSpan }>;
}

export const MAX_DIAGNOSTICS = 20;

export function formatDiagnostic(diagnostic: Diagnostic, source?: string): string {
    const span = diagnostic.span;
    const location = span ? ` at line ${span.line}:${span.startColumn + 1}` : "";
    const header = `${diagnostic.phase === "semantic" ? "SemanticError" :
        diagnostic.phase === "runtime" ? "RuntimeError" : "SyntaxError"}: ${diagnostic.message}${location} [${diagnostic.code}]`;
    if (!span || source === undefined) return header;
    const line = source.split(/\r\n|\n|\r/)[span.line - 1];
    if (line === undefined) return header;
    const column = Math.min(line.length, Math.max(0, span.startColumn));
    const rendered = line.replace(/\t/g, "    ");
    const indent = line.slice(0, column).replace(/\t/g, "    ").length;
    const width = span.endLine === span.line
        ? Math.max(1, line.slice(column, span.endColumn).replace(/\t/g, "    ").length) : 1;
    return `${header}\n  ${rendered}\n  ${" ".repeat(indent)}${"^".repeat(width)}`;
}

export class CompilationError extends Error {
    readonly diagnostics: ReadonlyArray<Diagnostic>;
    readonly source: string;

    constructor(diagnostics: ReadonlyArray<Diagnostic>, source: string) {
        super(`${diagnostics.length} compilation errors`);
        this.name = "CompilationError";
        this.diagnostics = diagnostics;
        this.source = source;
    }

    toString(): string {
        return this.diagnostics.map(d => formatDiagnostic(d, this.source)).join("\n\n");
    }
}

export class SyntaxError extends Error {
    line: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
    code: string;
    phase: "lex" | "parse";
    source?: string;

    constructor(message: string, line: number, startColumn: number, endColumn: number,
        endLine: number = line, phase: "lex" | "parse" = "parse", code?: string) {
        super(message);
        this.name = "SyntaxError";
        this.line = line;
        this.endLine = endLine;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
        this.phase = phase;
        this.code = code || (phase === "lex" ? "E_LEX" : "E_PARSE");
    }

    toString(): string {
        return formatDiagnostic(toDiagnostic(this), this.source);
    }
}

export class RuntimeError extends Error {
    msg: string;
    line?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
    phase: "semantic" | "runtime" = "runtime";
    code = "E_RUNTIME";
    source?: string;

    constructor(msg: string) {
        super(msg);
        this.name = "RuntimeError";
        this.msg = msg;
    }

    at(token: Token, phase: "semantic" | "runtime" = "semantic"): this {
        if (this.line === undefined) {
            this.line = token.line;
            this.endLine = token.endLine;
            this.startColumn = token.startColumn;
            this.endColumn = token.endColumn;
        }
        this.phase = phase;
        this.name = phase === "semantic" ? "SemanticError" : "RuntimeError";
        this.code = phase === "semantic" ? "E_SEMANTIC" : "E_RUNTIME";
        return this;
    }

    toString(): string {
        return formatDiagnostic(toDiagnostic(this), this.source);
    }
}

export function toDiagnostic(error: SyntaxError | RuntimeError): Diagnostic {
    const span = error.line === undefined ? undefined : {
        line: error.line,
        endLine: error.endLine ?? error.line,
        startColumn: error.startColumn ?? 0,
        endColumn: error.endColumn ?? (error.startColumn ?? 0) + 1,
    };
    return {code: error.code, severity: "error", phase: error.phase,
        message: error.message, span};
}
