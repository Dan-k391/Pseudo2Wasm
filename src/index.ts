// TODO: add ts type to every statement

import { Compiler } from "./compiler";
import { Scanner } from "./lex/scanner";
import { Parser } from "./syntax/parser";
import { Checker } from "./type/checker";
import { Generator } from "./codegen/generator";

export async function runCode(
    code: string,
    output: (a: number) => void,
    input: () => number
): Promise<number> {
    const compiler = new Compiler(code);
    const time = await compiler.runtime(output, input);

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
export { Checker };
export { Generator };

// const time = runCode(`DECLARE i: INTEGER
// INPUT i
// OUTPUT i`,
// console.log,
// // @ts-ignore
// prompt).then((time) => console.log(time));
