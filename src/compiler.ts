// TODO: get rid of the main function
import binaryen from "binaryen";

import { Scanner } from "./scanning/scanner";
import { Parser } from "./parsing/parser";
import { Generator } from "./codegenerating/generator";

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
        const generator = new Generator(ast);
        const module = generator.generate();
        return module;
    }

    async runtime(): Promise<number> {
        const module = this.compile();

        // module.optimize();

        console.log(module.emitText());
        const wasm = module.emitBinary();

        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: 1, maximum: 2 });
        const importObect = {
            env: {
                buffer: memory,
                logNumber: (output: number) => {
                    console.log(output);
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, output);
                    const str = bytes.toString();
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

        const text = module.emitText();
        console.log(text);
        const wasm = module.emitBinary();
        console.log(wasm);

        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: 1, maximum: 2 });
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
                    const bytes = new Uint8Array(memory.buffer, output);
                    const str = bytes.toString();
                    console.log(str);
                }
            },
        }

        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        // for debug
        // debugger;
        // const main = instance.exports.main as CallableFunction;
        // main();

        return correct;
    }
}
