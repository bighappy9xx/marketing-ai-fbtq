const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());
    await page.route('https://fbtq.test/**',route=>{
      const url=new URL(route.request().url()),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(url.pathname==='/firebase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      let body=fs.readFileSync(file);
      if(url.pathname==='/app.js')body=body.toString()+`
        window.__reviewQA={state,navigate,renderContentReviews,generateFbtqAssistantReply,writes:[],calls:0,delay:0};
        const schema={object:value=>value,array:value=>value,string:()=>({}),integer:()=>({}),enumString:value=>value};
        window.__reviewQA.firebase={appCheck:{},ai:{},aiMod:{Schema:schema,getGenerativeModel:(_ai,params)=>({generateContent:async prompt=>{
          const qa=window.__reviewQA;qa.calls++;if(qa.delay)await new Promise(r=>setTimeout(r,qa.delay));
          const data=JSON.parse(prompt);let output;
          if(data.question)output='Trợ lý đang dùng Firebase AI Logic.';
          else{const issues=[];for(const [quote,type,replacement]of [['cam kết khỏi','banned','hỗ trợ chăm sóc'],['phẫm','spelling','phẩm']]){if(data.article.includes(quote))issues.push({quote,occurrence:1,type,replacement,reason:type==='banned'?'Cam kết tuyệt đối.':'Sai dấu.'});}output=JSON.stringify({issues});}
          return {response:{candidates:[{finishReason:'STOP'}],text:()=>output}};
        }})},storeMod:{doc:()=>({}),getDocFromServer:async()=>({exists:()=>true,data:()=>({banned:[]})})}};
        callFunction=async name=>{throw Error('Unexpected Cloud Function '+name);};
        saveRecord=async(collection,data,id)=>{window.__reviewQA.writes.push({collection,data,id});return id;};
      `;
      return route.fulfill({contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'})[path.extname(file)]||'application/octet-stream',body});
    });
    await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__reviewQA);
    await page.evaluate(()=>{const qa=window.__reviewQA;qa.state.user={uid:'qa',name:'Quản lý QA'};qa.state.role='director';qa.state.firebase=qa.firebase;document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');qa.navigate('content-review');});
    assert.equal(await page.evaluate(async()=>{localStorage.setItem('fbtq_assistant_provider','gemini');return window.__reviewQA.generateFbtqAssistantReply('Xin chào');}),'Trợ lý đang dùng Firebase AI Logic.');
    const input=page.locator('#contentReviewText'),panel=page.locator('.content-review-form-fields > .review-ai-panel');
    const submitForm=async()=>{await page.locator('#contentReviewForm button[type=submit]').click();await page.locator('#assistantActionApproval [data-action-approve]').click();await page.waitForFunction(()=>!document.querySelector('#contentReviewForm button[type=submit]').disabled);};
    await input.fill('Sản phẫm cam kết khỏi.');await panel.locator('[data-ai-check]').click();
    await page.waitForFunction(()=>document.querySelector('.content-review-form-fields [data-ai-status]').textContent.includes('Đang chặn'));
    assert.equal(await panel.locator('mark').count(),2);
    await panel.locator('mark').filter({hasText:'phẫm'}).click();
    assert.equal(await input.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'phẫm');
    await page.locator('#contentReviewTitle').fill('Kiểm tra quảng cáo');await page.locator('#contentReviewVideoUrl').fill('https://drive.google.com/file/d/1234567890abc/view');
    await submitForm();assert.equal(await page.evaluate(()=>window.__reviewQA.writes.length),0);
    await panel.locator('li').filter({hasText:'Chính tả'}).locator('[data-ai-fix]').click();assert.equal(await input.inputValue(),'Sản phẩm cam kết khỏi.');
    assert.equal(await panel.locator('[data-ai-status]').textContent().then(s=>s.includes('Đã kiểm tra AI')),false);
    await panel.locator('[data-ai-check]').click();await page.waitForFunction(()=>!!document.querySelector('.content-review-form-fields [data-ai-fix]'));
    await panel.locator('[data-ai-fix]').click();assert.equal(await input.inputValue(),'Sản phẩm hỗ trợ chăm sóc.');
    await submitForm();await page.waitForFunction(()=>window.__reviewQA.writes.length===1);
    assert.equal((await page.evaluate(()=>window.__reviewQA.writes[0].data.text)),'Sản phẩm hỗ trợ chăm sóc.');
    // Fail closed when OpenAI is unavailable; leave the text and submit button usable.
    await page.evaluate(()=>window.__reviewQA.state.firebase.appCheck=null);await input.fill('Nội dung khác chưa kiểm tra.');await page.locator('#contentReviewTitle').fill('Bài mới');await page.locator('#contentReviewVideoUrl').fill('https://drive.google.com/file/d/1234567890abc/view');
    await submitForm();await page.waitForFunction(()=>document.querySelector('.content-review-form-fields [data-ai-status]').textContent.includes('App Check'));
    assert.equal(await page.evaluate(()=>window.__reviewQA.writes.length),1);assert.equal(await page.locator('#contentReviewForm button[type=submit]').isEnabled(),true);
    // Stale results must not paint or approve a newer draft.
    await page.evaluate(()=>{window.__reviewQA.state.firebase.appCheck={};window.__reviewQA.delay=300;});await input.fill('cam kết khỏi');await panel.locator('[data-ai-check]').click();await input.fill('Bản mới chưa phân tích');
    await page.waitForTimeout(500);assert.equal(await panel.locator('mark').count(),0);assert.equal(await panel.locator('[data-ai-status]').textContent().then(s=>s.includes('Đã kiểm tra AI')),false);
    await page.evaluate(()=>window.__reviewQA.delay=0);
    // Manager editors use the same red marks and cannot approve a banned draft.
    await page.evaluate(()=>{const qa=window.__reviewQA;qa.state.reviews=[{id:'review-qa',title:'Bài đang duyệt',text:'Sản phẫm cam kết khỏi.',status:'pending',createdBy:'staff',createdByName:'Nhân viên',videoUrl:'https://drive.google.com/file/d/1234567890abc/view'}];qa.renderContentReviews();});
    const card=page.locator('[data-review-card="review-qa"]');await card.locator('[data-review-action=approve]').click();await page.waitForFunction(()=>document.querySelector('[data-review-card="review-qa"] [data-ai-status]').textContent.includes('Đang chặn'));
    assert.equal(await page.evaluate(()=>window.__reviewQA.writes.length),1);assert.equal(await card.locator('[data-review-action=approve]').isEnabled(),true);
    // Owners can revise in the same editor; banned text cannot be resubmitted.
    await page.evaluate(()=>{const qa=window.__reviewQA;qa.state.user={uid:'staff',name:'Nhân viên'};qa.state.role='employee';qa.state.reviews[0].status='revision_requested';qa.renderContentReviews();});
    await card.locator('[data-review-save-owner]').click();await page.waitForFunction(()=>document.querySelector('[data-review-card="review-qa"] [data-ai-status]').textContent.includes('Đang chặn'));
    assert.equal(await page.evaluate(()=>window.__reviewQA.writes.length),1);
    await card.locator('[data-review-owner-text]').fill('Nội dung đã chỉnh sửa.');await card.locator('[data-review-save-owner]').click();await page.waitForFunction(()=>window.__reviewQA.writes.length===2);
    assert.equal(await page.evaluate(()=>window.__reviewQA.writes[1].data.status),'pending');
    await input.fill('Sản phẫm cam kết khỏi.');await panel.locator('[data-ai-check]').click();await page.waitForFunction(()=>document.querySelector('.content-review-form-fields [data-ai-status]').textContent.includes('Đang chặn'));
    await page.screenshot({path:process.env.REVIEW_AI_SCREENSHOT||'/private/tmp/fbtq-content-review-ai.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
    assert.deepEqual(errors,[]);console.log('Firebase AI Logic browser passed: red phrases, exact selection, fixes, submit/approval blocking, unavailable API, stale results and mobile layout.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
