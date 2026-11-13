const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.route('https://fbtq.test/**',r=>{
  const url=new URL(r.request().url()),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(url.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
  let body=fs.readFileSync(file);if(url.pathname==='/app.js')body=body.toString()+'\nwindow.__exportQA={state,navigate};';
  return r.fulfill({body,contentType:({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
 });
 async function enter(){await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__exportQA);await page.evaluate(()=>{const q=window.__exportQA;q.state.user={uid:'encoder-qa',name:'QA'};document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');q.navigate('creative-studio');});await page.waitForFunction(()=>!document.querySelector('#page-creative-studio').classList.contains('cs-busy'));}
 await enter();await page.locator('#csExportSettings summary').click();await page.locator('#csCheckEncoder').click();await page.waitForFunction(()=>document.querySelector('#csEncoderReport').textContent.includes('CPU:'));
 const report=await page.locator('#csEncoderReport').innerText();assert.match(report,/1280 × 720/);assert.match(report,/AAC:/);
 await page.locator('#csEnableHardware').click();await page.waitForFunction(()=>!document.querySelector('#csEnableHardware').disabled);
 const hardware=await page.locator('#csExportEngine').inputValue();assert.equal(hardware,report.includes('phần cứng: được')?'hardware':'auto');
 await page.locator('#csExportEngine').selectOption('software');await enter();assert.equal(await page.locator('#csExportEngine').inputValue(),'software');
 await page.locator('[data-studio-tab=image]').click();await page.waitForFunction(()=>document.querySelector('#csExportSettings').hidden);await page.locator('[data-studio-tab=video]').click();await page.waitForFunction(()=>!document.querySelector('#csExportSettings').hidden);
 // Real WebCodecs/MP4 export into OPFS: no mocked encoder and no server upload.
 const encoded=await page.evaluate(async()=>{
  const {exportHardware}=await import('/studio-hardware-export.js'),dir=await navigator.storage.getDirectory(),handle=await dir.getFileHandle('encoder-qa.mp4',{create:true}),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;let preference;
  try{const file=await exportHardware({clips:[{id:'shape',type:'shape',trackId:'v',start:0,duration:.4}],tracks:[{id:'v'}],resources:new Map(),canvas,fileHandle:handle,mode:'auto',onEncoderSelected:p=>preference=p,paintFrame:t=>{const c=canvas.getContext('2d');c.fillStyle=t<.2?'#347cff':'#ff9234';c.fillRect(0,0,320,180);}});
   const url=URL.createObjectURL(file),video=document.createElement('video');video.src=url;await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(Error('MP4 decode failed'));});const result={size:file.size,width:video.videoWidth,height:video.videoHeight,duration:video.duration,preference};URL.revokeObjectURL(url);video.removeAttribute('src');video.load();return result;
  }finally{await dir.removeEntry('encoder-qa.mp4');}
 });
 assert.ok(encoded.size>500);assert.equal(encoded.width,320);assert.equal(encoded.height,180);assert.ok(Math.abs(encoded.duration-.4)<.1);assert.ok(['prefer-hardware','prefer-software'].includes(encoded.preference));
 await page.locator('#csExportSettings summary').click();await page.screenshot({path:'/private/tmp/fbtq-hardware-export.png'});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS setup, persistence, image/video visibility, actual MP4 encode/decode',report,encoded}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
