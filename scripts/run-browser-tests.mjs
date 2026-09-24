import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = path.join(root, "dist-test", "index.html");

function browserExecutable() {
    if (process.env.PSEUDO2WASM_BROWSER) return process.env.PSEUDO2WASM_BROWSER;
    const candidates = process.platform === "win32"
        ? [
            path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
            path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
            path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
        ]
        : process.platform === "darwin"
            ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
            : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge"];
    return candidates.find(existsSync);
}

export async function runBrowserPage(htmlPath) {
    const browser = browserExecutable();
    if (!browser) throw new Error("No Chrome or Edge found; set PSEUDO2WASM_BROWSER to its executable path");
    const profile = await mkdtemp(path.join(tmpdir(), "pseudo2wasm-browser-"));
    const directory = path.dirname(htmlPath);
    const server = createServer(async (request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        const file = path.resolve(directory, `.${pathname}`);
        if (!file.startsWith(directory + path.sep)) {
            response.writeHead(403).end();
            return;
        }
        try {
            const contents = await readFile(file);
            response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : "text/html");
            response.end(contents);
        } catch {
            response.writeHead(404).end();
        }
    });
    let child;
    let socket;
    let stderr = "";
    try {
        await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
        const address = server.address();
        const url = `http://127.0.0.1:${address.port}/${path.basename(htmlPath)}`;
        const args = [
            "--headless", "--disable-gpu", "--disable-extensions", "--no-first-run",
            "--no-default-browser-check", `--user-data-dir=${profile}`,
            "--remote-debugging-port=0", "about:blank",
        ];
        child = spawn(browser, args, { windowsHide: true });
        child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-4000); });
        child.stdout.resume();
        const portFile = path.join(profile, "DevToolsActivePort");
        const deadline = Date.now() + 90000;
        let port;
        while (Date.now() < deadline) {
            try {
                port = Number((await readFile(portFile, "utf8")).split("\n")[0]);
                if (port) break;
            } catch { /* Edge has not started yet. */ }
            if (child.exitCode !== null) throw new Error(`Browser exited before startup: ${stderr}`);
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (!port) throw new Error(`Browser debugging port did not open: ${stderr}`);
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        const target = targets.find(item => item.type === "page");
        if (!target) throw new Error("Browser did not create a page target");
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            socket.addEventListener("open", resolve, { once: true });
            socket.addEventListener("error", reject, { once: true });
        });
        let nextId = 0;
        const pending = new Map();
        const browserErrors = [];
        socket.addEventListener("message", event => {
            const message = JSON.parse(event.data);
            if (message.id && pending.has(message.id)) {
                const { resolve, reject } = pending.get(message.id);
                pending.delete(message.id);
                message.error ? reject(new Error(message.error.message)) : resolve(message.result);
            } else if (message.method === "Runtime.exceptionThrown") {
                browserErrors.push(message.params.exceptionDetails.text);
            } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
                browserErrors.push(message.params.args.map(arg => arg.value || arg.description).join(" "));
            }
        });
        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++nextId;
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params }));
        });
        await send("Runtime.enable");
        await send("Page.enable");
        await send("Page.navigate", { url });
        let result;
        while (Date.now() < deadline) {
            const evaluation = await send("Runtime.evaluate", {
                expression: "({status: document.documentElement.getAttribute('data-pseudo2wasm-tests'), detail: document.documentElement.getAttribute('data-pseudo2wasm-detail')})",
                returnByValue: true,
            });
            result = evaluation.result.value;
            if (result?.status) break;
            if (child.exitCode !== null) break;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (result?.status !== "passed") {
            throw new Error(`Browser tests ${result?.status || "timed out"}: ${result?.detail || browserErrors.join("; ") || stderr}`);
        }
        console.log(`Browser tests passed in ${path.basename(browser)}`);
    } finally {
        socket?.close();
        if (child && child.exitCode === null) {
            child.kill();
            await Promise.race([
                new Promise(resolve => child.once("close", resolve)),
                new Promise(resolve => setTimeout(resolve, 5000)),
            ]);
        }
        server.close();
        await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runBrowserPage(page).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
