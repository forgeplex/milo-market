// Configured stdio entry point. Session values arrive only through Milo's encrypted MCP binding.
import { lstatSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const runtime=dirname(fileURLToPath(import.meta.url));
const state=process.env.BITWARDENCLI_APPDATA_DIR;
if(!state || !isAbsolute(state)) throw new Error('Bitwarden CLI state is not prepared');
const info=lstatSync(state);
if(!info.isDirectory() || (info.mode & 0o077) || (process.getuid && info.uid!==process.getuid())) {
  throw new Error('Bitwarden CLI state must be private and owned by this process');
}
if(!process.env.BW_SESSION) throw new Error('Bitwarden unlock session is not configured');
const env={PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',
  HOME:dirname(state),BITWARDENCLI_APPDATA_DIR:state,BW_SESSION:process.env.BW_SESSION,
  BW_CLI_PATH:resolve(runtime,'node_modules/@bitwarden/cli/build/bw.js')};
const child=spawn(process.execPath,[resolve(runtime,'node_modules/@bitwarden/mcp-server/dist/index.js')],{
  env,stdio:['inherit','inherit','ignore']
});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('error',()=>{process.stderr.write('Bitwarden MCP could not start\n');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
