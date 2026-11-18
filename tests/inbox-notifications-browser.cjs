const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1640,height:1000}}),errors=[];
  await context.route('https://**/*',r=>r.abort());
  await context.route('https://fbtq.test/**',r=>{
   const u=new URL(r.request().url()),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
   if(u.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
   let body=fs.readFileSync(file);if(u.pathname==='/app.js')body=body.toString().replace('async function callFunction(name,data,options) {','async function callFunction(name,data,options) {return window.__pageCall(name,data);')+'\nwindow.__inboxQA={state,navigate,renderInbox,openModal};window.__pageCalls=[];window.__pageCall=async(name,data)=>{window.__pageCalls.push({name,data});if(name==="getFacebookPageSelection")return {pages:[]};if(name==="refreshMessengerProfiles")return {results:data.threadIds.map((threadId,i)=>({threadId,status:i===0?"ready":"restricted"}))};return {pages:[],results:[]};};';
   return r.fulfill({body,contentType:({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
  });
  async function seed(page){
   page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.__inboxQA);
   await page.evaluate(()=>{
    const q=window.__inboxQA;q.state.user={uid:'manager',name:'QA'};q.state.role='director';
    q.state.pages=[{pageId:'p1',pageName:'FBTQ Care',mode:'ai'},{pageId:'p2',pageName:'FBTQ Shop',mode:'off'}];
    q.state.users=[{uid:'manager',name:'Quản lý'},{uid:'staff',name:'Nhân viên A'}];q.state.members=[];
    q.state.inboxThreads=[
     {id:'m1',conversationId:'m1',senderName:'Nguyễn Minh Anh',pageId:'p1',pageName:'FBTQ Care',channel:'Messenger',message:'Tư vấn giúp mình qua số 0901 234 567',receivedAt:{seconds:1794891600},aiProcessing:true,needsReply:true,unread:false},
     {id:'m2',conversationId:'m2',senderName:'Trần Bảo Ngọc',pageId:'p2',pageName:'FBTQ Shop',channel:'Messenger',message:'Mình muốn biết thêm về sản phẩm',receivedAt:{seconds:1794895200},assignedToUid:'manager',assignedTeamId:'Tư vấn',humanPaused:true,needsReply:true},
     {id:'m3',conversationId:'m3',senderName:'Lê Hoàng Nam',pageId:'p2',pageName:'FBTQ Shop',channel:'Messenger',message:'Cảm ơn bạn',receivedAt:{seconds:1794888000},botMode:'off',needsReply:false},
     {id:'c1',conversationId:'c1',senderName:'Phạm Hải Yến',pageId:'p1',pageName:'FBTQ Care',channel:'comment',source:'livestream',isLivestream:true,privateReplied:false,orderCreated:true,rating:5,message:'Mình đặt một sản phẩm nhé',receivedAt:{seconds:1794884400}},
     {id:'c2',conversationId:'c2',senderName:'Đặng Văn An',pageId:'p1',pageName:'FBTQ Care',channel:'comment',source:'post',privateReplied:true,assignedToUid:'staff',assignedTeamId:'Chăm sóc',message:'Thông tin rất hữu ích',receivedAt:{seconds:1794880800}},
    ];q.state.messages=[];
    document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');q.navigate('inbox');q.renderInbox();
   });
  }
  await context.addInitScript(()=>{window.__tones=0;window.AudioContext=class{state='suspended';currentTime=0;destination={};resume(){this.state='running';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},start(){window.__tones++;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}};});
  const page=await context.newPage();await page.goto('https://fbtq.test');await seed(page);
  async function clickSound(){await page.evaluate(()=>window.__inboxQA.navigate('chatbot-settings'));await page.locator('[data-inbox-sound]').click();await page.evaluate(()=>window.__inboxQA.navigate('inbox'));}
  await clickSound();assert.equal(await page.evaluate(()=>window.__tones),2);
  const incoming=async(id,extra={})=>page.evaluate(({id,extra})=>{const s=window.__inboxQA.state;s.inboxNotifyMessages([{id,ownerUid:'manager',pageId:'p1',direction:'incoming',source:'meta_webhook',createdAt:Date.now(),...extra}]);},{id,extra});
  await incoming('baseline');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tones),2);
  await incoming('fresh');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tones),4);
  await incoming('fresh');await incoming('old',{historical:true,createdAt:Date.now()-100000});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tones),4);
  await page.evaluate(()=>{window.__inboxQA.navigate('overview');const s=window.__inboxQA.state;s.inboxSelectedPageIds=[];s.inboxNotifyMessages(['burst1','burst2','burst3'].map((id,i)=>({id,ownerUid:'manager',pageId:i?'p2':'p1',direction:'incoming',source:'meta_webhook',createdAt:Date.now()})));});await page.waitForTimeout(850);assert.equal(await page.evaluate(()=>window.__tones),10);
  await incoming('synced',{source:'meta_history',historical:true});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__tones),12);
  await page.evaluate(()=>window.__inboxQA.navigate('inbox'));await clickSound();await incoming('muted');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tones),12);
  assert.equal(await page.evaluate(()=>localStorage.getItem('fbtq_inbox_sound_v1_manager')),'off');
  await page.locator('.inbox-page-picker summary').click();await page.locator('.inbox-page-picker [data-page-color="p1"]').fill('#12abcd');
  await page.waitForFunction(()=>window.__pageCalls.some(c=>c.name==='setMessengerPageColor'));
  const call=await page.evaluate(()=>window.__pageCalls.find(c=>c.name==='setMessengerPageColor'));assert.deepEqual(call.data,{pageId:'p1',color:'#12abcd'});
  assert.equal(await page.locator('.conversation[data-page-id=p1]').first().evaluate(el=>el.style.getPropertyValue('--fanpage-color')),'#12ABCD');
  assert.notEqual(await page.locator('.conversation[data-page-id=p2]').first().evaluate(el=>el.style.getPropertyValue('--fanpage-color')),'#12ABCD');
  const stripe=await page.locator('.conversation[data-page-id=p1]').first().evaluate(el=>getComputedStyle(el,'::before').backgroundColor);assert.equal(stripe,'rgb(18, 171, 205)');
  await page.locator('[data-page-color-reset="p1"]').click();await page.waitForFunction(()=>window.__pageCalls.some(c=>c.name==='setMessengerPageColor'&&c.data.color===''));
  await page.evaluate(()=>{const s=window.__inboxQA.state;s.user={uid:'other'};s.inboxSoundRefresh();s.inboxNotifyMessages([{id:'other-baseline',ownerUid:'other',pageId:'p1',direction:'incoming',source:'meta_webhook',createdAt:Date.now()}]);});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tones),12);assert.equal(await page.locator('[data-inbox-sound]').getAttribute('aria-pressed'),'false');await page.evaluate(()=>{const s=window.__inboxQA.state;s.user={uid:'manager'};s.inboxSoundRefresh();});
  await page.screenshot({path:'/private/tmp/fbtq-inbox-notices-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/fbtq-inbox-notices-mobile.png',animations:'disabled'});
  assert.deepEqual(errors,[]);console.log('PASS all-Page sound despite filters, each burst message, fresh synced arrivals, sound unlock, fresh-only chime, mute preference, custom Fanpage colors, reset and responsive layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
