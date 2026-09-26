import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";

export function discoverMsvc() {
    if (process.platform !== "win32") throw new Error("Native comparison currently requires Windows/MSVC");
    const vswhere = path.join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
        "Microsoft Visual Studio/Installer/vswhere.exe");
    const found = spawnSync(vswhere, ["-latest", "-products", "*", "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"],
        { encoding: "utf8", windowsHide: true, timeout: 30000 });
    const installation = found.stdout?.trim();
    if (found.error || found.status !== 0 || !installation) throw new Error("Visual Studio C++ tools not found via vswhere");
    const vcvars = path.join(installation, "VC/Auxiliary/Build/vcvars64.bat");
    if (!existsSync(vcvars)) throw new Error(`Missing ${vcvars}`);
    const activated = spawnSync(process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", `"call "${vcvars}" >nul && set"`],
        { encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true, timeout: 30000 });
    if (activated.error || activated.status !== 0) throw new Error(`vcvars64 failed: ${activated.stderr}`);
    const env = {};
    for (const line of activated.stdout.split(/\r?\n/)) {
        const equal = line.indexOf("=");
        if (equal > 0) env[line.slice(0, equal)] = line.slice(equal + 1);
    }
    const compiler = path.join(env.VCToolsInstallDir, "bin/Hostx64/x64/cl.exe");
    const banner = spawnSync(compiler, [], { env, encoding: "utf8", windowsHide: true, timeout: 30000 });
    const version = `${banner.stderr || ""}\n${banner.stdout || ""}`.trim().split(/\r?\n/)[0];
    if (banner.error || !version) throw new Error("Cannot run the MSVC compiler");
    return { command: compiler, prefix: [], env, version, installation };
}

// One process per executable stays alive throughout correctness, warmup and
// rotated batches. Pipe round trips and process startup are outside native time.
export async function createNativeRunner(executable, cases, options = {}) {
    const start = performance.now();
    const child = spawn(executable, options.args || [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const lines = createInterface({ input: child.stdout });
    const queue = [];
    let pending, failure, stderr = "";
    const timeoutMs = options.timeoutMs ?? 120000;
    const rejectPending = error => {
        failure = error;
        pending?.reject(error);
        pending = undefined;
    };
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8192); });
    child.on("error", rejectPending);
    child.stdin.on("error", rejectPending);
    child.on("exit", code => rejectPending(new Error(`Native runner exited (${code}): ${stderr}`)));
    lines.on("line", line => {
        if (pending) { const waiting = pending; pending = undefined; waiting.resolve(line); }
        else queue.push(line);
    });
    function nextLine() {
        if (failure) return Promise.reject(failure);
        if (queue.length) return Promise.resolve(queue.shift());
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                rejectPending(new Error("Native runner timed out"));
                child.kill();
            }, timeoutMs);
            pending = {
                resolve: value => { clearTimeout(timer); resolve(value); },
                reject: error => { clearTimeout(timer); reject(error); },
            };
        });
    }
    async function request(command) {
        if (failure) throw failure;
        child.stdin.write(command + "\n");
        return nextLine();
    }
    const close = () => { lines.close(); child.kill(); };
    try {
        if (await nextLine() !== "ready") throw new Error("Invalid native greeting");
        const startupMs = performance.now() - start;
        if (await request(`C ${cases.length} ${cases.map(c => `${c.n} ${c.seed} ${c.expected}`).join(" ")}`) !== "ok") {
            throw new Error("Native case configuration failed");
        }
        return {
            startupMs, close,
            async invoke(testCase) {
                if (await request(`I ${testCase.n} ${testCase.seed} ${testCase.expected}`) !== "ok") {
                    throw new Error("Native invocation failed");
                }
            },
            async batch(count) {
                const result = await request(`B ${count}`);
                const ms = Number(result);
                if (!result.trim() || !Number.isFinite(ms) || ms < 0) throw new Error(`Invalid native timing: ${result}`);
                return ms;
            },
        };
    } catch (error) { close(); throw error; }
}
