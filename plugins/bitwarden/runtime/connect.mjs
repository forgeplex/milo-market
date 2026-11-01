// Private connection protocol v1. Credentials never enter the Agent channel.
import {spawn} from 'node:child_process';
import {mkdirSync,chmodSync,existsSync,lstatSync,unlinkSync} from 'node:fs';
import {isAbsolute,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {createServer,createConnection} from 'node:net';
import {fileURLToPath} from 'node:url';
process.umask(0o077);
const worker=process.argv[2]==='--worker';
let request;
if(!worker){let raw='';for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>32768)process.exit(2);}try{request=JSON.parse(raw);}catch{process.exit(2);}raw='';}
const data=worker?process.argv[3]:request.data_directory,cli=process.env.BW_CLI_PATH;
if(!data||!isAbsolute(data)||!cli||!isAbsolute(cli))process.exit(2);
function privateDir(path){mkdirSync(path,{recursive:true,mode:0o700});const i=lstatSync(path);if(!i.isDirectory()||(i.mode&0o077)||(process.getuid&&i.uid!==process.getuid()))throw Error('Private directory required');}
privateDir(data);
// Unix socket paths have a short platform limit. A private /tmp directory protects the endpoint.
const socketDir=join(tmpdir(),'milo-bw-'+createHash('sha256').update(data).digest('hex').slice(0,40));
const socketPath=join(socketDir,'login.sock');
const baseEnv={PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',HOME:data,BITWARDENCLI_APPDATA_DIR:data};
let liveChild=null,continuation=null,client=null,busy=false,finished=false,server;
function respond(value){if(client&&!client.destroyed)client.end(JSON.stringify(value)+'\n');client=null;}
function finishWorker(){if(finished)return;finished=true;if(liveChild)liveChild.kill('SIGKILL');if(client)client.destroy();if(server)server.close();try{unlinkSync(socketPath);}catch{}setTimeout(()=>process.exit(0),10);}
function pause(state,callback){continuation=callback;respond({state});}
function invoke(args,{interactive=false,session,password,code,method,deviceCode}={}){
 return new Promise(resolve=>{
  const env={...baseEnv,...(session?{BW_SESSION:session}:{})};
  if(password!==undefined)env.MILO_BW_PASSWORD_ONCE=password;
  if(!interactive)env.BW_NOINTERACTION='true';
  const child=spawn(process.execPath,[cli,...args],{env,stdio:['pipe','pipe','pipe']});liveChild=child;
  let stdout='',stderr='',challenge=null,sentDevice=false,awaiting=false,settled=false;
  let timer=setTimeout(()=>{challenge='network_error';child.kill('SIGKILL');},40000);
  const finish=(exitCode)=>{if(settled)return;settled=true;clearTimeout(timer);liveChild=null;continuation=null;if(existsSync(data+'/data.json'))chmodSync(data+'/data.json',0o600);resolve({exitCode,stdout,stderr,challenge});};
  const waitForCode=(state,field)=>{
   if(awaiting)return;awaiting=true;clearTimeout(timer);
   pause(state,next=>{const value=next.values?.[field];if(!value){pause(state,continuation);return;}continuation=null;awaiting=false;if(field==='deviceCode'){deviceCode=value;sentDevice=true;}else code=value;stdout='';stderr='';timer=setTimeout(()=>{challenge='network_error';child.kill('SIGKILL');},40000);child.stdin.write(value+'\n');});
  };
  const inspect=()=>{
   const text=(stderr+stdout).replace(/\x1b\[[0-9;?]*[A-Za-z]/g,'');
   if(/New device verification (?:code:|required\. Enter OTP sent to login email:)/i.test(text)&&!sentDevice){
    if(deviceCode){sentDevice=true;child.stdin.write(deviceCode+'\n');}else waitForCode('requires_device_code','deviceCode');
   }else if(/Two-step login code:/i.test(text)&&!code){waitForCode('requires_code','code');}
   else if(/Two-step login method:/i.test(text)&&!method){challenge='requires_code';child.kill('SIGTERM');}
   else if(/Master password:/i.test(text)){challenge='failed';child.kill('SIGTERM');}
   if(stdout.length+stderr.length>65536){challenge='failed';child.kill('SIGKILL');}
  };
  child.stdin.on('error',()=>{});child.stdout.on('data',b=>{stdout+=b;inspect();});child.stderr.on('data',b=>{stderr+=b;inspect();});child.on('error',()=>finish(-1));child.on('close',finish);
 });
}
async function status(session){const r=await invoke(['status'],{session});if(r.exitCode!==0)return null;try{return JSON.parse(r.stdout.trim());}catch{return null;}}
function key(text){return text.split(/\r?\n/).map(s=>s.trim()).reverse().find(s=>/^[A-Za-z0-9+/=]{32,256}$/.test(s));}
function failure(r){if(r.challenge)return {state:r.challenge};const text=(r.stderr+' '+r.stdout).toLowerCase();
 if(text.includes('captcha')||text.includes('sso'))return {state:'browser_required'};
 if(text.includes('code is required')||text.includes('two-step')||text.includes('two factor'))return {state:'requires_code'};
 if(text.includes('device verification'))return {state:'requires_device_code'};
 if(text.includes('invalid')||text.includes('incorrect')||text.includes('password')||text.includes('credentials')||text.includes('login failed'))return {state:'invalid_credentials'};
 return {state:'network_error'};
}
async function login(values){
 const serverUrl=values.serverUrl,email=values.email,password=values.masterPassword;
 if(!serverUrl||!email||!password)return {state:'invalid_credentials'};
 let s=await status();if(s?.userEmail&&(s.userEmail.toLowerCase()!==email.toLowerCase()||s.serverUrl!==serverUrl))return {state:'invalid_credentials'};
 let r;if(s?.status==='locked')r=await invoke(['unlock','--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'],{password});
 else{const configured=await invoke(['config','server',serverUrl]);if(configured.exitCode!==0)return failure(configured);
  const args=['login',email,'--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'];if(values.method)args.push('--method',values.method);if(values.code)args.push('--code',values.code);
  r=await invoke(args,{interactive:true,password,method:values.method,code:values.code,deviceCode:values.deviceCode});}
 if(r.exitCode!==0||r.challenge)return failure(r);let session=key(r.stdout);
 if(!session){r=await invoke(['unlock','--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'],{password});if(r.exitCode!==0)return failure(r);session=key(r.stdout);}
 if(!session)return {state:'failed'};s=await status(session);if(s?.status!=='unlocked'||s.serverUrl!==serverUrl||s.userEmail?.toLowerCase()!==email.toLowerCase())return {state:'failed'};
 return {state:'connected',session};
}
async function daemon(){
 privateDir(socketDir);
 // This worker exists only for one bounded setup attempt. No credential is written to its socket file.
 const expiry=setTimeout(finishWorker,600000);
 process.on('SIGTERM',finishWorker);process.on('SIGINT',finishWorker);
 server=createServer(socket=>{let raw='';socket.on('error',()=>{});socket.on('data',async chunk=>{
  raw+=chunk;if(raw.length>32768){socket.destroy();return;}if(!raw.includes('\n'))return;
  let next;try{next=JSON.parse(raw.slice(0,raw.indexOf('\n')));}catch{socket.destroy();return;}raw='';socket.removeAllListeners('data');
  if(next.data_directory!==data){socket.destroy();return;}
  if(next.action==='cancel'){client=socket;respond({state:'cancelled'});clearTimeout(expiry);finishWorker();return;}
  if(client){socket.end('{"state":"failed"}\n');return;}client=socket;
  if(continuation){const resume=continuation;resume(next);return;}
  if(busy){respond({state:'failed'});return;}busy=true;
  try{const result=await login(next.values||{});respond(result);if(result.state==='connected'){clearTimeout(expiry);finishWorker();}}catch{respond({state:'failed'});}finally{busy=false;}
 });});
 server.on('error',finishWorker);server.listen(socketPath,()=>chmodSync(socketPath,0o600));
}
async function broker(){
 privateDir(socketDir);
 if(!existsSync(socketPath)){
  if(request.action==='cancel')return {state:'cancelled'};
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--worker',data],{env:{BW_CLI_PATH:cli},detached:true,stdio:'ignore'});child.unref();
  for(let i=0;i<100&&!existsSync(socketPath);i++)await new Promise(ok=>setTimeout(ok,20));
 }
 const info=lstatSync(socketPath);if(!info.isSocket()||(info.mode&0o077)||(process.getuid&&info.uid!==process.getuid()))throw Error('Private socket required');
 return new Promise((resolve,reject)=>{const socket=createConnection(socketPath);let raw='';const timer=setTimeout(()=>{socket.destroy();reject(Error('timeout'));},60000);socket.on('connect',()=>socket.write(JSON.stringify(request)+'\n'));socket.on('data',b=>{raw+=b;if(raw.length>32768){socket.destroy();clearTimeout(timer);reject(Error('limit'));}});socket.on('error',()=>{clearTimeout(timer);reject(Error('connection'));});socket.on('end',()=>{clearTimeout(timer);try{resolve(JSON.parse(raw));}catch{reject(Error('protocol'));}});});
}
if(worker)await daemon();
else{try{let result;if(request.action==='status'){const s=await status(request.session);result={state:s?.status==='unlocked'?'connected':s?.status==='locked'?'locked':'unauthenticated',email:s?.userEmail??null,server_url:s?.serverUrl??null};}else if(['connect','cancel'].includes(request.action))result=await broker();else result={state:'unsupported'};console.log(JSON.stringify(result));}catch{console.log('{"state":"failed"}');}request=null;}
