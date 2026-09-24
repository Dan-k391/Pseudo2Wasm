import { expect } from "chai";
import { Compiler } from "../src/compiler";

import { code0 } from "./samples/code0";
import { code1 } from "./samples/code1";
import { code2 } from "./samples/code2";
import { code3 } from "./samples/code3";
import { code4 } from "./samples/code4";
import { code5 } from "./samples/code5";
import { code6 } from "./samples/code6";
import { code7 } from "./samples/code7";
import { code8 } from "./samples/code8";
import { code9 } from "./samples/code9";
import { code10 } from "./samples/code10";
import { code11 } from "./samples/code11";
import { code12 } from "./samples/code12";
import { code13 } from "./samples/code13";
import { code14 } from "./samples/code14";
import { code15 } from "./samples/code15";
import { code16 } from "./samples/code16";
import { code17 } from "./samples/code17";
import { code18 } from "./samples/code18";
import { code19 } from "./samples/code19";

interface CompilerTestCase {
    name: string;
    code: string;
    input: ReadonlyArray<unknown>;
    expected: ReadonlyArray<unknown>;
    error: ReadonlyArray<string>;
}

const tests: Array<CompilerTestCase> = [
    code0,
    code1,
    code2,
    code3,
    code4,
    code5,
    code6,
    code7,
    code8,
    code9,
    code10,
    code11,
    code12,
    code13,
    code14,
    code15,
    code16,
    code17,
    code18,
    code19,
];

async function assertTest(test: CompilerTestCase): Promise<void> {
    const compiler = new Compiler(test.code);

    if (test.error.length > 0) {
        let thrown: unknown;
        try {
            await compiler.execute(test.input);
        }
        catch (error) {
            thrown = error;
        }

        expect(thrown, `${test.name} should fail`).not.to.equal(undefined);
        const message = String(thrown);
        for (const expectedMessage of test.error) {
            expect(message).to.contain(expectedMessage);
        }
        return;
    }

    const result = await compiler.execute(test.input);
    expect(result.outputs, `${test.name} produced unexpected output`).to.deep.equal(test.expected);
    expect(result.inputsConsumed, `${test.name} did not consume all supplied inputs`).to.equal(test.input.length);
    expect(result.executionTimeMs).to.be.at.least(0);
}

async function assertPublishedApiCompatibility(): Promise<void> {
    const legacyCompiler = new Compiler("OUTPUT 42");
    expect(await legacyCompiler.test(42), "legacy test(expected) API").to.equal(true);

    const currentCompiler = new Compiler("OUTPUT 42");
    expect(await currentCompiler.test([], [42]), "test(input, expected) API").to.equal(true);
}

async function runTests(): Promise<void> {
    const failures: Array<{name: string, error: unknown}> = [];

    for (const test of tests) {
        try {
            await assertTest(test);
            console.log(`✓ ${test.name}`);
        }
        catch (error) {
            failures.push({name: test.name, error});
            console.error(`✗ ${test.name}`, error);
        }
    }

    const compatibilityTestName = "published_api_compatibility";
    try {
        await assertPublishedApiCompatibility();
        console.log(`✓ ${compatibilityTestName}`);
    }
    catch (error) {
        failures.push({name: compatibilityTestName, error});
        console.error(`✗ ${compatibilityTestName}`, error);
    }

    const total = tests.length + 1;
    console.log(`${total - failures.length}/${total} tests passed`);
    expect(failures, failures.map(failure => failure.name).join(", ")).to.be.empty;
}

runTests();
