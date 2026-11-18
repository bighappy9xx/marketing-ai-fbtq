#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),readline=require('node:readline/promises');
const {run,readHiddenKey}=require('./setup-openai.cjs');
const {metaConfig}=require('../functions/meta-config');
const PROJECT='mediafbtq-6e1bb',ROOT=path.resolve(__dirname,'..');
const SITE='https://bighappy9xx.github.io/marketing-ai-fbtq/';
const REDIRECT=SITE+'index.html',WEBHOOK=`https://us-central1-${PROJECT}.cloudfunctions.net/metaWebhook`;
const FUNCTIONS=['sendMessengerImage','checkMessengerConnection','syncFacebookInbox','getChatbotSetup','beginFacebookLogin','finishFacebookLogin','getFacebookPageSelection','addFacebookPages','getPageChatbot','savePageChatbot','listMyPages','connectFacebookPage','sendPageReply','sendChatbotMessage','setChatbotHandoff','previewChatbotBroadcast','sendChatbotBroadcast','metaWebhook'];
function updateEnv(text,values){let result=text;for(const [key,value] of Object.entries(values)){if(!/^META_[A-Z_]+$/.test(key)||/[\r\n]/.test(value))throw Error('Cấu hình Meta không hợp lệ.');const pattern=new RegExp('^'+key+'=.*$','m'),line=key+'='+value;result=pattern.test(result)?result.replace(pattern,()=>line):result.replace(/\s*$/,'')+'\n'+line+'\n';}return result;}
function loadTools(){
 const dirs=[path.join(os.homedir(),'.local/bin'),...(process.env.PATH||'').split(path.delimiter)];
 for(const dir of dirs){try{const binary=fs.realpathSync(path.join(dir,'firebase')),root=path.resolve(path.dirname(binary),'../..');if(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).name==='firebase-tools')return {binary,cli:require(root),secrets:require(path.join(root,'lib/gcp/secretManager.js'))};}catch{}}
 throw Error('Chưa tìm thấy Firebase CLI.');
}
async function ensureEncryptionKey({exists,save,random=()=>crypto.randomBytes(32).toString('hex')}){if(await exists('META_TOKEN_ENCRYPTION_KEY'))return false;await save('META_TOKEN_ENCRYPTION_KEY',random());return true;}
async function checkApp(appId,secret,version,fetchImpl=fetch){
 const url=new URL(`https://graph.facebook.com/${version}/oauth/access_token`);url.search=new URLSearchParams({client_id:appId,client_secret:secret,grant_type:'client_credentials'}).toString();
 let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(20000)});}catch{throw Error('Không kết nối được Meta để kiểm tra App ID/App Secret. Chưa lưu secret mới.');}
 const data=await response.json().catch(()=>({}));if(!response.ok||typeof data.access_token!=='string')throw Error('Meta chưa xác nhận App ID/App Secret. Kiểm tra đúng App, Graph version và thử lại. Chưa lưu secret mới.');
}
async function main(){
 if(Number(process.versions.node.split('.')[0])<22||!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Chạy bằng Node.js 22 trong Terminal để nhập App Secret kín.');
 const tools=loadTools(),env={...process.env,PATH:[path.dirname(process.execPath),process.env.PATH||''].join(path.delimiter)};for(const key of ['META_APP_SECRET','META_VERIFY_TOKEN','META_TOKEN_ENCRYPTION_KEY','DEBUG','FIREBASE_DEBUG_MODE'])delete env[key];
 console.log('\nCÀI MESSENGER FANPAGE · '+PROJECT+'\nKhông nhập Page Token; kết nối Trang bằng đăng nhập Facebook trên website.\nApp Secret chỉ lưu trong Secret Manager; khóa mã hóa cũ sẽ được giữ nguyên.\nTriển khai HTTP công khai cho webhook/callable; callable vẫn yêu cầu tài khoản đã duyệt.\nKhông tự kết nối Trang, gửi tin hoặc bật bot trong trình cài đặt.\n');
 await run(process.execPath,[path.join(ROOT,'scripts/check-source.cjs')],{env});
 await tools.cli.projects.list({project:PROJECT,nonInteractive:true});
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});let appId,version,loginConfigId;
 try{appId=(await rl.question('Meta App ID (mã công khai): ')).trim();version=(await rl.question('Graph version App hỗ trợ [v26.0]: ')).trim()||'v26.0';loginConfigId=(await rl.question('Facebook Login for Business Configuration ID (Enter nếu không dùng): ')).trim();}finally{rl.close();}
 const values={META_APP_ID:appId,META_GRAPH_VERSION:version,META_REDIRECT_URI:REDIRECT,META_WEBHOOK_URL:WEBHOOK,META_LOGIN_CONFIG_ID:loginConfigId,META_CHATBOT_GEMINI_ENABLED:'false'},config=metaConfig(values);
 if(!config.configured)throw Error('Cấu hình chưa hợp lệ: '+config.missing.join(', '));
 const file=path.join(ROOT,'functions','.env.'+PROJECT),old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
 const oldApp=old.match(/^META_APP_ID=(.*)$/m)?.[1]?.trim();
 const exists=name=>tools.secrets.secretExists(PROJECT,name);
 const save=(name,value)=>run(tools.binary,['functions:secrets:set',name,'--project',PROJECT,'--data-file','-','--non-interactive'],{env,secret:value});
 const hasAppSecret=await exists('META_APP_SECRET'),mustEnter=!hasAppSecret||oldApp!==appId;
 let secret=await readHiddenKey(process.stdin,process.stdout,'App Secret của Meta App'+(mustEnter?' (bắt buộc)':' (Enter giữ nguyên secret đã lưu)')+': ');
 if(mustEnter&&!secret)throw Error('Cần App Secret của đúng App ID trước khi triển khai.');
 try{if(secret){if(!/^[a-f0-9]{32}$/i.test(secret))throw Error('App Secret chưa đúng định dạng 32 ký tự hex. Không nhập App ID hoặc Page Token.');await checkApp(appId,secret,version);await save('META_APP_SECRET',secret);}}finally{secret='';}
 let verifyToken='';
 if(!await exists('META_VERIFY_TOKEN')){verifyToken=crypto.randomBytes(32).toString('hex');await save('META_VERIFY_TOKEN',verifyToken);}
 const generated=await ensureEncryptionKey({exists,save});console.log(generated?'Đã tạo khóa mã hóa token.':'Đã giữ nguyên khóa mã hóa token hiện có.');
 fs.writeFileSync(file,updateEnv(old,values),{mode:0o600});
 const auto=await exists('OPENAI_API_KEY');
 console.log('Đang triển khai các chức năng kết nối Messenger và chỉ mục hội thoại…');
 await run(tools.binary,['deploy','--project',PROJECT,'--only',[...FUNCTIONS.map(n=>'functions:'+n),'firestore:indexes'].join(','),'--non-interactive'],{env});
 console.log('Các chức năng kết nối, webhook và gửi tin thủ công đã triển khai.');
 console.log('\nCẤU HÌNH TRÊN META APP\nApp Domains: bighappy9xx.github.io\nSite URL: '+SITE+'\nValid OAuth Redirect URI: '+REDIRECT+'\nWebhook Callback URL: '+WEBHOOK);
 if(verifyToken)console.log('Verify Token (chỉ sao chép vào Meta Webhooks, không gửi chat): '+verifyToken);
 else console.log('Verify Token đã tồn tại. Giữ giá trị đã dùng; nếu cần xem để nhập Meta, chạy riêng trong Terminal: firebase functions:secrets:access META_VERIFY_TOKEN --project '+PROJECT);
 console.log('Webhook fields: messages, messaging_postbacks');
 if(auto){
  console.log('Đang triển khai riêng bot tự động autoReplyFacebook…');
  try{await run(tools.binary,['deploy','--project',PROJECT,'--only','functions:autoReplyFacebook','--non-interactive'],{env});}
  catch{throw Error('Phần kết nối Messenger/webhook đã triển khai; riêng bot tự động chưa hoàn tất. Nếu log báo Permission denied while using the Eventarc Service Agent, đợi vài phút rồi chạy: firebase deploy --only functions:autoReplyFacebook --project '+PROJECT+' --non-interactive. Không cần nhập lại App Secret hoặc chạy lại toàn bộ trình cài đặt. Nếu vẫn lỗi, kiểm tra roles/eventarc.serviceAgent cho đúng service agent theo FACEBOOK-CONNECT.md.');}
 }
 console.log((auto?'Đã triển khai autoReplyFacebook với OpenAI; Trang mới vẫn tắt tự động.':'Chưa có OPENAI_API_KEY: phần nhận/gửi thủ công đã triển khai, chưa triển khai autoReplyFacebook.')+'\nSau Verify & Save trên Meta: cập nhật giao diện GitHub Pages, mở Hộp thư → + Fanpage → đăng nhập → chọn Trang → phê duyệt.\nĐây chưa phải xác nhận Meta App Review hoặc kết nối Fanpage thật đã thành công.\n');

}
module.exports={PROJECT,FUNCTIONS,SITE,REDIRECT,WEBHOOK,updateEnv,ensureEncryptionKey,checkApp};
if(require.main===module)main().catch(error=>{console.error('\n'+(error?.message||'Chưa cài đặt được Messenger.'));process.exitCode=1;});
