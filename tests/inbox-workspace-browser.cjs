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
   let body=fs.readFileSync(file);if(u.pathname==='/app.js')body=body.toString()+'\nwindow.__inboxQA={state,navigate,renderInbox,openModal};';
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
  const page=await context.newPage();await page.goto('https://fbtq.test/');await seed(page);
  const rail=id=>page.locator(`[data-inbox-filter="${id}"]`);
  const rows=()=>page.locator('#page-inbox .conversation');
  const reset=()=>rail('all').click();
  const choice=async(id,field,value)=>{await rail(id).click();await page.locator(`#inboxFilterPopover input[name="${field}"][value="${value}"]`).click();};
  assert.equal(await page.locator('.inbox-filter-rail button').count(),11);assert.equal(await rows().count(),5);
  await choice('comment','comment','all');assert.equal(await rows().count(),2);
  await choice('comment','comment','no_private');assert.equal(await rows().count(),1);assert.equal(await rows().first().getAttribute('data-thread-id'),'c1');
  await choice('message','ai','processing');assert.equal(await rows().first().getAttribute('data-thread-id'),'m1');
  await choice('message','ai','off');assert.equal(await rows().first().getAttribute('data-thread-id'),'m3');
  await choice('message','ai','forwarded');assert.equal(await rows().first().getAttribute('data-thread-id'),'m2');
  await reset();await rail('phone').click();assert.equal(await rows().count(),1);
  await rail('no_phone').click();assert.equal(await rows().count(),4);
  await reset();await choice('rating','rating','5');assert.equal(await rows().first().getAttribute('data-thread-id'),'c1');
  await reset();await choice('reply','reply','read_unanswered');assert.equal(await rows().first().getAttribute('data-thread-id'),'m1');
  await reset();await rail('source').click();await page.locator('[data-filter-field=page]').selectOption('p2');assert.equal(await rows().count(),2);
  await rail('assignee').click();await page.locator('[data-filter-field=assignee]').selectOption('me');assert.equal(await rows().count(),1);
  await rail('assignee').click();await page.locator('[data-filter-field=team]').selectOption('Tư vấn');assert.equal(await rows().count(),1);
  await page.evaluate(()=>window.__inboxQA.renderInbox());assert.equal(await rows().count(),1);
  await reset();await rail('date').click();await page.locator('#inboxFilterFrom').fill('2026-11-18');await page.locator('#inboxFilterTo').fill('2026-11-17');await page.locator('[data-filter-dates]').click();assert.match(await page.locator('#inboxFilterDateError').innerText(),/Ngày kết thúc/);
  await page.locator('#inboxFilterFrom').fill('2026-11-17');await page.locator('[data-filter-dates]').click();assert.equal(await rows().count(),5);
  await reset();await page.locator('.chatbot-search').fill('dang van');assert.equal(await rows().count(),1);assert.equal(await rows().first().getAttribute('data-thread-id'),'c2');
  await page.locator('#replyInput').fill('Nháp thử nghiệm');await page.locator('.chatbot-search').fill('khong khop');assert.equal(await rows().count(),0);assert.ok(await page.locator('#sendReply').isDisabled());assert.equal(await page.locator('#replyInput').inputValue(),'');assert.match(await page.locator('#chatBody').innerText(),/khớp bộ lọc/);
  await reset();await rail('date').click();await page.keyboard.press('Escape');assert.ok(await page.locator('#inboxFilterPopover').isHidden());
  await page.screenshot({path:'/private/tmp/fbtq-inbox-normal.png'});
  await page.locator('#inboxExpand').click();assert.ok(await page.locator('#page-inbox').evaluate(el=>el.classList.contains('inbox-expanded')));
  await page.screenshot({path:'/private/tmp/fbtq-inbox-expanded.png'});await rail('message').click();await page.screenshot({path:'/private/tmp/fbtq-inbox-filter.png'});await page.keyboard.press('Escape');await page.evaluate(()=>window.__inboxQA.openModal('Kiểm tra hộp thoại','<p>Cấu hình hộp thư</p>','',null));await page.locator('#modalRoot .modal-close').click();
  async function bounds(){return page.evaluate(()=>{const l=document.querySelector('#page-inbox .inbox-layout'),c=document.querySelector('.conversation-view'),r=l.getBoundingClientRect(),cr=c.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,layoutOverflow:l.scrollWidth>l.clientWidth+1,inside:cr.right<=r.right+1&&cr.bottom<=r.bottom+1&&cr.left>=r.left};});}
  assert.deepEqual(await bounds(),{overflow:false,layoutOverflow:false,inside:true});
  await rail('message').click();const box=await page.locator('#inboxFilterPopover').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1640&&box.y>=0&&box.y+box.height<=1000);await page.keyboard.press('Escape');
  await page.locator('.messenger-exit-expanded').click();const [tab]=await Promise.all([context.waitForEvent('page'),page.locator('#inboxOpenExpandedTab').click()]);await tab.waitForLoadState();assert.equal(new URL(tab.url()).search,'?inbox=expanded');assert.equal(new URL(tab.url()).hash,'#inbox');await seed(tab);await tab.waitForFunction(()=>document.querySelector('#page-inbox').classList.contains('inbox-expanded'));assert.equal(await tab.locator('.inbox-filter-rail button').count(),11);await tab.close();await page.locator('#inboxExpand').click();
  for(const width of [1024,768,390]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);assert.deepEqual(await bounds(),{overflow:false,layoutOverflow:false,inside:true});}
  assert.equal(await rows().filter({visible:true}).count(),5);
  await page.screenshot({path:'/private/tmp/fbtq-inbox-mobile.png'});
  await page.locator('.messenger-exit-expanded').click();assert.ok(await page.locator('body').evaluate(el=>!el.classList.contains('inbox-immersive')));
  await page.locator('#inboxExpand').click();await page.evaluate(()=>window.__inboxQA.navigate('overview'));await page.waitForFunction(()=>!document.body.classList.contains('inbox-immersive'));
  await page.evaluate(()=>window.__inboxQA.navigate('inbox'));await page.locator('.chatbot-search').fill('Ngọc');await page.evaluate(()=>{window.__inboxQA.state.user={uid:'other'};window.__inboxQA.renderInbox();});assert.equal(await page.locator('.chatbot-search').inputValue(),'');
  assert.deepEqual(errors,[]);console.log('PASS inbox filter UI, empty/draft safety, expansion, new tab, responsive bounds, route changes and account reset.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
