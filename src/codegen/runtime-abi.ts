import binaryen from "binaryen";

/** The Wasm-to-host ABI. Keep names/signatures in sync with Compiler.execute. */
export function addRuntimeImports(module: binaryen.Module): void {
    const { i32, f64, none } = binaryen;
    const imports: ReadonlyArray<readonly [string, string, readonly binaryen.Type[], binaryen.Type]> = [
        ["logInteger", "logInteger", [i32], none],
        ["logReal", "logReal", [f64], none],
        ["logChar", "logChar", [i32], none],
        ["logString", "logString", [i32], none],
        ["logBoolean", "logBoolean", [i32], none],
        ["inputInteger", "inputInteger", [], i32],
        ["inputReal", "inputReal", [], f64],
        ["inputChar", "inputChar", [], i32],
        ["inputString", "inputString", [i32, i32], i32],
        ["inputBoolean", "inputBoolean", [], i32],
        ["RAND", "randomInteger", [i32], i32],
        ["STARTTIME", "startTime", [], none],
        ["ENDTIME", "endTime", [], none],
        ["failIndex", "failIndex", [i32, i32, i32, i32, i32], none],
        ["failPointer", "failPointer", [i32, i32, i32, i32], none],
        ["failStack", "failStack", [i32, i32, i32], none],
    ];
    for (const [name, externalName, parameters, result] of imports) {
        module.addFunctionImport(name, "env", externalName, binaryen.createType([...parameters]), result);
    }
}
