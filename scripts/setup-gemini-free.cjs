#!/usr/bin/env node
const path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const {readHiddenKey,run}=require('./setup-openai.cjs');
const {speechRequest,readAudio,SOURCE_PROJECT,MODELS}=require('../functions/gemini-free-speech');
const HOST_PROJECT='mediafbtq-6e1bb';
function environment(){const env={...process.env,PATH:[path.dirname(process.execPath),path.join(os.homedir(),'.local/bin'),process.env.PATH||''].join(path.delimiter)};for(const name of ['GEMINI_API_KEY','GEMINI_FREE_API_KEY','GOOGLE_API_KEY','DEBUG','FIREBASE_DEBUG_MODE'])delete env[name];return env;}
function firebasePath(env){for(const dir of env.PATH.split(path.delimiter)){const file=path.join(dir,'firebase');try{fs.accessSync(file,fs.constants.X_OK);return file;}catch{}}throw Error('Chưa tìm thấy Firebase CLI.');}
async function checkKey(key,fetchImpl=fetch){
 let response;try{response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(speechRequest('Xin chào.','Aoede',MODELS[0])),signal:AbortSignal.timeout(80000)});}catch{throw Error('Không kết nối được Gemini. Chưa lưu key; không tự gửi lại.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const raw=String(data.error?.message||'');if(response.status===402||/prepay(?:ment)?.*(?:depleted|exhausted|required)/i.test(raw))throw Error('Key yêu cầu thanh toán. Kiểm tra đã chọn đúng '+SOURCE_PROJECT+' ở Free Tier, không liên kết Billing. Chưa lưu key.');if(response.status===429)throw Error('Gemini Free đã chạm quota. Chờ phục hồi; chưa lưu key.');if([401,403,404].includes(response.status))throw Error('Key hoặc project chưa được phép dùng Gemini TTS. Kiểm tra key, xác minh project Free Tier và quyền dùng model. Chưa lưu key.');throw Error('Gemini chưa xử lý được yêu cầu. Chưa lưu key.');}
 try{readAudio(data);}catch{throw Error('Gemini chưa trả về WAV hoàn chỉnh. Chưa lưu key.');}
}
async function main(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Cần Node.js 22 trở lên.');
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Chạy trình cài đặt trong Terminal để nhập key kín.');
 const env=environment(),firebase=firebasePath(env),root=path.resolve(__dirname,'..');
 console.log('\nGEMINI FREE TTS · '+SOURCE_PROJECT+'\nGiữ project Gemini trên Free Tier, không liên kết Billing.\nBackend chạy trên Firebase Blaze '+HOST_PROJECT+'; phí Functions/Secret Manager vẫn có thể áp dụng.\nNhập key của project Gemini riêng, không nhập key OpenAI hoặc reCAPTCHA site key.\nTrình cài đặt thử một câu rất ngắn bằng Gemini TTS rồi lưu vào Secret Manager.\n');
 await run(process.execPath,[path.join(root,'scripts/check-source.cjs')],{env});
 await run(firebase,['projects:list','--json','--non-interactive'],{env,capture:true});
 let key=await readHiddenKey(process.stdin,process.stdout,'Dán key Gemini của '+SOURCE_PROJECT+' rồi Enter (nội dung được ẩn): ');
 if(!key||/\s/.test(key)||key.length<20)throw Error('Key chưa hợp lệ. Chưa lưu.');
 try{console.log('Đang kiểm tra một câu ngắn…');await checkKey(key);await run(firebase,['functions:secrets:set','GEMINI_FREE_API_KEY','--project',HOST_PROJECT,'--data-file','-','--non-interactive'],{env,secret:key});}finally{key='';}
 console.log('Đang triển khai riêng synthesizeFreeSpeech (yêu cầu đăng nhập và tài khoản đã duyệt)…');
 await run(firebase,['deploy','--only','functions:synthesizeFreeSpeech','--project',HOST_PROJECT,'--non-interactive'],{env});
 console.log('\nĐã triển khai backend Gemini Free. Không thay key hoặc IAM của OpenAI.\nGiao diện mới cần được cập nhật lên GitHub Pages trước khi dùng.\nBáo “Đã cài Gemini Free” để kiểm tra và hoàn tất cập nhật website.\n');
}
module.exports={checkKey,environment,HOST_PROJECT,SOURCE_PROJECT};
if(require.main===module)main().catch(error=>{console.error('\n'+error.message);process.exitCode=1;});
