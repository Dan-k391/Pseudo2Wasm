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

    async runtime(output: (a: any) => void, input: () => any): Promise<number> {
        const module = this.compile();

        // module.optimize();

        if (!module.validate())
            throw new Error("Module failed to validate");

        console.log(module.emitText());
        const wasm = module.emitBinary();

        // initialize import objects
        const pages = 3;
        const pageSize = 65536;
        const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
        const maxSize = pageSize * pages - 1;
        let heapOffSet = pageSize * (pages - 1);

        // add validation
        const inputInteger = () => Promise.resolve(input()!);
        const inputReal = () => Promise.resolve(input()!);
        const inputChar = () => Promise.resolve(input()!.charCodeAt(0));
        const inputString = () => new Promise<number>((resolve, reject) => {
            const str = input()!;
            const bytes = new TextEncoder().encode(str);
            // currently allocate on the heap
            // maybe allocate on a separate page later
            const ptr = heapOffSet;
            heapOffSet += bytes.length;
            const len = bytes.length;
            const view = new Uint8Array(memory.buffer, ptr, len);
            view.set(bytes);
            resolve(ptr);
        });
        const inputBoolean = () => new Promise<number>((resolve, reject) => {
            if (input()! === "TRUE") {
                resolve(1);
            }
            else {
                resolve(0);
            }
        });

        // @ts-ignore
        const suspendingInputInteger = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputInteger,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputReal = new WebAssembly.Function(
            { parameters: ["externref"], results: ["f64"] },
            inputReal,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputChar = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputChar,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputString = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputString,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputBoolean = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputBoolean,
            { suspending: "first" }
        );

        const importObect = {
            env: {
                buffer: memory,
                logInteger: (out: number) => {
                    output(out);
                },
                logReal: (out: number) => {
                    output(out);
                },
                logChar: (out: number) => {
                    output(String.fromCharCode(out));
                },
                logString: (out: number) => {
                    const bytes = new Uint8Array(memory.buffer, out, maxSize - out);
                    let str = new TextDecoder("utf8").decode(bytes);
                    str = str.split('\0')[0];
                    output(str);
                },
                logBoolean: (out: number) => {
                    output(out);
                },
                inputInteger: suspendingInputInteger,
                inputReal: suspendingInputReal,
                inputChar: suspendingInputChar,
                inputString: suspendingInputString,
                inputBoolean: suspendingInputBoolean,
            },
        }

        // FIXME: not updated version, test() has the newest functions
        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        // @ts-ignore
        const main = new WebAssembly.Function(
            { parameters: [], results: ["externref"] },
            instance.exports.main,
            { promising: "first" }
        );

        const start = new Date().getTime();
        await main();
        const end = new Date().getTime();
        return end - start;
    }
}
