// Private connection protocol v1. Input/output stay on Milo's dedicated setup channel.
import {spawn} from 'node:child_process';
import {mkdirSync,chmodSync,existsSync,lstatSync} from 'node:fs';
import {isAbsolute,dirname} from 'node:path';
process.umask(0o077);
let raw='';for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>32768)process.exit(2);}
let request;try{request=JSON.parse(raw);}catch{process.exit(2);}raw='';
const data=request.data_directory,cli=process.env.BW_CLI_PATH;
if(!data||!isAbsolute(data)||!cli||!isAbsolute(cli))process.exit(2);
mkdirSync(data,{recursive:true,mode:0o700});const info=lstatSync(data);
if(!info.isDirectory()||(info.mode&0o077)||(process.getuid&&info.uid!==process.getuid()))process.exit(2);
const baseEnv={PATH:dirname(process.execPath)+':/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',HOME:data,BITWARDENCLI_APPDATA_DIR:data};
const values=request.values||{};
function invoke(args,{interactive=false,session,password,code,method,deviceCode}={}){
 return new Promise(resolve=>{
  const env={...baseEnv,...(session?{BW_SESSION:session}:{})};
  // The password never occurs in argv, on disk, in protocol output, or in the model channel.
  const passwordName='MILO_BW_PASSWORD_ONCE';if(password!==undefined)env[passwordName]=password;
  if(!interactive)env.BW_NOINTERACTION='true';
  const child=spawn(process.execPath,[cli,...args],{env,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',challenge=null,sentDevice=false,settled=false;
  const finish=(exitCode)=>{if(settled)return;settled=true;clearTimeout(timer);if(existsSync(data+'/data.json'))chmodSync(data+'/data.json',0o600);resolve({exitCode,stdout,stderr,challenge});};
  const timer=setTimeout(()=>{challenge='network_error';child.kill('SIGKILL');},40000);
  const inspect=()=>{
   const text=(stderr+stdout).replace(/\x1b\[[0-9;?]*[A-Za-z]/g,'');
   if(/New device verification (?:code:|required\. Enter OTP sent to login email:)/i.test(text)&&!sentDevice){
    if(deviceCode){sentDevice=true;child.stdin.write(deviceCode+'\n');}
    else {challenge='requires_device_code';child.kill('SIGTERM');}
   } else if((/Two-step login code:/i.test(text)&&!code)||(/Two-step login method:/i.test(text)&&!method)){challenge='requires_code';child.kill('SIGTERM');}
   else if(/Master password:/i.test(text)){challenge='failed';child.kill('SIGTERM');}
   if(stdout.length+stderr.length>65536){challenge='failed';child.kill('SIGKILL');}
  };
  child.stdout.on('data',b=>{stdout+=b;inspect();});child.stderr.on('data',b=>{stderr+=b;inspect();});
  child.stdin.on('error',()=>{});child.on('error',()=>finish(-1));child.on('close',finish);
 });
}
async function status(session){const r=await invoke(['status'],{session});if(r.exitCode!==0)return null;try{return JSON.parse(r.stdout.trim());}catch{return null;}}
function key(text){return text.split(/\r?\n/).map(s=>s.trim()).reverse().find(s=>/^[A-Za-z0-9+/=]{32,256}$/.test(s));}
function failure(r){if(r.challenge)return {state:r.challenge};const text=(r.stderr+' '+r.stdout).toLowerCase();
 if(text.includes('captcha')||text.includes('sso'))return {state:'browser_required'};
 if(text.includes('code is required')||text.includes('two-step')||text.includes('two factor'))return {state:'requires_code'};
 if(text.includes('device verification'))return {state:'requires_device_code'};
 if(text.includes('invalid')||text.includes('incorrect')||text.includes('password')||text.includes('credentials'))return {state:'invalid_credentials'};
 return {state:'network_error'};
}
async function main(){
 if(request.action==='status'){const s=await status(request.session);return {state:s?.status==='unlocked'?'connected':s?.status==='locked'?'locked':'unauthenticated',email:s?.userEmail??null,server_url:s?.serverUrl??null};}
 if(request.action!=='connect')return {state:'unsupported'};
 const server=values.serverUrl,email=values.email,password=values.masterPassword;
 if(!server||!email||!password)return {state:'invalid_credentials'};
 let s=await status();
 if(s?.userEmail && (s.userEmail.toLowerCase()!==email.toLowerCase()||s.serverUrl!==server))return {state:'invalid_credentials'};
 let r;
 if(s?.status==='locked')r=await invoke(['unlock','--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'],{password});
 else {
  const configured=await invoke(['config','server',server]);if(configured.exitCode!==0)return failure(configured);
  const args=['login',email,'--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'];
  if(values.method)args.push('--method',values.method);if(values.code)args.push('--code',values.code);
  r=await invoke(args,{interactive:true,password,method:values.method,code:values.code,deviceCode:values.deviceCode});
 }
 if(r.exitCode!==0||r.challenge)return failure(r);
 let session=key(r.stdout);
 if(!session){r=await invoke(['unlock','--passwordenv','MILO_BW_PASSWORD_ONCE','--raw'],{password});if(r.exitCode!==0)return failure(r);session=key(r.stdout);}
 if(!session)return {state:'failed'};
 s=await status(session);if(s?.status!=='unlocked'||s.serverUrl!==server||s.userEmail?.toLowerCase()!==email.toLowerCase())return {state:'failed'};
 return {state:'connected',session};
}
try{console.log(JSON.stringify(await main()));}catch{console.log(JSON.stringify({state:'failed'}));}
request=null;
