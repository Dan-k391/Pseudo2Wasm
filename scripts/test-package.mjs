import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBrowserPage } from "./run-browser-tests.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(root, "dist-test", "pack-check-"));

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: "utf8",
        shell: process.platform === "win32" && command.endsWith(".cmd"),
    });
    if (result.status !== 0) {
        throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
    }
    return result.stdout;
}

try {
    // The package was built by `npm test`; avoid rebuilding during this check.
    const output = run(process.platform === "win32" ? "npm.cmd" : "npm",
        ["pack", "--json", "--ignore-scripts", "--pack-destination", temp]);
    const [packed] = JSON.parse(output);
    const files = new Set(packed.files.map(file => file.path));
    for (const file of [
        "package.json", "README.md", "node-entry.cjs", "dist/pseudo2wasm.js",
        "dist/pseudo2wasm.node.mjs", "dist/types/index.d.ts",
    ]) {
        assert.ok(files.has(file), `npm package is missing ${file}; packed: ${[...files].join(", ")}`);
    }

    const archive = path.join(temp, packed.filename);
    assert.ok(existsSync(archive), "npm pack did not create an archive");
    run("tar", ["-xzf", archive, "-C", temp]);
    const packageRoot = path.join(temp, "package");
    const nodeApi = await require(path.join(packageRoot, "node-entry.cjs"));
    assert.equal(typeof nodeApi.Compiler, "function");
    assert.equal(new nodeApi.Compiler("OUTPUT 42").compile().validate(), 1);

    const browserPage = path.join(temp, "package-browser.html");
    await writeFile(browserPage, `<!doctype html><html><body>
<script src="./package/dist/pseudo2wasm.js"></script>
<script>
(async () => {
  try {
    const api = await window.pseudo2wasm;
    if (typeof api.Compiler !== "function" ||
        !new api.Compiler("OUTPUT 42").compile().validate()) {
      throw new Error("Packed browser API could not compile a program");
    }
    document.documentElement.setAttribute("data-pseudo2wasm-tests", "passed");
  } catch (error) {
    document.documentElement.setAttribute("data-pseudo2wasm-detail", String(error));
    document.documentElement.setAttribute("data-pseudo2wasm-tests", "failed");
  }
})();
</script></body></html>`);
    await runBrowserPage(browserPage);
    console.log(`Packed npm artifact passed Node and browser entry checks (${packed.filename})`);
} finally {
    await rm(temp, { recursive: true, force: true });
}
