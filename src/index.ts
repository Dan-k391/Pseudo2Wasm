// TODO: add ts type to every statement

import { Compiler } from "./compiler";
import { Scanner } from "./scanning/scanner";
import { Parser } from "./parsing/parser";
import { Generator } from "./codegenerating/generator";

export async function runCode(
    code: string,
    output: (a: number) => void
): Promise<number> {
    const compiler = new Compiler(code);
    const time = await compiler.runtime(output);

    return time;
}

export const keyWords = [
    "FUNCTION",
    "ENDFUNCTION",
    "PROCEDURE",
    "ENDPROCEDURE",
    "BYVAL",
    "BYREF",
    "RETURNS",
    "RETURN",
    "CALL",
    "DECLARE",
    "ARRAY",
    "OF",
    "TYPE",
    "ENDTYPE",
    "IF",
    "THEN",
    "ELSE",
    "ENDIF",
    "WHILE",
    "ENDWHILE",
    "REPEAT",
    "UNTIL",
    "FOR",
    "TO",
    "STEP",
    "NEXT",
    "MOD",
    "AND",
    "OR",
    "NOT",
    "OUTPUT",
    "INPUT",
    "RND",
    "TIME",
    "TRUE",
    "FALSE",
    "INTEGER",
    "REAL",
    "CHAR",
    "STRING",
    "BOOLEAN",
];

export { Scanner };
export { Parser };
export { Generator };

