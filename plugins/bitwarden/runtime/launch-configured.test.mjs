import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,rm,chmod,realpath} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
test('configured launcher forwards the private session, prepares Node PATH and drops host secrets',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'bitwarden-configured-launch-')));
 try{
  const runtime=join(root,'runtime'),state=join(root,'private','cli');
  await mkdir(join(runtime,'node_modules/@bitwarden/mcp-server/dist'),{recursive:true});await mkdir(state,{recursive:true,mode:0o700});
  await copyFile(new URL('./launch-configured.mjs',import.meta.url),join(runtime,'launch-configured.mjs'));
  await writeFile(join(runtime,'node_modules/@bitwarden/mcp-server/dist/index.js'),`console.log(JSON.stringify({privateSession:process.env.BW_SESSION==='fixture-private-session',hostSecretAbsent:!process.env.MILO_PROVIDER_ENCRYPTION_KEY,nodePath:process.env.PATH.split(':')[0],cliPath:process.env.BW_CLI_PATH}));`);
  const env={PATH:process.env.PATH,BITWARDENCLI_APPDATA_DIR:state,BW_SESSION:'fixture-private-session',MILO_PROVIDER_ENCRYPTION_KEY:'must-not-reach-child'};
  const run=()=>spawnSync(process.execPath,[join(runtime,'launch-configured.mjs')],{env,encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);const proof=JSON.parse(result.stdout);
  assert.equal(proof.privateSession,true);assert.equal(proof.hostSecretAbsent,true);assert.equal(proof.nodePath,dirname(process.execPath));
  assert.equal(proof.cliPath,join(runtime,'node_modules/@bitwarden/cli/build/bw.js'));
  delete env.BW_SESSION;assert.notEqual(run().status,0);
  env.BW_SESSION='fixture-private-session';await chmod(state,0o755);assert.notEqual(run().status,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
