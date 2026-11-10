const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage();
  await page.route('https://first-frame.test/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>First frame regression</title>'});
   const file=path.resolve(root,'.'+url.pathname);
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file)});
  });
  await page.goto('https://first-frame.test/');
  const result=await page.evaluate(async()=>{
   const m=await import('/vendor/mediabunny/mediabunny-1.65.2.mjs');
   const {exportHardware}=await import('/studio-hardware-export.js');
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ed1414';ctx.fillRect(0,0,96,64);
   const target=new m.BufferTarget(),output=new m.Output({format:new m.Mp4OutputFormat(),target});
   const video=new m.CanvasSource(canvas,{codec:'avc',bitrate:500000,hardwareAcceleration:'prefer-software'});
   const audio=new m.AudioBufferSource({codec:'aac',bitrate:128000});output.addVideoTrack(video,{frameRate:30});output.addAudioTrack(audio);await output.start();
   const buffer=new AudioBuffer({numberOfChannels:2,length:28800,sampleRate:48000});
   await Promise.all([audio.add(buffer),(async()=>{for(let i=0;i<15;i++)await video.add(.08+i/30,1/30);})()]);
   video.close();audio.close();await output.finalize();
   const sourceBlob=new Blob([target.buffer],{type:'video/mp4'}),source=new m.Input({source:new m.BlobSource(sourceBlob),formats:m.ALL_FORMATS});
   const track=await source.getPrimaryVideoTrack(),origin=Math.max(0,await source.getFirstTimestamp()),first=await track.getFirstTimestamp();
   const missingBeforeFix=await new m.CanvasSink(track).getCanvas(origin)===null;source.dispose();
   const writes=[];let committed=false,painted=0;
   const handle={createWritable:async()=>({write:async({position,data})=>writes.push({position,data:data.slice()}),close:async()=>{committed=true;},abort:async()=>{writes.length=0;}}),getFile:async()=>{
    const data=new Uint8Array(Math.max(0,...writes.map(w=>w.position+w.data.length)));for(const w of writes)data.set(w.data,w.position);return new Blob([data],{type:'video/mp4'});
   }};
   const clip={id:'v',mediaId:'m',type:'video',name:'late-first-frame.mp4',trackId:'base',start:0,duration:.2,in:0,volume:1,opacity:1};
   const final=await exportHardware({clips:[clip],tracks:[{id:'base'}],resources:new Map([['m',{blob:sourceBlob}]]),canvas,fileHandle:handle,mode:'software',paintFrame:async(t,images)=>{painted++;ctx.drawImage(images.get('v'),0,0);}});
   const decoded=new m.Input({source:new m.BlobSource(final),formats:m.ALL_FORMATS}),finalTrack=await decoded.getPrimaryVideoTrack(),frame=await new m.CanvasSink(finalTrack).getCanvas(0);
   const pixel=frame?[...frame.canvas.getContext('2d').getImageData(20,20,1,1).data]:null;
   const finalAudio=!!await decoded.getPrimaryAudioTrack();decoded.dispose();return{origin,first,missingBeforeFix,painted,committed,size:final.size,pixel,finalAudio};
  });
  assert.ok(result.first>result.origin);assert.equal(result.missingBeforeFix,true);assert.equal(result.painted,6);assert.equal(result.committed,true);assert.ok(result.size>1000);assert.ok(result.pixel&&result.pixel[0]>180&&result.pixel[1]<70);assert.equal(result.finalAudio,true);
  console.log('PASS: real MP4 with audio at zero and video at '+result.first+'s reproduced null first frame, exported six frames with audio, and decoded a red frame at output zero.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
