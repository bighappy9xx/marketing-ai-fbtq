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
  const page=await context.newPage();await page.goto('https://fbtq.test');await seed(page);
  await page.evaluate(()=>{const q=window.__inboxQA;q.state.firebase={};q.state.inboxThreads=q.state.inboxThreads.slice(0,3);q.state.messages=[{id:'historic-phone',conversationId:'m2',direction:'incoming',message:'Tư vấn giúp tôi, số 0987 654 321'}];q.renderInbox();});
  assert.equal(await page.locator('#page-inbox [data-inbox-sound]').count(),0);assert.equal(await page.locator('#page-inbox .inbox-fanpage-colors').count(),0);assert.equal(await page.locator('[data-inbox-tab=scripts]').count(),0);
  await page.locator('[data-thread-id=m2]').click();await page.locator('[data-thread-flag=starred]').check();await page.waitForFunction(()=>window.__pageCalls.some(c=>c.name==='updateMessengerThreadMetadata'&&c.data.patch.starred));assert.equal(await page.evaluate(()=>window.__inboxQA.state.inboxThreads.find(t=>t.id==='m2').starred),true);
  await page.locator('[data-inbox-filter=labels]').click();await page.locator('[data-filter-field=starred]').selectOption('yes');assert.equal(await page.locator('.conversation').count(),1);assert.equal(await page.locator('.conversation').getAttribute('data-thread-id'),'m2');
  await page.locator('[data-inbox-filter=phone]').click();assert.equal(await page.locator('.conversation').count(),1);
  await page.locator('[data-thread-metadata]').click();await page.locator('[name=phone]').fill('0912 111 222');await page.locator('[name=rating]').selectOption('5');await page.locator('#activeModalForm button[type=submit]').click();await page.locator('[data-action-approve]').click();await page.waitForFunction(()=>window.__pageCalls.some(c=>c.name==='updateMessengerThreadMetadata'&&c.data.patch.rating===5));
  await page.locator('[data-inbox-filter=rating]').click();await page.locator('input[name=rating][value="5"]').click();assert.equal(await page.locator('.conversation').count(),1);
  await page.locator('[data-page=chatbot-settings]').click();assert.equal(await page.locator('#page-chatbot-settings').isVisible(),true);assert.equal(await page.locator('[data-inbox-sound]').isVisible(),true);await page.waitForTimeout(350);await page.screenshot({path:'/private/tmp/fbtq-liquid-settings.png',animations:'disabled'});
  await page.locator('[data-page=inbox]').click();await page.locator('[data-inbox-filter=all]').click();await page.waitForTimeout(350);await page.screenshot({path:'/private/tmp/fbtq-liquid-inbox.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/fbtq-liquid-inbox-mobile.png',animations:'disabled'});assert.deepEqual(errors,[]);console.log('PASS hidden chat controls, main-menu settings, persisted thread flags/contact/rating, matching filters/history phone and responsive glass layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
