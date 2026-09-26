import { Compiler, runCode, getRuntimeCapabilities, RuntimeError } from "pseudo2wasm";
import type { CompilerOptions, ExecutionResult, InputProvider, OutputConsumer, OutputValue, Diagnostic } from "pseudo2wasm";

const options: CompilerOptions = { optimization: "binaryen-o2" };
const compiler = new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x + 1", options);
const diagnostics: ReadonlyArray<Diagnostic> = compiler.diagnose();
if (diagnostics.length) throw new Error("Unexpected packed diagnostics");
const bytes: Uint8Array<ArrayBuffer> = compiler.compileBinary();
if (!WebAssembly.validate(bytes)) throw new Error("Invalid packed binary");
const sync: ExecutionResult = compiler.executeSync([41]);
if (sync.outputs[0] !== 42) throw new Error("Packed sync execution failed");
const seen: OutputValue[] = [];
const output: OutputConsumer = value => seen.push(value);
const input: InputProvider = () => 41;
const asyncResult: ExecutionResult = await compiler.execute([], output, input);
if (asyncResult.outputs[0] !== 42 || seen[0] !== 42) throw new Error("Packed execution failed");
if (typeof getRuntimeCapabilities().jspi !== "boolean") throw new Error("Missing capability API");
if (!await compiler.test([41], [42])) throw new Error("Packed compatibility helper failed");
if (await runCode("OUTPUT 42", output) < 0) throw new Error("Packed runCode failed");
const module = compiler.compile();
try { if (!module.validate()) throw new Error("Invalid caller-owned module"); }
finally { module.dispose(); }
try {
    compiler.executeSync(["41junk"]);
    throw new Error("Invalid input was accepted");
} catch (error) {
    if (!(error instanceof RuntimeError) || error.code !== "E_INPUT_VALUE") throw error;
}

// These must remain compile-time errors for package consumers.
if (false) {
    // @ts-expect-error input must be a queue
    compiler.executeSync("not a queue");
    // @ts-expect-error output values can also be strings
    const number: number = sync.outputs[0];
    // @ts-expect-error unknown optimization mode
    new Compiler("OUTPUT 1", { optimization: "fastest" });
}
