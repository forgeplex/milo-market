import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
const handler=new URL('./connect.mjs',import.meta.url).pathname;
const fake=`const fs=require('fs');const p=process.env.BITWARDENCLI_APPDATA_DIR+'/data.json';const a=process.argv.slice(2);let d={status:'unauthenticated',serverUrl:'https://bitwarden.pleamon.com'};try{d=JSON.parse(fs.readFileSync(p));}catch{};function save(){fs.writeFileSync(p,JSON.stringify(d));}
if(a.includes('test-password'))throw Error('password in argv');
if(a[0]==='status'){if(d.status==='locked'&&process.env.BW_SESSION==='X'.repeat(64))d.status='unlocked';console.log(JSON.stringify(d));}
else if(a[0]==='config'){d.serverUrl=a[2];save();}
else if(a[0]==='login'||a[0]==='unlock'){
if(process.env.MILO_BW_PASSWORD_ONCE!=='test-password'){console.error('Invalid password');process.exit(1);}
if(a[1]==='totp@example.test'&&!a.includes('--code')){console.error('Two-step login code:');setInterval(()=>{},1000);}
else if(a[1]==='device@example.test'){console.error('New device verification required. Enter OTP sent to login email:');process.stdin.once('data',v=>{if(v.toString().trim()!=='123456')process.exit(1);d.status='locked';d.userEmail=a[1];save();console.log('X'.repeat(64));process.exit(0);});}
else{d.status='locked';d.userEmail=a[1];save();console.log('X'.repeat(64));}}
`;
async function fixture(fn){const root=await mkdtemp(join(tmpdir(),'bw-connection-'));const cli=join(root,'fake.cjs');await writeFile(cli,fake);try{await fn(root,cli);}finally{await rm(root,{recursive:true,force:true});}}
async function connect(root,cli,values,action='connect',session){const data=join(root,'profile');const child=spawn(process.execPath,[handler],{env:{BW_CLI_PATH:cli},stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',v=>out+=v);child.stderr.on('data',v=>err+=v);child.stdin.end(JSON.stringify({action,data_directory:data,values,session}));await new Promise((ok,no)=>{child.on('error',no);child.on('close',ok);});assert.ok(!out.includes('test-password'));assert.equal(err,'');return JSON.parse(out);}
const values={serverUrl:'https://bitwarden.pleamon.com',email:'one@example.test',masterPassword:'test-password'};
test('login keeps passwords out of CLI cache; status needs the saved session',()=>fixture(async(root,cli)=>{const result=await connect(root,cli,values);assert.equal(result.state,'connected');assert.equal(result.session,'X'.repeat(64));assert.ok(!(await readFile(join(root,'profile/data.json'),'utf8')).includes('test-password'));assert.equal((await connect(root,cli,{},'status')).state,'locked');assert.equal((await connect(root,cli,{},'status',result.session)).state,'connected');}));
test('wrong password gives no private output',()=>fixture(async(root,cli)=>{assert.deepEqual(await connect(root,cli,{...values,masterPassword:'wrong'}),{state:'invalid_credentials'});}));
test('two step challenge resumes only with explicit code',()=>fixture(async(root,cli)=>{const v={...values,email:'totp@example.test'};assert.deepEqual(await connect(root,cli,v),{state:'requires_code'});assert.equal((await connect(root,cli,{...v,method:'0',code:'123456'})).state,'connected');}));
test('new-device email challenge uses stdin and resumes',()=>fixture(async(root,cli)=>{const v={...values,email:'device@example.test'};assert.deepEqual(await connect(root,cli,v),{state:'requires_device_code'});assert.equal((await connect(root,cli,{...v,deviceCode:'123456'})).state,'connected');}));
test('independent profiles do not reuse another account login',()=>fixture(async(root,cli)=>{await connect(root,cli,values);assert.equal((await connect(root,cli,{...values,email:'other@example.test'})).state,'invalid_credentials');const other=join(root,'other');await mkdir(other);assert.equal((await connect(other,cli,{...values,email:'other@example.test'})).state,'connected');}));
