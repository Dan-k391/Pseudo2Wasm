import { Compiler } from "./compiler";
import type { InputProvider, OutputConsumer } from "./runtime/execution";

/** Compile and run pseudocode with host input and output callbacks. */
export async function runCode(
    code: string,
    output: OutputConsumer,
    input: InputProvider = () => {
        throw new Error("The program requested input, but no input callback was provided");
    }
): Promise<number> {
    const result = await new Compiler(code).execute([], output, input);
    return result.executionTimeMs;
}

export const keyWords = [
    "FUNCTION", "ENDFUNCTION", "PROCEDURE", "ENDPROCEDURE",
    "BYVAL", "BYREF", "RETURNS", "RETURN", "CALL", "DECLARE",
    "ARRAY", "OF", "TYPE", "ENDTYPE", "IF", "THEN", "ELSE",
    "ENDIF", "WHILE", "ENDWHILE", "REPEAT", "UNTIL", "FOR",
    "TO", "STEP", "NEXT", "CASE", "ENDCASE", "OTHERWISE",
    "DIV", "MOD", "AND", "OR", "NOT",
    "OUTPUT", "INPUT", "RND", "TIME", "TRUE", "FALSE",
    "INTEGER", "REAL", "CHAR", "STRING", "BOOLEAN",
];

export { Compiler } from "./compiler";
export type { CompilerOptions, ExecutionResult, InputProvider, OutputConsumer, OutputValue } from "./compiler";
export { getRuntimeCapabilities } from "./runtime/execution";
export { SyntaxError, RuntimeError, CompilationError, formatDiagnostic, MAX_DIAGNOSTICS } from "./error";
export type { Diagnostic, DiagnosticPhase, SourceSpan } from "./error";
export { Scanner } from "./lex/scanner";
export { Parser } from "./syntax/parser";
export { Checker } from "./type/checker";
export { Generator } from "./codegen/generator";
