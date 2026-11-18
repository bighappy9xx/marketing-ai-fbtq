#!/usr/bin/env node
// Publish only the public policy pages and their CSS, never the full app.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {run}=require('./setup-openai.cjs');
const PROJECT='mediafbtq-6e1bb',SITE='mediafbtq-6e1bb-meta',ROOT=path.resolve(__dirname,'..');
async function main(){
 const env={...process.env,PATH:[path.dirname(process.execPath),path.join(os.homedir(),'.local/bin'),process.env.PATH||''].join(path.delimiter)};
 let firebase;for(const dir of env.PATH.split(path.delimiter)){const p=path.join(dir,'firebase');try{fs.accessSync(p,fs.constants.X_OK);firebase=p;break;}catch{}}
 if(!firebase)throw Error('Chưa tìm thấy Firebase CLI.');
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'fbtq-meta-pages-'));
 try{
  const publicDir=path.join(folder,'public');fs.mkdirSync(publicDir);
  for(const file of ['privacy.html','data-deletion.html','terms.html','legal.css'])fs.copyFileSync(path.join(ROOT,file),path.join(publicDir,file));
  const config=path.join(folder,'firebase.json');fs.writeFileSync(config,JSON.stringify({hosting:{site:SITE,public:publicDir,ignore:['.*','**/.*'],redirects:[{source:'/',destination:'/privacy.html',type:302}],headers:[{source:'**',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'public,max-age=300'}]}]}}));
  await run(firebase,['deploy','--only','hosting','--config',config,'--project',PROJECT,'--non-interactive'],{env});
  console.log('Terms of Service: https://'+SITE+'.web.app/terms.html\nPrivacy policy: https://'+SITE+'.web.app/privacy.html\nData deletion instructions: https://'+SITE+'.web.app/data-deletion.html');
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
