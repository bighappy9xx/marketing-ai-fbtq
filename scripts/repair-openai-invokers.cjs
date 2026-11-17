#!/usr/bin/env node
// Firebase callable authentication is enforced in the handlers. Their HTTP
// transport must accept browser OPTIONS requests before a Firebase token exists.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {PROJECT,FUNCTIONS}=require('./setup-openai.cjs');
function loadTools(){
 const dirs=[path.join(os.homedir(),'.local/bin'),...(process.env.PATH||'').split(path.delimiter)];
 for(const dir of dirs){try{const binary=fs.realpathSync(path.join(dir,'firebase')),root=path.resolve(path.dirname(binary),'../..');if(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).name==='firebase-tools')return {cli:require(root),run:require(path.join(root,'lib/gcp/run.js'))};}catch{}}
 throw Error('Không tìm thấy Firebase CLI đã cài.');
}
function browserPolicy(policy){
 const next=structuredClone(policy);next.version=3;next.bindings??=[];
 if(next.bindings.some(b=>b.role==='roles/run.invoker'&&!b.condition&&b.members?.includes('allUsers')))return null;
 const binding=next.bindings.find(b=>b.role==='roles/run.invoker'&&!b.condition);
 if(binding)binding.members=[...new Set([...(binding.members||[]),'allUsers'])];
 else next.bindings.push({role:'roles/run.invoker',members:['allUsers']});
 return next;
}
async function repair({cli,run}=loadTools()){
 // Use the CLI's normal authenticated API. Never read or print credential files.
 const functions=await cli.functions.list({project:PROJECT,nonInteractive:true});
 const rows=Array.isArray(functions)?functions:functions?.result;
 if(!Array.isArray(rows))throw Error('Không đọc được danh sách Functions.');
 for(const name of FUNCTIONS){
  const fn=rows.find(f=>f.id===name&&f.region==='us-central1'&&f.platform==='gcfv2'&&f.callableTrigger);
  if(!fn?.runServiceId)throw Error('Chưa có callable đã triển khai: '+name);
  const service=`projects/${PROJECT}/locations/us-central1/services/${fn.runServiceId}`;
  const current=await run.getIamPolicy(service),next=browserPolicy(current);
  if(next)await run.setIamPolicy(service,next);
  const verified=await run.getIamPolicy(service);
  if(browserPolicy(verified)!==null)throw Error('Chưa sửa được HTTP invoker: '+name);
  console.log(name+': browser transport OK; Firebase Auth remains required.');
 }
}
module.exports={browserPolicy,repair};
if(require.main===module)repair().catch(error=>{console.error(error.message||'Chưa sửa được quyền gọi Functions.');process.exitCode=1;});
