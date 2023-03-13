// TODO: get rid of the main function
import binaryen from "binaryen";

import { Scanner } from "./scanning/scanner";
import { Parser } from "./parsing/parser";
import { Generator } from "./codegenerating/generator";
import { ProgramNode } from "./parsing/ast";
import { Environment } from "./semantics/environment";

export class Interpreter {
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    compile(): ProgramNode {
        const scanner = new Scanner(this.input);
        const tokens = scanner.scan();
        console.log(tokens);
        const parser = new Parser(tokens);
        const ast = parser.parse();
        return ast;
    }

    async runtime(): Promise<number> {
        const ast = this.compile();

        const env = new Environment;
        const start = new Date().getTime();
        ast.evaluate(env);
        const end = new Date().getTime();
        return end - start;
    }

    // the test function
    async test(): Promise<number> {
        const ast = this.compile();

        const env = new Environment;
        const start = new Date().getTime();
        ast.evaluate(env);
        const end = new Date().getTime();
        return end - start;
    }
}
