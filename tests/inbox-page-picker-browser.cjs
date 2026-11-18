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
  const page=await context.newPage();await page.goto('https://fbtq.test/');await seed(page);await page.evaluate(()=>{window.__inboxQA.state.firebase={};window.__inboxQA.renderInbox();});
  const rows=()=>page.locator('#page-inbox .conversation'),picker=page.locator('.inbox-page-picker');await picker.locator('summary').click();assert.equal(await picker.locator('[data-page-choice]').count(),2);
  await page.locator('[data-page-choice=p2]').uncheck();assert.equal(await rows().count(),3);assert.ok((await rows().allTextContents()).every(v=>v.includes('FBTQ Care')));
  await page.locator('[data-page-choice=p2]').check();assert.equal(await rows().count(),5);await page.locator('[data-page-choice=p1]').uncheck();assert.equal(await rows().count(),2);await page.locator('[data-thread-id=m2]').click();assert.equal(await page.evaluate(()=>window.__inboxQA.state.activeThread.pageId),'p2');
  await page.reload();await seed(page);await page.evaluate(()=>{window.__inboxQA.state.firebase={};window.__inboxQA.renderInbox();});assert.equal(await rows().count(),2);await picker.locator('summary').click();assert.equal(await page.locator('[data-page-choice=p1]').isChecked(),false);assert.equal(await page.locator('[data-page-choice=p2]').isChecked(),true);
  await page.locator('[data-profile-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-profile-refresh-status]').textContent.includes('Meta giới hạn quyền'));const calls=await page.evaluate(()=>window.__pageCalls.filter(c=>c.name==='refreshMessengerProfiles'));assert.equal(calls.length,1);assert.equal(calls[0].data.pageId,'p2');assert.deepEqual(calls[0].data.threadIds.sort(),['m2','m3']);assert.match(await page.locator('[data-profile-refresh-status]').innerText(),/1 \/ 2/);
  await page.locator('[data-pages-none]').click();assert.equal(await rows().count(),0);assert.ok(await page.locator('#sendReply').isDisabled());await page.locator('[data-pages-all]').click();assert.equal(await rows().count(),5);await page.locator('.chatbot-search').fill('Ngọc');assert.equal(await rows().count(),1);await page.locator('[data-page-choice=p1]').uncheck();assert.equal(await rows().count(),1);await page.locator('#inboxClearFilters').click();assert.equal(await rows().count(),5);
  await page.locator('[data-page-choice=p1]').uncheck();await page.evaluate(()=>{window.__inboxQA.state.user={uid:'other',name:'Other'};window.__inboxQA.renderInbox();});assert.equal(await rows().count(),5);assert.equal(await picker.getAttribute('open'),null);await page.evaluate(()=>{window.__inboxQA.state.user={uid:'manager',name:'QA'};window.__inboxQA.renderInbox();});assert.equal(await rows().count(),2);
  await picker.locator('summary').click();await page.screenshot({path:'/private/tmp/fbtq-page-groups-desktop.png',animations:'disabled'});await page.setViewportSize({width:390,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/private/tmp/fbtq-page-groups-mobile.png',animations:'disabled'});assert.deepEqual(errors,[]);console.log('PASS multi-page checkbox union, individual/all/empty selection, persisted preferences, search intersection, original reply Page, profile refresh scope/status, account isolation and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
