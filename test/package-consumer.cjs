const assert = require("node:assert/strict");

(async () => {
    const apiPromise = require("pseudo2wasm");
    assert.equal(typeof apiPromise.then, "function", "legacy CJS entry remains awaitable");
    const { Compiler, getRuntimeCapabilities } = await apiPromise;
    const compiler = new Compiler("DECLARE x: INTEGER\nINPUT x\nOUTPUT x + 1");
    assert.deepEqual(compiler.executeSync([41]).outputs, [42]);
    assert.deepEqual((await compiler.execute([], undefined, () => 41)).outputs, [42]);
    assert.equal(typeof getRuntimeCapabilities().jspi, "boolean");
    assert.equal(await new Compiler("OUTPUT 42").test(42), true);
})().catch(error => { console.error(error); process.exitCode = 1; });
