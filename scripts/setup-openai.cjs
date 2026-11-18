#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),readline=require('node:readline');
const {Writable}=require('node:stream'),{spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),PROJECT='mediafbtq-6e1bb';
const FUNCTIONS=['checkOpenAIConnection','generateContentOpenAI','askAssistantOpenai','reviewContentAI','suggestReplyOpenAI','getStudioAISetup','generateStudioImage','transcribeStudioAudio','analyzeStudioHighlightsOpenAI'];
const STATUS_FILE=path.join(os.tmpdir(),'fbtq-openai-setup-'+process.getuid()+'.json');
function stage(phase){fs.writeFileSync(STATUS_FILE,JSON.stringify({project:PROJECT,phase,at:new Date().toISOString()}),{mode:0o600});}
function environment(){const env={...process.env,PATH:[path.dirname(process.execPath),path.join(os.homedir(),'.local/bin'),process.env.PATH||''].join(path.delimiter)};delete env.OPENAI_API_KEY;return env;}
function executable(name,env){for(const dir of env.PATH.split(path.delimiter)){const file=path.join(dir,name);try{fs.accessSync(file,fs.constants.X_OK);return file;}catch{}}throw Error(`Chưa tìm thấy ${name}. Cài Firebase CLI trước rồi mở lại trình cài đặt.`);}
function readHiddenKey(input=process.stdin,output=process.stdout,prompt='Dán API key OpenAI MỚI rồi nhấn Enter (nội dung được ẩn): '){
 if(!input.isTTY||!output.isTTY)return Promise.reject(Error('Mở trình cài đặt bằng Terminal để nhập key kín. Không nhập API key trong chat.'));
 return new Promise((resolve,reject)=>{
  let muted=false,done=false;
  const sink=new Writable({write(chunk,_encoding,next){if(!muted)output.write(chunk);next();}});sink.isTTY=true;sink.columns=output.columns||80;
  const rl=readline.createInterface({input,output:sink,terminal:true,historySize:0});
  const finish=(error,key)=>{if(done)return;done=true;muted=true;rl.close();output.write('\n');error?reject(error):resolve(key);};
  rl.on('SIGINT',()=>finish(Error('Đã hủy cài đặt.')));rl.on('close',()=>{if(!done)finish(Error('Đã đóng phần nhập key.'));});
  rl.question(prompt,value=>finish(null,value.trim()));muted=true;
 });
}
const validKey=value=>typeof value==='string'&&/^sk-[A-Za-z0-9_-]{20,}$/.test(value);
async function checkKey(key,fetchImpl=fetch){
 let response;try{response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:'gpt-6-luna',input:'Reply only: OK',reasoning:{effort:'none'},text:{verbosity:'low'},max_output_tokens:64,store:false}),signal:AbortSignal.timeout(55000)});}catch{throw Error('Không kết nối được OpenAI. Kiểm tra mạng rồi chạy lại; không tự gửi lại yêu cầu.');}
 if(!response.ok){const messages={401:'API key không hợp lệ hoặc đã bị thu hồi.',403:'Key/project chưa có quyền dùng model OpenAI.',404:'Project OpenAI chưa truy cập được GPT-6 Luna.',429:'OpenAI báo hết hạn mức hoặc giới hạn tốc độ. Kiểm tra API billing và số dư.'};throw Error(messages[response.status]||'OpenAI chưa xử lý được yêu cầu. Thử lại sau.');}
 const data=await response.json().catch(()=>({}));
 if(data.status==='incomplete'||!Array.isArray(data.output)||!data.output.some(item=>Array.isArray(item.content)&&item.content.some(part=>part.type==='output_text'&&part.text?.trim())))throw Error('OpenAI chưa trả về phản hồi hoàn chỉnh. Chưa lưu key hoặc triển khai.');
}
function run(command,args,{env=environment(),secret,capture=false,spawnImpl=spawn}={}){
 return new Promise((resolve,reject)=>{
  // The key is sent only over stdin. Disable CLI debug-file output for this step:
  // older Firebase CLIs can include a base64 secret payload in debug HTTP logs.
  const childEnv=secret!==undefined?{...env,FIREBASE_DEBUG_PATH:'/dev/null'}:env;
  if(secret!==undefined){delete childEnv.DEBUG;delete childEnv.FIREBASE_DEBUG_MODE;delete childEnv.OPENAI_API_KEY;}
  const child=spawnImpl(command,args,{cwd:ROOT,env:childEnv,stdio:[secret!==undefined?'pipe':'inherit',capture?'pipe':'inherit',capture?'pipe':'inherit'],shell:false});
  let output='';if(capture){const collect=chunk=>{if(output.length<1000000)output+=chunk.toString();};child.stdout.on('data',collect);child.stderr.on('data',collect);}
  child.once('error',()=>reject(Error('Không khởi chạy được công cụ cài đặt. Kiểm tra Node.js, npm và Firebase CLI.')));
  child.once('exit',(code,signal)=>{if(code===0)resolve(output);else reject(Error(`Bước cài đặt chưa hoàn tất (${signal||'mã '+code}). Xem thông báo Firebase ở phía trên. Có thể chạy lại trình cài đặt sau khi sửa lỗi.`));});
  if(secret!==undefined){child.stdin.on('error',()=>{});child.stdin.end(secret);}
 });
}
async function main(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Cần Node.js 22 trở lên.');
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Mở file Cai-dat-OpenAI.command bằng Terminal trên Mac.');
 const env=environment(),firebase=executable('firebase',env),npm=executable('npm',env);
 console.log(`\nCÀI OPENAI CHO FBTQ · Firebase ${PROJECT}\nKey chỉ lưu vào Secret Manager. Không nhập key vào câu lệnh hoặc chat.\nTrình cài đặt sẽ thử một phản hồi OpenAI rất ngắn trước khi triển khai.\n`);
 console.log('1/5 · Kiểm tra mã nguồn và thư viện…');
 stage('preflight');
 await run(process.execPath,[path.join(ROOT,'scripts/check-source.cjs')],{env});
 await run(npm,['--prefix','functions','ci'],{env});
 console.log('2/5 · Kiểm tra đăng nhập Firebase…');
 try{await run(firebase,['projects:list','--json','--non-interactive'],{env,capture:true});}
 catch{console.log('Cần đăng nhập Google có quyền project. Hoàn tất trong trình duyệt rồi quay lại Terminal.');await run(firebase,['login'],{env});}
 try{await run(firebase,['apps:list','--project',PROJECT,'--json','--non-interactive'],{env,capture:true});}catch{throw Error('Chưa đọc được project '+PROJECT+'. Kiểm tra mạng và tài khoản Google; dùng firebase login --reauth nếu đăng nhập nhầm tài khoản.');}
 console.log('3/5 · Nhập API key (không hiển thị)…');
 stage('awaiting-key');
 let key='';
 while(!validKey(key)){key=await readHiddenKey();if(!validKey(key)){key='';console.log('Key chưa đúng định dạng. Dán nguyên secret key bắt đầu bằng sk-, không dán tên secret hoặc câu lệnh.');}}
 try{stage('checking-key');console.log('Đang kiểm tra một phản hồi ngắn từ OpenAI…');await checkKey(key);stage('saving-secret');await run(firebase,['functions:secrets:set','OPENAI_API_KEY','--project',PROJECT,'--data-file','-','--non-interactive'],{env,secret:key});}finally{key='';}
 console.log('4/5 · Triển khai 9 chức năng OpenAI (có thể mất vài phút)…');
 stage('deploying-functions');
 await run(firebase,['deploy','--project',PROJECT,'--only',FUNCTIONS.map(n=>'functions:'+n).join(',')],{env});
 console.log('Kiểm tra quyền HTTP để trình duyệt gọi được Functions…');
 stage('repairing-invokers');
 await run(process.execPath,[path.join(ROOT,'scripts/repair-openai-invokers.cjs')],{env});
 console.log('5/5 · Cập nhật Firebase Hosting…');
 stage('deploying-hosting');
 await run(firebase,['deploy','--project',PROJECT,'--only','hosting'],{env});
 console.log(`\nĐÃ TRIỂN KHAI · https://${PROJECT}.web.app\nĐăng nhập → Cài đặt → Mô hình AI → Kiểm tra OpenAI → chọn OpenAI → Lưu cấu hình.\nTriển khai thành công chưa thay thế kiểm tra kết nối thực.\nNếu dùng GitHub Pages, vẫn cần cập nhật mã nguồn lên Pages; Hosting không tự cập nhật Pages.\n`);
 stage('deployed');
}
module.exports={PROJECT,FUNCTIONS,validKey,readHiddenKey,checkKey,run,STATUS_FILE};
if(require.main===module)main().catch(error=>{stage('stopped');console.error('\n'+error.message);process.exitCode=1;});
