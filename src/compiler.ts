// TODO: get rid of the main function
import binaryen from "binaryen";

import { Scanner } from "./lex/scanner";
import { Parser } from "./syntax/parser";
import { Checker } from "./type/checker";
import { Generator } from "./codegen/generator";

export class Compiler {
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    compile(): binaryen.Module {
        const scanner = new Scanner(this.input);
        const tokens = scanner.scan();
        console.log(tokens);
        const parser = new Parser(tokens);
        const ast = parser.parse();
        console.log(ast);
        const checker = new Checker(ast);
        const typedAst = checker.check();
        console.log(typedAst);
        const generator = new Generator(typedAst);
        const module = generator.generate();
        return module;
    }

    async runtime(output: (a: number) => void): Promise<number> {
        const module = this.compile();

        // module.optimize();

        console.log(module.emitText());
        const wasm = module.emitBinary();

        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: 2, maximum: 10 });
        const maxSize = 65536 * 2 - 1;
        const importObect = {
            env: {
                buffer: memory,
                logInteger: (output: number) => {
                    console.log(output);
                },
                logReal: (output: number) => {
                    console.log(output);
                },
                logChar: (output: number) => {
                    console.log(String.fromCharCode(output));
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, output, maxSize - output);
                    let str = new TextDecoder("utf8").decode(bytes);
                    str = str.split('\0')[0];
                    console.log(str);
                }
            },
        }

        // FIXME: not updated version, test() has the newest functions
        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        const main = instance.exports.main as CallableFunction;
        const start = new Date().getTime();
        main();
        const end = new Date().getTime();
        return end - start;
    }

    // the test function
    async test(expected: number | string): Promise<Boolean> {
        let correct = false;

        const module = this.compile();

        // module.optimize();

        console.log(module.emitText());
        const wasm = module.emitBinary();

        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: 2, maximum: 10 });
        const maxSize = 65536 * 2 - 1;
        // TODO: currently import many log functions, change to only logString later
        const importObect = {
            env: {
                buffer: memory,
                logInteger: (output: number) => {
                    correct = (output == expected);
                    console.log(output);
                },
                logReal: (output: number) => {
                    correct = (output == expected);
                    console.log(output);
                },
                logChar: (output: number) => {
                    correct = (String.fromCharCode(output) == expected);
                    console.log(String.fromCharCode(output));
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, maxSize - output);
                    const str = bytes.toString();
                    console.log(str);
                }
            },
        }

        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        return correct;
    }
}
