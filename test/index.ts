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
import { code20 } from "./samples/code20";
import { code21 } from "./samples/code21";
import { code22 } from "./samples/code22";
import { code23 } from "./samples/code23";
import { code24 } from "./samples/code24";
import { code25 } from "./samples/code25";
import { code26 } from "./samples/code26";
import { code27 } from "./samples/code27";
import { code28 } from "./samples/code28";
import { code29 } from "./samples/code29";
import { code30 } from "./samples/code30";
import { code31 } from "./samples/code31";
import { code32 } from "./samples/code32";
import { code33 } from "./samples/code33";
import { code34 } from "./samples/code34";
import { code35 } from "./samples/code35";
import { code36 } from "./samples/code36";
import { code37 } from "./samples/code37";
import { code38 } from "./samples/code38";
import { code39 } from "./samples/code39";
import { code40 } from "./samples/code40";
import { code41 } from "./samples/code41";
import { code42 } from "./samples/code42";

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
    code20,
    code21,
    code22,
    code23,
    code24,
    code25,
    code26,
    code27,
    code28,
    code29,
    code30,
    code31,
    code32,
    code33,
    code34,
    code35,
    code36,
    code37,
    code38,
    code39,
    code40,
    code41,
    code42,
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
    const filter = new URLSearchParams(window.location.search).get("only");
    const selectedTests = filter ? tests.filter(test => test.name.includes(filter)) : tests;

    for (const test of selectedTests) {
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

    const total = selectedTests.length + 1;
    console.log(`${total - failures.length}/${total} tests passed`);
    expect(failures, failures.map(failure => failure.name).join(", ")).to.be.empty;
}

runTests().then(
    () => document.documentElement.setAttribute("data-pseudo2wasm-tests", "passed"),
    error => {
        console.error("Browser test suite failed", error);
        document.documentElement.setAttribute("data-pseudo2wasm-detail", String(error));
        document.documentElement.setAttribute("data-pseudo2wasm-tests", "failed");
    }
);
