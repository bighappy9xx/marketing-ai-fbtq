const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());await page.route('https://fbtq.test/**',r=>{
  const u=new URL(r.request().url()),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(u.pathname==='/firebase-config.js')return r.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
  let body=fs.readFileSync(file);if(u.pathname==='/app.js')body=body.toString()+'\nwindow.__rewriteQA={state,navigate,contentReviewAI,renderContentReviews};';
  return r.fulfill({body,contentType:({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});
 });
 await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__rewriteQA);
 await page.evaluate(()=>{
  const q=window.__rewriteQA;q.state.user={uid:'qa',name:'QA'};q.state.role='director';q.state.banned=['chữa'];window.__rewriteCalls=[];window.__writes=0;window.__holdRewrite=false;window.__proposalText='Khám phá sản phẩm: thông tin sẽ được cập nhật khi sẵn sàng.';
  q.state.firebase={functions:{},db:{},storeMod:{doc:()=>({}),setDoc:async()=>{window.__writes++;},serverTimestamp:()=>({})},funcMod:{httpsCallable:(_f,name)=>async data=>{
   if(name!=='reviewContentAI')throw Error('Unexpected function '+name);window.__rewriteCalls.push(data);
   if(data.action==='improve'){if(window.__holdRewrite)await new Promise(r=>window.__releaseRewrite=r);return {data:{text:window.__proposalText,improvements:['Sửa chính tả và sắp xếp câu rõ ý hơn.','<img src=x onerror=alert(1)> chỉ là văn bản'],companyMatches:[],model:'gpt-6-luna'}};}
   const matches=globalThis.FBTQKeywords.findKeywordMatches(data.text,q.state.banned);return {data:{issues:[],companyMatches:[...new Set(matches.map(m=>m.word))],blocked:matches.length>0}};
  }}};
  document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');q.navigate('content-review');q.contentReviewAI.refresh();
 });
 const input=page.locator('#contentReviewText'),panel=page.locator('.content-review-form-fields > .review-ai-panel'),rewrite=panel.locator('.review-rewrite');
 await input.fill('Chúng tôi chưa công bố.');assert.match(await page.locator('#contentReviewKeywordStatus').innerText(),/chưa có từ khớp/);assert.equal(await panel.locator('[data-ai-preview] mark').count(),0);
 await input.fill('Chúng tôi chưa có dịch vụ chữa bệnh.');await page.waitForFunction(()=>document.querySelector('.content-review-form-fields [data-ai-status]').textContent.includes('Đang chặn'));
 assert.equal(await panel.locator('[data-ai-preview] mark').count(),1);assert.equal(await panel.locator('[data-ai-preview] mark').innerText(),'chữa');await panel.locator('[data-ai-preview] mark').click();assert.equal(await input.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'chữa');
 const original='😀 Sản phẫm chưa có thông tin chi tiết.';await input.fill(original);await rewrite.locator('[data-rewrite-goal]').fill('Câu tự nhiên, giữ các thông tin chính');await rewrite.locator('[data-rewrite-goal]').press('Enter');await page.waitForFunction(()=>!document.querySelector('.content-review-form-fields [data-rewrite-proposal]').hidden);
 assert.equal(await input.inputValue(),original);assert.equal(await rewrite.locator('[data-rewrite-notes] img').count(),0);assert.match(await rewrite.locator('[data-rewrite-notes]').innerText(),/<img/);
 const improved=(await rewrite.locator('[data-rewrite-draft]').inputValue())+' Tìm hiểu thêm.';await rewrite.locator('[data-rewrite-draft]').fill(improved);await page.screenshot({path:'/private/tmp/fbtq-review-rewrite-preview.png',fullPage:true});
 await rewrite.screenshot({path:'/private/tmp/fbtq-content-rewrite-preview.png'});assert.equal(await rewrite.locator('[data-rewrite-notes] img').count(),0);await rewrite.locator('[data-rewrite-apply]').click();assert.equal(await input.inputValue(),improved);assert.ok(await rewrite.locator('[data-rewrite-undo]').isEnabled());assert.equal(await page.evaluate(()=>window.__writes),0);
 await rewrite.locator('[data-rewrite-undo]').click();assert.equal(await input.inputValue(),original);assert.equal(await page.evaluate(()=>window.__writes),0);
 // Cancel leaves the article untouched. Undo after a manual edit requires preview.
 await rewrite.locator('[data-rewrite-start]').click();await rewrite.locator('[data-rewrite-proposal]').waitFor({state:'visible'});await rewrite.locator('[data-rewrite-cancel]').click();assert.equal(await input.inputValue(),original);
 await rewrite.locator('[data-rewrite-start]').click();await rewrite.locator('[data-rewrite-proposal]').waitFor({state:'visible'});await rewrite.locator('[data-rewrite-apply]').click();await input.fill('Nội dung chỉnh tay tiếp theo.');await rewrite.locator('[data-rewrite-undo]').click();assert.equal(await input.inputValue(),'Nội dung chỉnh tay tiếp theo.');assert.equal(await rewrite.locator('[data-rewrite-draft]').inputValue(),original);await rewrite.locator('[data-rewrite-apply]').click();assert.equal(await input.inputValue(),original);
 await page.evaluate(()=>window.__holdRewrite=true);await rewrite.locator('[data-rewrite-start]').click();await page.waitForFunction(()=>!!window.__releaseRewrite);await input.fill('Bản mới khi AI còn chạy.');await page.evaluate(()=>window.__releaseRewrite());await page.waitForFunction(()=>!document.querySelector('.content-review-form-fields [data-rewrite-start]').disabled);assert.equal(await input.inputValue(),'Bản mới khi AI còn chạy.');assert.ok(await rewrite.locator('[data-rewrite-proposal]').isHidden());assert.match(await rewrite.locator('[data-rewrite-status]').innerText(),/thay đổi/);
 await page.evaluate(()=>{window.__holdRewrite=false;window.__rewriteQA.state.user={uid:'other',name:'Other'};window.__rewriteQA.contentReviewAI.clear();});assert.ok(await rewrite.locator('[data-rewrite-undo]').isDisabled());
 // Dynamic manager editors get their own proposal and undo state.
 await page.evaluate(()=>{const q=window.__rewriteQA;q.state.reviews=[{id:'post-1',title:'Bài đang chờ',text:'Bản gửi duyệt gốc.',status:'pending',createdBy:'staff',createdByName:'Nhân viên'}];q.renderContentReviews();});
 const manager=page.locator('[data-review-card="post-1"]'),managerInput=manager.locator('[data-review-manager-text]');await manager.locator('[data-rewrite-start]').click();await manager.locator('[data-rewrite-proposal]').waitFor({state:'visible'});await manager.locator('[data-rewrite-apply]').click();assert.equal(await managerInput.inputValue(),await page.evaluate(()=>window.__proposalText));assert.equal(await input.inputValue(),'Bản mới khi AI còn chạy.');assert.equal(await page.evaluate(()=>window.__rewriteQA.state.reviews[0].text),'Bản gửi duyệt gốc.');assert.equal(await page.evaluate(()=>window.__writes),0);assert.deepEqual(errors,[]);
 console.log('PASS precise chưa/chữa highlighting, editable AI preview, apply/undo/cancel, stale response, no auto submission, account isolation and manager editors.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
