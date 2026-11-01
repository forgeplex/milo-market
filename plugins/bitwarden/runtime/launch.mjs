// Local stdio only. The state directory belongs to one Milo account.
import { readFileSync, mkdirSync, lstatSync } from "node:fs";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const runtime = dirname(fileURLToPath(import.meta.url));
const state = process.argv[2];
if (!state || !isAbsolute(state)) throw new Error("An absolute private state directory is required");
mkdirSync(state, { recursive: true, mode: 0o700 });
const stateInfo = lstatSync(state);
if (!stateInfo.isDirectory() || (stateInfo.mode & 0o077) ||
    (process.getuid && stateInfo.uid !== process.getuid())) {
  throw new Error("State directory must be owned by this process user and private (0700)");
}
const env = { PATH: dirname(process.execPath) + ":/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8",
  HOME: state, BITWARDENCLI_APPDATA_DIR: resolve(state, "cli"),
  BW_CLI_PATH: resolve(runtime, "node_modules/@bitwarden/cli/build/bw.js") };
try {
  const path = resolve(state, "session");
  const info = lstatSync(path);
  if (!info.isFile() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) throw new Error("Session file must be private (0600)");
  env.BW_SESSION = readFileSync(path, "utf8").trim();
} catch (error) { if (error.code !== "ENOENT") throw error; }
const child = spawn(process.execPath, [resolve(runtime, "node_modules/@bitwarden/mcp-server/dist/index.js")], {
  env, stdio: ["inherit", "inherit", "ignore"]
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { process.stderr.write("Bitwarden MCP could not start\n"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
