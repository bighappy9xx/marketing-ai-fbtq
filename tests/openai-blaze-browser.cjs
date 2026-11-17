const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('https://**/*',r=>r.abort());await page.route('https://fbtq.test/**',r=>{
  const u=new URL(r.request().url()),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(u.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
  let body=fs.readFileSync(file);if(u.pathname==='/app.js')body=body.toString()+'\nwindow.__openAIQA={state,navigate,creativeStudio,generateFbtqAssistantReply};';
  return r.fulfill({body,contentType:({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.md':'text/plain'})[path.extname(file)]||'application/octet-stream'});
 });
 await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__openAIQA);
 await page.evaluate(()=>{
  const q=window.__openAIQA;q.state.user={uid:'qa',name:'QA'};q.state.role='director';q.state.banned=['cam kết'];window.__calls=[];window.__failOpenAI=false;
  q.state.firebase={app:{options:{projectId:'mediafbtq-6e1bb'}},functions:{},db:{},storeMod:{doc:()=>({}),setDoc:async()=>{},serverTimestamp:()=>({})},funcMod:{httpsCallable:(_functions,name,opts)=>async data=>{
   window.__calls.push({name,data,opts});if(window.__failOpenAI)throw Error('OpenAI API key không hợp lệ.');
   const moment={start:.2,end:5.2,hook:'Một thay đổi',summary:'Ảnh mẫu chuyển màu',reason:'Gây tò mò',title:'Thay đổi màu sắc',description:'Đoạn mẫu dùng để kiểm tra giao diện',hashtags:['#Video'],transitions:[],music:[],subtitles:[]};
   if(name==='checkOpenAIConnection')return {data:{connected:true,model:'gpt-6-luna'}};
   if(name==='generateContentOpenAI'||name==='askAssistantOpenai')return {data:{content:'Nội dung OpenAI thử nghiệm',provider:'openai'}};
   if(name==='reviewContentAI'){const start=data.text.indexOf('cam kết');return {data:{issues:start<0?[]:[{start,end:start+7,quote:'cam kết',type:'banned',reason:'Từ cấm của công ty',replacement:''}],companyMatches:start<0?[]:['cam kết'],blocked:start>=0,model:'gpt-6-luna'}};}
   if(name==='getStudioAISetup')return {data:{configured:true,imageModel:'gpt-image-2.6-flare',transcriptionModel:'whisper-1'}};
   if(name==='generateStudioImage'){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);return {data:{base64:canvas.toDataURL('image/jpeg').split(',')[1],mimeType:'image/jpeg',model:'gpt-image-2.6-flare'}};}
   if(name==='transcribeStudioAudio')return {data:{segments:[{start:.2,end:5.2,text:'Lời thoại thử nghiệm'}],words:[],duration:data.duration,model:'whisper-1'}};
   if(name==='analyzeStudioHighlightsOpenAI')return {data:{note:'Dựa trên ảnh mẫu và lời thoại.',moments:[moment],model:'gpt-6-luna'}};
   throw Error('Unexpected callable '+name);
  }}};
  document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');q.navigate('settings');
 });
 await page.locator('[data-setting=ai]').click();assert.equal(await page.locator('#defaultModel').inputValue(),'openai');
 await page.locator('#setupOpenAIAPI').click();assert.match(await page.locator('.openai-setup-guide').innerText(),/functions:secrets:set OPENAI_API_KEY/);assert.equal(await page.locator('.openai-setup-guide input').count(),0);await page.locator('.modal-close').click();
 await page.locator('#checkOpenAIConnection').click();await page.waitForFunction(()=>document.querySelector('#openAIConnectionStatus').textContent.includes('Đã kết nối OpenAI'));
 await page.locator('#saveAiSettings').click();assert.match(await page.locator('#aiConfigStatus').innerText(),/OpenAI/);
 await page.screenshot({path:'/private/tmp/fbtq-openai-settings.png'});
 await page.evaluate(()=>window.__openAIQA.navigate('content'));await page.locator('#contentPrompt').fill('Viết bài giới thiệu sản phẩm');await page.locator('#generateContent').click();await page.waitForFunction(()=>document.querySelector('#resultPanel').textContent.includes('Nội dung OpenAI thử nghiệm'));
 assert.match(await page.evaluate(()=>window.__openAIQA.generateFbtqAssistantReply('Giải thích CPM')),/OpenAI/);
 await page.evaluate(()=>window.__openAIQA.navigate('content-review'));await page.locator('#contentReviewText').fill('Nội dung có cam kết cần sửa.');await page.waitForFunction(()=>window.__calls.some(c=>c.name==='reviewContentAI'));
 await page.waitForFunction(()=>document.querySelector('[data-ai-status]').textContent.includes('Đang chặn'));assert.ok(await page.locator('[data-ai-preview] mark').count()>0);
 await page.evaluate(()=>window.__openAIQA.navigate('creative-studio'));const ready=()=>page.waitForFunction(()=>!document.querySelector('#page-creative-studio').classList.contains('cs-busy'));await ready();await page.locator('#csStudioAI').click();await page.locator('.cs-ai-legacy summary').click();await page.locator('[data-ai-action=setup]').click();await page.waitForFunction(()=>document.querySelector('#csAIStatus').textContent.includes('Đã khai báo secret OpenAI'));
 await page.locator('[data-ai-action=close]').click();
 // Exercise real compression, image sampling and WAV extraction without calling a provider.
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(10),audio=new AudioContext(),out=audio.createMediaStreamDestination(),osc=audio.createOscillator();osc.connect(out);osc.start();await audio.resume();stream.addTrack(out.stream.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(r=>recorder.onstop=r);let i=0;const timer=setInterval(()=>{ctx.fillStyle=i++%2?'#326acc':'#6633bb';ctx.fillRect(0,0,320,180);},100);
  recorder.start();await new Promise(r=>setTimeout(r,6200));recorder.stop();await stopped;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());osc.stop();await audio.close();
  const dt=new DataTransfer();dt.items.add(new File(chunks,'openai-qa.webm',{type:'video/webm'}));const input=document.querySelector('#csUpload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>window.__openAIQA.creativeStudio.getSnapshot().clips.length===1);await ready();await page.locator('#csStudioAI').click();await page.locator('#csHighlightsMin').fill('5');await page.locator('#csHighlightsMax').fill('10');await page.locator('[data-highlight-action=analyze]').click();
 await page.waitForFunction(()=>!document.querySelector('#csHighlightsResult').hidden,{},{timeout:60000});assert.equal(await page.locator('.cs-highlights-table tbody tr').count(),1);
 const calls=await page.evaluate(()=>window.__calls),video=calls.find(c=>c.name==='analyzeStudioHighlightsOpenAI'),speech=calls.find(c=>c.name==='transcribeStudioAudio');assert.equal(video.data.frames.length,8);assert.ok(video.data.frames.every(f=>f.base64.startsWith('/9j/')));assert.ok(speech.data.base64.startsWith('UklGR'));assert.ok(video.data.segments.length>0);assert.equal(video.data.blob,undefined);
 await page.locator('[data-ai-action=close]').click();await page.locator('[data-studio-tab=image]').click();await ready();await page.locator('#csStudioAI').click();await page.locator('#csAIImagePrompt').fill('Một khung ảnh xanh đơn giản');await page.locator('[data-ai-action=generate]').click();await page.waitForFunction(()=>!document.querySelector('#csAIImageResult').hidden);await page.waitForFunction(()=>{const img=document.querySelector('#csAIImageResult img');return img.complete&&img.naturalWidth>0;});
 await page.locator('[data-ai-action=close]').click();await page.evaluate(()=>{window.__failOpenAI=true;window.__openAIQA.navigate('content');});await page.locator('#generateContent').click();await page.waitForFunction(()=>document.querySelector('#resultPanel').textContent.includes('OPENAI_API_KEY'));assert.ok(await page.locator('#generateContent').isEnabled());
 assert.deepEqual(errors,[]);console.log('PASS OpenAI settings/secret guide, content, assistant, red review marks, real video compression/sample frames/WAV, timeline plan, image generation and failure recovery.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
