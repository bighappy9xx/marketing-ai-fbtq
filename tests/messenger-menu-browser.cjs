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
  const page=await context.newPage();await page.goto('https://fbtq.test');await seed(page);await page.evaluate(()=>window.__inboxQA.state.firebase={});
  assert.deepEqual(await page.locator('.messenger-navigation button:not([role=switch])').allTextContents(),['Hội thoại','AI & kịch bản','Kết nối & đồng bộ','Gửi Tin Nhắn Hàng Loạt']);
  assert.equal(await page.locator('#page-chatbot-settings [data-hub-ai]').count(),0);assert.equal(await page.locator('#page-chatbot-settings [data-hub-connect]').count(),0);
  await page.locator('[data-inbox-menu="0"]').click();assert.equal(await page.locator('#messengerMenu0').isVisible(),true);assert.equal(await page.locator('#messengerMenu0 .glass-settings-card button').count(),3);await page.keyboard.press('Escape');assert.equal(await page.locator('#messengerMenu0').isHidden(),true);assert.equal(await page.locator('[data-inbox-menu="0"]').getAttribute('aria-expanded'),'false');
  await page.locator('[data-inbox-menu="1"]').click();assert.equal(await page.locator('#messengerMenu1').isVisible(),true);await page.locator('.chatbot-search').click();assert.equal(await page.locator('#messengerMenu1').isHidden(),true);
  await page.locator('[data-inbox-menu="1"]').click();await page.locator('[data-hub-connect]').click();await page.waitForSelector('#chatbotFacebookLogin');assert.equal(await page.locator('#messengerMenu1').isHidden(),true);await page.locator('.modal-close').click();
  for(const selector of ['.messenger-topbar','.inbox-filter-rail']){const {bg,accent}=await page.locator(selector).evaluate(el=>({bg:getComputedStyle(el).backgroundImage,accent:getComputedStyle(el).getPropertyValue('--glass-accent-fill').trim().replace(/ +/g,', ')}));assert.match(bg,/linear-gradient/);assert.ok(bg.includes('rgb('+accent+')'));}
  await page.locator('[data-inbox-menu="0"]').click();await page.waitForTimeout(200);await page.screenshot({path:'/private/tmp/fbtq-blue-menu-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);for(const button of await page.locator('.messenger-navigation button').all()){const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);}
  const rect=await page.locator('#messengerMenu0').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=390);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/fbtq-blue-menu-mobile.png',animations:'disabled'});
  await page.evaluate(()=>window.__inboxQA.navigate('chatbot-settings'));assert.equal(await page.locator('#messengerMenu0').isHidden(),true);assert.equal(await page.locator('#page-chatbot-settings .glass-settings-card').count(),1);assert.deepEqual(errors,[]);console.log('PASS moved AI/connection action menus, original actions, dismiss/focus, route cleanup, blue navigation/filter rail and mobile bounds.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
