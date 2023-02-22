export class SyntaxError {
    message: string;
    line: number;
    startColumn: number;
    endColumn: number;

    constructor(message: string, line: number, startColumn: number, endColumn: number) {
        this.message = message;
        this.line = line;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
    }

    toString(): string {
        if (this.line != null && this.startColumn != null) {
            return "\x1b[31;1mSyntaxError: \x1B[0m" + this.message + " at line " + this.line.toString() + ':' + this.startColumn.toString();
        }
        return this.message;
    }
}

export class RuntimeError {
    msg: string;

    constructor(msg: string) {
        this.msg = msg;
    }

    toString(): string {
        return "\x1b[31;1mRuntimeError: \x1B[0m" + this.msg;
    }
}
