// Headless UI test with local fixtures only; never connects to the production Firebase project.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{channel:'chrome'})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.route('https://fbtq.test/**',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/firebase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
      const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.fulfill({status:404,body:''});
      const contentType=({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(target)]||'application/octet-stream';
      const body=pathname==='/app.js'?fs.readFileSync(target,'utf8')+'\nwindow.__workflowTest={state,workflows,navigate};':fs.readFileSync(target);
      return route.fulfill({contentType,body});
    });
    await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__workflowTest);
    await page.evaluate(()=>{
      const {state,workflows}=window.__workflowTest;
      const employee={uid:'employee',name:'Nguyễn Minh Anh',role:'employee',branch:'Tuyên Quang',department:'Marketing'};
      state.user=employee;state.role='employee';state.users=[employee,{uid:'manager',name:'Quản lý chi nhánh',role:'branch_manager',branch:'Tuyên Quang',department:'Marketing'}];
      window.__calls=[];
      const base={createdBy:'employee',createdByName:employee.name,branch:employee.branch,department:employee.department,createdAt:'2026-11-06T08:00:00Z',date:'2026-11-06',description:'Ngân sách quảng cáo tháng 11',history:[{action:'submitted',actorName:employee.name,at:'2026-11-06T08:00:00Z'}]};
      window.__fixtures={advanceInvoices:[{...base,id:'advance-1',kind:'advance',amount:2500000,title:'Tạm ứng chạy quảng cáo',status:'pending',approvals:{manager:{status:'pending'},accountant:{status:'pending'}}},{...base,id:'advance-2',kind:'advance',amount:1000000,title:'Tạm ứng chạy quảng cáo',status:'approved',approvals:{manager:{status:'approved',actorName:'Quản lý'},accountant:{status:'approved',actorName:'Kế toán'}}}],staffRequests:[{...base,id:'leave-1',kind:'request',type:'leave',title:'Đơn xin nghỉ',status:'approved',date:'2026-11-07',sessions:['morning'],approvals:{department:{status:'approved'},branch:{status:'approved'}}},{...base,id:'leave-2',kind:'request',type:'leave',title:'Đơn xin nghỉ',status:'approved',date:'2026-11-08',sessions:['morning','afternoon'],approvals:{department:{status:'approved'},branch:{status:'approved'}}},{...base,id:'proposal-1',kind:'request',type:'proposal',title:'Mua công cụ thiết kế',sessions:[],status:'pending',approvals:{department:{status:'pending'},branch:{status:'pending'}}}],requests:[]};
      const s={collection:(_, ...parts)=>parts.at(-1),where:(field,op,value)=>({field,value}),query:(ref,...filters)=>({ref,filters}),onSnapshot:(q,next,error)=>{queueMicrotask(()=>{const failure=window.__failures?.[q.ref||q];if(failure)return error(failure);const list=window.__fixtures[q.ref||q]||[],rows=list.filter(row=>(q.filters||[]).every(f=>row[f.field]===f.value));next({docs:rows.map(row=>({id:row.id,data:()=>row}))});});return()=>{};}};
      state.firebase={app:{options:{projectId:'mediafbtq-test'}},db:{},storeMod:s,funcMod:{httpsCallable:(_,name)=>async data=>{window.__calls.push({name,data});return {data:{ok:true,id:'new-document'}};}},functions:{}};
      document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');workflows.start();
    });
    await page.locator('[data-page="advances"]').click();await page.waitForSelector('#page-advances [data-wf-id="advance-1"]');
    assert.equal(await page.locator('#page-advances [data-wf-action="approve"]').count(),0);
    await page.locator('#page-advances [data-wf-filter="period"]').selectOption('day');await page.locator('#page-advances [data-wf-filter="date"]').fill('2026-11-01');await page.locator('#page-advances [data-wf-filter="date"]').dispatchEvent('change');assert.equal(await page.locator('#page-advances [data-wf-action="history"]').count(),0);
    await page.locator('#page-advances [data-wf-filter="period"]').selectOption('month');await page.locator('#page-advances [data-wf-filter="date"]').fill('2026-11');await page.locator('#page-advances [data-wf-filter="date"]').dispatchEvent('change');assert.equal(await page.locator('#page-advances [data-wf-action="history"]').count(),2);
    await page.locator('#page-advances [data-wf-filter="period"]').selectOption('year');await page.locator('#page-advances [data-wf-filter="date"]').fill('2025');await page.locator('#page-advances [data-wf-filter="date"]').dispatchEvent('change');assert.equal(await page.locator('#page-advances [data-wf-action="history"]').count(),0);
    await page.locator('#page-advances [data-wf-action="reset"]').click();assert.equal(await page.locator('#page-advances [data-wf-action="history"]').count(),2);
    await page.locator('#page-advances [data-wf-action="create"]').click();await page.locator('[name="amount"]').fill('1500000');await page.locator('textarea[name="description"]').fill('Chạy quảng cáo sản phẩm mới');await page.locator('#activeModalForm button[type="submit"]').click();
    await page.waitForFunction(()=>window.__calls.length===1);assert.equal((await page.evaluate(()=>window.__calls[0])).data.amount,1500000);
    await page.locator('[data-page="requests"]').click();await page.locator('#wfLeaveMonth').fill('2026-11');await page.locator('#wfLeaveMonth').dispatchEvent('change');
    assert.ok((await page.locator('#wfLeaveTotals').innerText()).includes('1.5 ngày'));
    assert.equal(await page.locator('#wfLeaveCalendar td.wf-day-morning').count(),1);assert.equal(await page.locator('#wfLeaveCalendar td.wf-day-full').count(),1);
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-wf-action="export"]').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'Thong-ke-nghi-2026-11.xlsx');
    await page.locator('#page-requests [data-wf-action="create"]').click();await page.locator('#wfRequestType').selectOption('proposal');assert.equal(await page.locator('#wfLeaveFields').isVisible(),false);await page.locator('[name="title"]').fill('Mua phần mềm');await page.locator('textarea[name="description"]').fill('Đề xuất phần mềm thiết kế');await page.locator('#activeModalForm button[type="submit"]').click();await page.waitForFunction(()=>window.__calls.length===2);
    const proposal=await page.evaluate(()=>window.__calls[1]);assert.equal(proposal.data.type,'proposal');assert.deepEqual(proposal.data.sessions,[]);
    await page.evaluate(()=>{const {state,workflows,navigate}=window.__workflowTest;state.user={uid:'manager',name:'Quản lý chi nhánh',role:'branch_manager',branch:'Tuyên Quang',department:'Marketing'};state.role='branch_manager';workflows.start();navigate('advances');});
    await page.waitForSelector('#page-advances [data-wf-action="approve"]');await page.locator('#page-advances [data-wf-action="approve"]').click();await page.locator('#activeModalForm button[type="submit"]').click();await page.waitForFunction(()=>window.__calls.length===3);assert.equal((await page.evaluate(()=>window.__calls[2])).data.stage,'manager');
    await page.locator('#page-advances [data-wf-action="history"]').first().click();assert.ok((await page.locator('.wf-timeline').innerText()).includes('Nguyễn Minh Anh'));await page.locator('.modal-close').click();
    await page.evaluate(()=>{const {state,workflows}=window.__workflowTest;state.user={uid:'accountant',name:'Kế toán',role:'accountant',branch:'Trụ sở',department:'Kế toán'};state.role='accountant';workflows.start();});
    await page.waitForSelector('[data-wf-action="disburse"]');await page.locator('[data-wf-action="disburse"]').click();await page.locator('[name="reference"]').fill('TX-TEST-001');await page.locator('#activeModalForm button[type="submit"]').click();await page.waitForFunction(()=>window.__calls.length===4);assert.equal((await page.evaluate(()=>window.__calls[3])).name,'disburseAdvance');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__workflowTest.navigate('requests'));
    assert.ok(await page.locator('#page-requests h1').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
    await page.evaluate(()=>{const {state,workflows}=window.__workflowTest;state.user={uid:'employee',name:'Nguyễn Minh Anh',role:'employee',branch:'Tuyên Quang',department:'Marketing'};state.role='employee';workflows.start();document.querySelector('#toastRegion').replaceChildren();});
    await page.waitForSelector('#page-requests [data-wf-id="leave-1"]');
    if(process.env.FBTQ_SCREENSHOT_DIR){fs.mkdirSync(process.env.FBTQ_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'workflow-mobile.png'),fullPage:true,animations:'disabled'});await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.__workflowTest.navigate('advances'));await page.evaluate(()=>document.querySelectorAll('.table-scroll').forEach(el=>el.scrollLeft=0));await page.screenshot({path:path.join(process.env.FBTQ_SCREENSHOT_DIR,'workflow-desktop.png'),fullPage:true,animations:'disabled'});}
    // A legacy history failure must not hide new requests or block their export.
    await page.evaluate(()=>{window.__failures={requests:{code:'permission-denied',message:'Missing permissions'}};window.__workflowTest.workflows.start();window.__workflowTest.navigate('requests');});
    await page.waitForFunction(()=>document.querySelector('#page-requests [data-wf-message]').textContent.includes('permission-denied'));
    assert.equal(await page.locator('#page-requests [data-wf-action="history"]').count(),3);
    const partialDownload=page.waitForEvent('download');await page.locator('[data-wf-action="export"]').click();await partialDownload;
    await page.evaluate(()=>{window.__failures={advanceInvoices:{code:'permission-denied',message:'Missing permissions'},staffRequests:{code:'failed-precondition',message:'The query requires an index.'}};window.__workflowTest.workflows.start();});
    await page.waitForFunction(()=>document.querySelector('#page-advances [data-wf-message]').textContent.includes('permission-denied'));
    const denied=await page.locator('#page-advances [data-wf-message]').textContent();assert.ok(denied.includes('advanceInvoices'));assert.ok(denied.includes('mediafbtq-test'));
    const missingIndex=await page.locator('#page-requests [data-wf-message]').textContent();assert.ok(missingIndex.includes('failed-precondition'));assert.ok(missingIndex.includes('index'));assert.equal(await page.locator('#page-requests [data-wf-action="history"]').count(),0);
    await page.evaluate(()=>{window.__failures={};window.__workflowTest.workflows.start();});await page.waitForSelector('#page-requests [data-wf-id="leave-1"]');assert.ok(!(await page.locator('#page-requests [data-wf-message]').textContent()).includes('failed-precondition'));
    assert.deepEqual(errors,[]);console.log('PASS: main menus, forms, role-based buttons, two-stage review payload, funding confirmation, filters/calendar, Excel download, history, mobile layout, no browser errors.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
