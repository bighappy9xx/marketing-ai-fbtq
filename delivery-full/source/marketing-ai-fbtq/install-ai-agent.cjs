// Run from the project root after copying the two new functions modules.
// Adds registration without replacing an existing functions/index.js.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'functions','index.js');if(!fs.existsSync(file))throw Error('Chạy trong thư mục dự án có functions/index.js.');
let source=fs.readFileSync(file,'utf8');
const names=['onCall','HttpsError','requireSignedIn','generateWithProvider','GEMINI_API_KEY','OPENAI_API_KEY','ANTHROPIC_API_KEY'];
for(const name of names)if(!new RegExp('\\b'+name+'\\b').test(source))throw Error('index.js chưa có '+name+'. Giữ nguyên tệp và kiểm tra phiên bản trước khi tích hợp.');
for(const name of ['assistant-agent.js','agent-core.js'])if(!fs.existsSync(path.join(__dirname,'functions',name)))throw Error('Thiếu functions/'+name);
if(source.includes("require('./assistant-agent')")||source.includes('require("./assistant-agent")')){console.log('Đã có đăng ký AI Agent, không thêm trùng.');process.exit(0);}
const backup=file+'.before-ai-agent';if(!fs.existsSync(backup))fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
source+="\nObject.assign(exports,require('./assistant-agent').registerAssistantAgent({onCall,HttpsError,requireSignedIn,generateWithProvider,GEMINI_API_KEY,OPENAI_API_KEY,ANTHROPIC_API_KEY}));\n";
fs.writeFileSync(file,source);console.log('Đã tích hợp AI Agent; bản sao lưu giữ tại functions/index.js.before-ai-agent.');
