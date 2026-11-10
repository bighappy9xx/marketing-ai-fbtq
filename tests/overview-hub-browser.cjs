const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{channel:'chrome'})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.route('https://fbtq.test/**',route=>{
      const pathname=new URL(route.request().url()).pathname;if(pathname==='/firebase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
      const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.fulfill({status:404,body:''});
      const body=pathname==='/app.js'?fs.readFileSync(target,'utf8')+'\nwindow.__overviewTest={state,workflows,navigate,renderOverviewDashboard,renderSystemNotifications};':fs.readFileSync(target);
      return route.fulfill({contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(target)]||'application/octet-stream',body});
    });
    await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__overviewTest);
    await page.evaluate(()=>{
      const {state,workflows,renderOverviewDashboard}=window.__overviewTest;
      state.user={uid:'director',name:'Giám đốc',branch:'HQ',department:'Điều hành',role:'director'};state.role='director';
      state.users=[state.user,{uid:'a',name:'Nguyễn An',branch:'A',department:'Marketing',role:'employee'},{uid:'b',name:'Trần Bình',branch:'B',department:'Marketing',role:'employee'}];
      state.revenueEntries=[{createdBy:'a',createdByName:'Nguyễn An',revenue:1500000,reportDate:'2026-11-05'},{createdBy:'b',createdByName:'Trần Bình',revenue:2300000,reportDate:'2026-11-06'}];
      state.metrics=[{id:'c1',createdBy:'a',name:'Chiến dịch A',account:'123',spend:100000,results:40,impressions:1000,reach:900,reportStart:'2026-11-01',reportEnd:'2026-11-30'}];
      state.reviews=[{id:'review-a',title:'Nội dung ra mắt sản phẩm',createdBy:'a',createdByName:'Nguyễn An',branch:'A',status:'approved',editHistory:[{action:'approved',actorName:'Trưởng phòng',at:'2026-11-07',note:'Nội dung đã được kiểm tra'}]},{id:'review-b',title:'Bài giới thiệu',createdBy:'b',createdByName:'Trần Bình',branch:'B',status:'pending'}];
      state.workAwardRows=[{uid:'preview',name:'Điểm chưa công bố',score:10,rank:1}];
      const base={kind:'request',createdBy:'a',createdByName:'Nguyễn An',branch:'A',department:'Marketing',date:'2026-11-10',createdAt:'2026-11-08',status:'pending',approvals:{department:{status:'pending'},branch:{status:'pending'}}};
      const data={staffRequests:[{...base,id:'leave-a',type:'leave',title:'Đơn xin nghỉ',sessions:['morning']}],advanceInvoices:[{...base,kind:'advance',id:'advance-a',title:'Tạm ứng',amount:1000000,approvals:{manager:{status:'pending'},accountant:{status:'pending'}}},{...base,kind:'advance',id:'advance-b',createdBy:'b',createdByName:'Trần Bình',branch:'B',status:'approved',amount:2000000,approvals:{manager:{status:'approved'},accountant:{status:'approved'}}}],requests:[],workAwardScores:[{uid:'a',monthKey:'2026-11',name:'Nguyễn An',score:9.5,rank:1},{uid:'b',monthKey:'2026-11',name:'Trần Bình',score:8.5,rank:2}]};
      window.__awardWatchCount=0;
      const s={collection:(_, ...parts)=>parts.at(-1),where:(field,op,value)=>({field,value}),query:(ref,...filters)=>({ref,filters}),onSnapshot:(q,next)=>{if((q.ref||q)==='workAwardScores')window.__awardWatchCount++;queueMicrotask(()=>{const rows=(data[q.ref||q]||[]).filter(r=>(q.filters||[]).every(f=>r[f.field]===f.value));next({docs:rows.map(r=>({id:r.id||r.monthKey+'_'+r.uid,data:()=>r}))});});return()=>{};}};
      state.firebase={db:{},storeMod:s};document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');renderOverviewDashboard();workflows.start();
    });
    await page.waitForSelector('#overviewRankingList .ov-rank-row');await page.waitForSelector('#overviewAwardPodium .ov-award');await page.waitForFunction(()=>document.querySelector('#overviewPendingLeaves').textContent==='1');
    assert.equal(await page.locator('#overviewRankingList .ov-rank-row').count(),2);assert.equal(await page.locator('#overviewRankingList .ov-person b').first().textContent(),'Trần Bình');assert.equal(await page.locator('#overviewPendingReviews').textContent(),'1');
    assert.ok((await page.locator('#overviewLeaveList').textContent()).includes('Nghỉ sáng'));assert.ok((await page.locator('#overviewApprovedFunds').textContent()).includes('2.000.000'));assert.ok((await page.locator('#overviewReviewHistory').textContent()).includes('Trưởng phòng'));assert.ok(!(await page.locator('#overviewAwardPodium').textContent()).includes('Điểm chưa công bố'));
    await page.selectOption('#overviewBranchFilter','a');assert.equal(await page.locator('#overviewRankingList .ov-rank-row').count(),1);assert.ok(!(await page.locator('#overviewAdvanceList').textContent()).includes('Trần Bình'));assert.ok((await page.locator('#overviewAwardPodium').textContent()).includes('Nguyễn An'));assert.equal(await page.locator('#overviewPendingReviews').textContent(),'0');assert.ok((await page.locator('#campaignTable').textContent()).includes('Chiến dịch A'));
    await page.selectOption('#overviewBranchFilter','all');await page.selectOption('#overviewUserFilter','all');assert.equal(await page.locator('#overviewRankingList .ov-rank-row').count(),2);assert.equal(await page.evaluate(()=>window.__awardWatchCount),1);
    await page.locator('[data-overview-go="requests"]').first().click();assert.ok(await page.locator('#page-requests.active').count());await page.evaluate(()=>window.__overviewTest.navigate('overview'));
    if(process.env.FBTQ_SCREENSHOT_DIR){fs.mkdirSync(process.env.FBTQ_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'overview-desktop.png'),fullPage:true,animations:'disabled'});}
    await page.addStyleTag({content:'*{scroll-behavior:auto!important;animation:none!important;transition:none!important}'});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
    if(process.env.FBTQ_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'overview-mobile.png'),fullPage:true,animations:'disabled'});
    await page.locator('#overviewRankingList').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#overviewRankingList .ov-rank-row').first().isVisible());
    if(process.env.FBTQ_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'overview-mobile-ranking.png'),animations:'disabled'});
    await page.locator('#overviewReviewHistory').scrollIntoViewIfNeeded();assert.ok(await page.locator('#overviewReviewHistory .ov-audit-row').first().isVisible());
    if(process.env.FBTQ_SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'overview-mobile-history.png'),animations:'disabled'});
    assert.deepEqual(errors,[]);console.log('PASS: five overview sections, real data, scope filters, published awards only, single subscription, drill-down links and mobile layout.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
