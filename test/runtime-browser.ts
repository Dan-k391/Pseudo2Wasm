import { expect } from "chai";
import { Compiler, getRuntimeCapabilities, RuntimeError } from "../src/index";

async function rejects(action: () => Promise<unknown>, check: (error: unknown) => void): Promise<void> {
    let failed = false;
    try { await action(); }
    catch (error) { failed = true; check(error); }
    expect(failed, "execution must reject").to.equal(true);
}

export async function assertRuntimeContract(): Promise<void> {
    expect(getRuntimeCapabilities().jspi, "This suite must exercise actual browser JSPI").to.equal(true);
    for (const optimization of ["none", "binaryen-o2"] as const) {
        const events: string[] = [];
        const compiler = new Compiler(`DECLARE x: INTEGER
OUTPUT 0
INPUT x
OUTPUT x
INPUT x
OUTPUT x`, { optimization });
        let inputs = 0;
        const result = await compiler.execute([], async value => {
            events.push(`output:${value}:start`);
            await new Promise(resolve => setTimeout(resolve, 1));
            events.push(`output:${value}:end`);
        }, async () => {
            const value = ++inputs;
            events.push(`input:${value}:start`);
            await new Promise(resolve => setTimeout(resolve, 1));
            events.push(`input:${value}:end`);
            return value;
        });
        expect(result.outputs).to.deep.equal([0, 1, 2]);
        expect(result.inputsConsumed).to.equal(2);
        expect(events).to.deep.equal([
            "output:0:start", "output:0:end", "input:1:start", "input:1:end",
            "output:1:start", "output:1:end", "input:2:start", "input:2:end",
            "output:2:start", "output:2:end",
        ]);
        expect(result.executionTimeMs).to.be.at.least(0);

        // Mixed synchronous/async returns and non-native thenables suspend only when needed.
        let count = 0;
        expect((await compiler.execute([], () => undefined, () => ++count === 1 ? 5 : Promise.resolve(6))).outputs)
            .to.deep.equal([0, 5, 6]);
        expect((await new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x", { optimization }).execute([], undefined,
            () => ({ then(resolve: (value: number) => void) { resolve(7); } }))).outputs).to.deep.equal([7]);

        for (const [type, value, expected] of [
            ["INTEGER", "42", 42], ["REAL", "2.5", 2.5], ["CHAR", "é", "é"],
            ["STRING", "😀", "😀"], ["BOOLEAN", "FALSE", "FALSE"],
        ] as const) {
            const typed = new Compiler(`DECLARE x: ${type}\nINPUT x\nOUTPUT x`, { optimization });
            expect((await typed.execute([], undefined, async () => value)).outputs).to.deep.equal([expected]);
            await rejects(() => typed.execute([], undefined, async () => null), error => {
                expect(error).to.be.instanceOf(RuntimeError);
                expect((error as RuntimeError).code).to.equal("E_INPUT_VALUE");
                expect((error as RuntimeError).line).to.equal(2);
            });
        }

        const marker = { reason: "original host rejection" };
        const inputCompiler = new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x", { optimization });
        await rejects(() => inputCompiler.execute([], undefined, async () => { throw marker; }), error => expect(error).to.equal(marker));
        await rejects(() => inputCompiler.execute([], undefined, () => { throw marker; }), error => expect(error).to.equal(marker));
        const seen: unknown[] = [];
        await rejects(() => compiler.execute([], async value => { seen.push(value); throw marker; }, () => {
            throw new Error("INPUT after rejected OUTPUT must not execute");
        }), error => expect(error).to.equal(marker));
        expect(seen).to.deep.equal([0]);
        await rejects(() => new Compiler("DECLARE a: ARRAY[1:1] OF INTEGER\nDECLARE x: INTEGER\nINPUT x\nOUTPUT a[x]",
            { optimization }).execute([], undefined, async () => 2), error => {
                expect(error).to.be.instanceOf(RuntimeError);
                expect(String(error)).to.contain("Array index 2 outside [1:1]");
                expect((error as RuntimeError).line).to.equal(4);
            });

        const text = new Compiler("DECLARE s: STRING\nINPUT s\nOUTPUT s", { optimization });
        let release: (value: string) => void = () => { throw new Error("First input never started"); };
        const first = text.execute([], undefined, () => new Promise<string>(resolve => { release = resolve; }));
        const second = text.execute([], undefined, async () => "second");
        expect((await second).outputs).to.deep.equal(["second"]);
        release("first");
        expect((await first).outputs).to.deep.equal(["first"]);
        expect(text.executeSync(["third"]).outputs).to.deep.equal(["third"]);
        expect(() => inputCompiler.executeSync([], undefined, async () => 1)).to.throw("executeSync()");

        // Emulate a runtime without JSPI inside the same real browser engine.
        const names = ["Suspending", "promising"] as const;
        const saved = names.map(name => Object.getOwnPropertyDescriptor(WebAssembly, name)!);
        try {
            names.forEach(name => Object.defineProperty(WebAssembly, name, { value: undefined, configurable: true }));
            expect(getRuntimeCapabilities().jspi).to.equal(false);
            expect(text.executeSync(["without JSPI"]).outputs).to.deep.equal(["without JSPI"]);
            expect((await inputCompiler.execute([], undefined, () => 8)).outputs).to.deep.equal([8]);
            await rejects(() => inputCompiler.execute([], undefined, async () => 1), error =>
                expect((error as RuntimeError).code).to.equal("E_JSPI_UNAVAILABLE"));
        } finally {
            names.forEach((name, index) => Object.defineProperty(WebAssembly, name, saved[index]));
        }
    }
}
