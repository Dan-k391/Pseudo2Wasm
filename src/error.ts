import type { Token } from "./lex/token";

export class SyntaxError extends Error {
    line: number;
    endLine: number;
    startColumn: number;
    endColumn: number;

    constructor(message: string, line: number, startColumn: number, endColumn: number, endLine: number = line) {
        super(message);
        this.name = "SyntaxError";
        this.line = line;
        this.endLine = endLine;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
    }

    toString(): string {
        return `${this.name}: ${this.message} at line ${this.line}:${this.startColumn + 1}`;
    }
}

export class RuntimeError extends Error {
    msg: string;
    line?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
    phase: "semantic" | "runtime" = "runtime";

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
        return this;
    }

    toString(): string {
        const location = this.line === undefined ? "" : ` at line ${this.line}:${this.startColumn! + 1}`;
        return `${this.name}: ${this.msg}${location}`;
    }
}
