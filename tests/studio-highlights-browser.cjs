const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});let page;
 try{
  page=await browser.newPage({viewport:{width:1540,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('https://**/*',r=>r.abort());
  await page.route('https://fbtq.test/**',r=>{
   const url=new URL(r.request().url()),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
   if(url.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
   let body=fs.readFileSync(file);if(url.pathname==='/app.js')body=body.toString()+'\nwindow.__highlightQA={state,creativeStudio,navigate};';
   return r.fulfill({contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream',body});
  });
  await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__highlightQA);
  await page.evaluate(()=>{const {state,navigate}=window.__highlightQA;state.user={uid:'video-qa',name:'Video QA'};document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');navigate('creative-studio');});
  const ready=()=>page.waitForFunction(()=>!document.querySelector('#page-creative-studio').classList.contains('cs-busy'));await ready();await page.locator('#csExpand').click();
  await page.evaluate(async()=>{
   window.__calls=[];window.__hold=false;window.__bad=false;
   const Schema={object:x=>x,array:x=>x,number:()=>({}),string:()=>({})};
   window.__highlightQA.state.firebase={ai:{},appCheck:{},aiMod:{Schema,getGenerativeModel:(_ai,params)=>({generateContent:async input=>{
    window.__calls.push({input,params});if(window.__hold)await new Promise(r=>window.__release=r);
    const request=JSON.parse(input[0]),start=window.__bad?999:request.sourceStart+.5,end=start+5;
    const moment={start,end,hook:'Điều gì xảy ra sau khi đổi màu?',summary:'Khung hình chuyển màu có chuyển động.',reason:'Sự thay đổi tạo tò mò.',title:'Một thay đổi bất ngờ',description:'Xem khoảnh khắc chuyển màu trong video.',hashtags:['#VideoHay','#MeoDungVideo'],transitions:[{at:start,advice:'Cắt thẳng vào chuyển động.'}],music:[{at:start+1,advice:'Nhạc nhẹ, giảm dưới lời thoại.'}],subtitles:[{at:start+2,advice:'Nhấn chữ “bất ngờ”.'}]};
    return{response:{candidates:[{finishReason:'STOP'}],text:()=>JSON.stringify({moments:[moment],note:'Video chỉ đủ một khoảnh khắc trọn ý.'})}};
   }})}};
   // Create a real playable video locally; only the Gemini response is mocked.
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const context=canvas.getContext('2d'),stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
   recorder.ondataavailable=e=>chunks.push(e.data);const ended=new Promise(r=>recorder.onstop=r);let tick=0;const timer=setInterval(()=>{context.fillStyle=tick++%2?'#3050b0':'#c05060';context.fillRect(0,0,320,180);context.fillStyle='white';context.font='22px sans-serif';context.fillText('Video QA '+tick,50,100);},100);
   recorder.start();await new Promise(r=>setTimeout(r,6500));recorder.stop();await ended;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
   const file=new File(chunks,'khoanh-khac.webm',{type:'video/webm'}),dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#csUpload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>window.__highlightQA.creativeStudio.getSnapshot().clips.length===1);await ready();
  const snapshot=()=>page.evaluate(()=>window.__highlightQA.creativeStudio.getSnapshot());const original=(await snapshot()).clips[0];
  await page.locator('#csStudioAI').click();await page.locator('#csHighlightsCount').fill('2');await page.locator('#csHighlightsMin').fill('5');await page.locator('#csHighlightsMax').fill('10');
  await page.locator('[data-highlight-action=analyze]').click();await page.waitForFunction(()=>!document.querySelector('#csHighlightsResult').hidden);
  assert.equal(await page.locator('.cs-highlights-table tbody tr').count(),1);assert.match(await page.locator('#csHighlightsResult').innerText(),/1\/2 khoảnh khắc/);assert.match(await page.locator('#csHighlightsResult').innerText(),/Phụ đề & từ khoá/);
  const calls=await page.evaluate(()=>window.__calls);assert.equal(calls[0].input[1].inlineData.mimeType,'video/webm');assert.ok(calls[0].input[1].inlineData.data.length>100);assert.equal(calls[0].params.generationConfig.responseMimeType,'application/json');
  await page.locator('.cs-highlight-card [data-highlight-action=seek]').click();await page.waitForFunction(()=>Math.abs(window.__highlightQA.creativeStudio.getSnapshot().time-.5)<.02);
  const download=page.waitForEvent('download');await page.locator('[data-highlight-action=csv]').click();assert.match((await download).suggestedFilename(),/\.csv$/);
  // A timeline edit after preview invalidates the cut confirmation.
  await page.locator('[data-highlight-action=split]').click();assert.equal((await snapshot()).clips.length,1);await page.locator('#csAddText').click();await ready();
  const beforeStale=(await snapshot()).clips;await page.locator('[data-highlight-action=confirm]').click();await page.waitForFunction(()=>document.querySelector('#csAIStatus').classList.contains('error'));assert.deepEqual((await snapshot()).clips,beforeStale);
  await page.locator('[data-clip="'+original.id+'"]').click();await page.locator('[data-highlight-action=split]').click();await page.locator('[data-highlight-action=confirm]').click();await ready();
  assert.equal((await snapshot()).clips.filter(c=>c.type==='video').length,3);
  assert.ok(Math.abs((await snapshot()).clips.filter(c=>c.type==='video').reduce((n,c)=>n+c.duration,0)-original.duration)<.001);
  assert.equal((await snapshot()).clips.filter(c=>c.type==='text').length,1);await page.locator('#csUndo').click();await ready();assert.equal((await snapshot()).clips.filter(c=>c.type==='video').length,1);
  await page.locator('[data-clip="'+original.id+'"]').click();await page.evaluate(()=>window.__bad=true);await page.locator('[data-highlight-action=analyze]').click();await page.waitForFunction(()=>document.querySelector('#csAIStatus').classList.contains('error'));assert.equal(await page.locator('#csHighlightsResult').isVisible(),false);
  await page.evaluate(()=>window.__bad=false);await page.locator('[data-highlight-action=analyze]').click();await page.waitForFunction(()=>!document.querySelector('#csHighlightsResult').hidden);
  await page.screenshot({path:'/private/tmp/fbtq-studio-highlights.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>{const p=document.querySelector('.cs-ai-panel').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth+1;}),true);
  await page.evaluate(()=>window.__hold=true);await page.locator('[data-highlight-action=analyze]').click();await page.waitForFunction(()=>window.__release);await page.evaluate(()=>{window.__highlightQA.state.user={uid:'other'};window.__highlightQA.creativeStudio.reset();window.__release();});await page.waitForTimeout(100);assert.equal(await page.locator('#csHighlightsResult').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('Highlights browser passed: real video input, Gemini schema, timeline table, seek, CSV, cut preview/confirm, stale guard, undo, invalid timestamps, mobile and account isolation.');
 }catch(e){if(page)await page.screenshot({path:'/private/tmp/fbtq-studio-highlights-error.png'}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
