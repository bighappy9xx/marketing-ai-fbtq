const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();await page.route('https://**/*',r=>r.abort());await page.route('https://fbtq.test/**',r=>{
  const u=new URL(r.request().url()),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(u.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});let body=fs.readFileSync(file);if(u.pathname==='/app.js')body=body.toString()+'\nwindow.__firstFrameQA={state,navigate,creativeStudio};';
  return r.fulfill({body,contentType:({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
 });await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__firstFrameQA);
 const result=await page.evaluate(async()=>{
  const api=await import('/vendor/mediabunny/mediabunny-1.65.2.mjs'),{exportHardware}=await import('/studio-hardware-export.js');
  const target=new api.BufferTarget(),sourceOutput=new api.Output({format:new api.Mp4OutputFormat(),target}),sourceCanvas=document.createElement('canvas');sourceCanvas.width=320;sourceCanvas.height=180;
  const video=new api.CanvasSource(sourceCanvas,{codec:'avc',bitrate:500000,hardwareAcceleration:'prefer-software'}),audio=new api.AudioBufferSource({codec:'aac',bitrate:128000});sourceOutput.addVideoTrack(video,{frameRate:30});sourceOutput.addAudioTrack(audio);await sourceOutput.start();
  const buffer=new AudioBuffer({length:24000,sampleRate:48000,numberOfChannels:2});for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=Math.sin(i/48000*440*2*Math.PI)*.1;}await audio.add(buffer);
  // MP4 with audio from 0s and the first actual video frame at 80ms.
  for(let i=0;i<12;i++){const context=sourceCanvas.getContext('2d');context.fillStyle=i<6?'#e02020':'#2040e0';context.fillRect(0,0,320,180);await video.add(.08+i/30,1/30);}video.close();audio.close();await sourceOutput.finalize();
  const source=new Blob([target.buffer],{type:'video/mp4'}),input=new api.Input({source:new api.BlobSource(source),formats:api.ALL_FORMATS}),track=await input.getPrimaryVideoTrack(),origin=await input.getFirstTimestamp(),firstVideo=await track.getFirstTimestamp(),oldFrame=await new api.CanvasSink(track).getCanvas(Math.max(0,origin));input.dispose();
  const directory=await navigator.storage.getDirectory(),outputs=[];
  for(const selection of [{in:0,duration:.4},{in:.3,duration:.1}]){
   const name='first-frame-'+selection.in+'.mp4',fileHandle=await directory.getFileHandle(name,{create:true}),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;let firstPaint;
   try{const file=await exportHardware({api,clips:[{id:'v',mediaId:'source',type:'video',name:'audio-first.mp4',trackId:'video',start:0,...selection}],tracks:[{id:'video'}],resources:new Map([['source',{blob:source}]]),canvas,fileHandle,mode:'software',paintFrame:(_at,images)=>{const context=canvas.getContext('2d');context.drawImage(images.get('v'),0,0);firstPaint??=[...context.getImageData(100,100,1,1).data];}});
    const final=new api.Input({source:new api.BlobSource(file),formats:api.ALL_FORMATS}),v=await final.getPrimaryVideoTrack(),a=await final.getPrimaryAudioTrack(),decoded=await new api.CanvasSink(v).getCanvas(await v.getFirstTimestamp());outputs.push({selection,size:file.size,duration:await final.computeDuration(),video:!!decoded,audio:!!a,firstPaint});final.dispose();
   }finally{await directory.removeEntry(name);}
  }
  window.__audioFirstSource=source;return {origin,firstVideo,oldFrameWasNull:oldFrame===null,outputs};
 });
 assert.ok(result.firstVideo>result.origin+.05);assert.equal(result.oldFrameWasNull,true,'old zero-second request reproduces missing frame');assert.equal(result.outputs.length,2);
 for(const output of result.outputs){assert.ok(output.size>1000);assert.equal(output.video,true);assert.equal(output.audio,true);assert.ok(Math.abs(output.duration-output.selection.duration)<.06);}
 const first=result.outputs[0].firstPaint,trimmed=result.outputs[1].firstPaint;assert.ok(first[0]>first[2]+100,'first real frame fills the leading gap');assert.ok(trimmed[2]>trimmed[0]+100,'trimmed clip starts at its original source time');
 await page.evaluate(()=>{const q=window.__firstFrameQA;q.state.user={uid:'first-frame-qa',name:'QA'};document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');q.navigate('creative-studio');});
 await page.waitForFunction(()=>!document.querySelector('#page-creative-studio').classList.contains('cs-busy'));
 await page.evaluate(()=>{const dt=new DataTransfer();dt.items.add(new File([window.__audioFirstSource],'audio-first.mp4',{type:'video/mp4'}));const input=document.querySelector('#csUpload');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>window.__firstFrameQA.creativeStudio.getSnapshot().clips.length===1&&!document.querySelector('#page-creative-studio').classList.contains('cs-busy'));
 await page.locator('#csName').fill('First frame Final');await page.locator('#csSendFinal').click();await page.waitForSelector('#page-content-review.active',{timeout:30000});assert.ok(await page.locator('#studioFinalAttachment video').isVisible());assert.equal(await page.locator('#contentReviewTitle').inputValue(),'First frame Final');assert.equal(await page.locator('#contentReviewVideoUrl').isEnabled(),false);
 console.log(JSON.stringify({result:'PASS real H.264/AAC MP4 reproduces the zero-second gap and exports decodable Finals with original trim/audio timing and passes the real Studio → review handoff',...result}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
