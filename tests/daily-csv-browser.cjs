const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{channel:'chrome'})});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://**/*',route=>route.abort());
    await page.route('https://fbtq.test/**',route=>{
      const pathname=new URL(route.request().url()).pathname;if(pathname==='/firebase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.FBTQ_FIREBASE_CONFIG={};'});
      const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.fulfill({status:404,body:''});
      const body=pathname==='/app.js'?fs.readFileSync(target,'utf8')+`\nwindow.__dailyTest={state,openDailyReportForm,receiveExtensionImport,processFbtqAssistantCommand,stubPdf:()=>{parseMetaInvoicePdf=async()=>({supplier:'Meta Platforms',transactionIds:'TX-TEST',invoiceDate:'2026-11-05',billingPeriod:'Tháng 11 2026',taxPeriod:'2026-Q4',supplierTaxId:'123',amountBeforeVat:100000,vatAmount:10000,vatRate:10,total:110000,detectedCount:10,missingFields:[]});}};`:fs.readFileSync(target);
      return route.fulfill({contentType:({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'})[path.extname(target)]||'application/octet-stream',body});
    });
    await page.goto('https://fbtq.test/');await page.waitForFunction(()=>window.__dailyTest);
    await page.evaluate(()=>{
      const {state,openDailyReportForm}=window.__dailyTest;state.user={uid:'csv-test',name:'Nhân viên kiểm thử',department:'Marketing'};state.role='employee';window.__saved=[];
      state.firebase={db:{},storeMod:{doc:(_, ...parts)=>parts.join('/'),collection:(_, ...parts)=>parts.join('/'),query:(...args)=>args,where:(...args)=>args,getDocs:async()=>({docs:[]}),setDoc:async(ref,data)=>window.__saved.push({ref,data}),serverTimestamp:()=>({seconds:1}),writeBatch:()=>{const writes=[];return {set:(ref,data)=>writes.push({ref,data}),commit:async()=>window.__saved.push(...writes)};}}};
      state.metrics=[{id:'old',createdBy:'csv-test',name:'Sai từ extension',account:'old',spend:999999,dailyMessages:1000}];openDailyReportForm();
    });
    assert.ok(await page.locator('#dailySheetCsvButton').isVisible());await page.locator('[name="otherRevenue"]').fill('123');
    const csv='ID tài khoản quảng cáo,Chiến dịch,Phân phối,Kết quả,Chi phí trên mỗi kết quả,Ngân sách,Số tiền đã chi tiêu (VND),Ngày bắt đầu báo cáo,Ngày kết thúc báo cáo\n3092737904212442,Bonbon,Đang tắt,409,113,30.000,46.062,2026-11-05,2026-11-05\n3092737904212442,New campaign,Đang tắt,143,266,30.000,37.979,2026-11-05,2026-11-05';
    const upload=()=>page.locator('#dailySheetCsvFile').setInputFiles({name:'Meta.csv',mimeType:'text/csv',buffer:Buffer.from('\uFEFF'+csv)});
    await upload();await page.waitForFunction(()=>!document.querySelector('#dailySheetCsvButton').disabled);assert.ok((await page.locator('#dailySheetCsvStatus').textContent()).includes('Đã nhập 2'),await page.locator('#dailySheetCsvStatus').textContent());
    assert.equal(await page.locator('.daily-sheet-row').count(),2);
    const row=page.locator('.daily-sheet-row').first();for(const [field,value] of Object.entries({account:'3092737904212442',campaign:'Bonbon',status:'Đang tắt',messages:'409',messageCost:'113',budget:'30000',spend:'46062',phones:''}))assert.equal(await row.locator(`[data-field="${field}"]`).inputValue(),value,field);
    assert.equal(await page.locator('[data-total="messages"]').textContent(),'552');assert.ok((await page.locator('[data-total="spend"]').textContent()).includes('84.041'));assert.equal(await page.locator('[name="otherRevenue"]').inputValue(),'123');assert.equal(await page.locator('[name="reportDate"]').inputValue(),'2026-11-05');assert.equal(await page.evaluate(()=>window.__saved.length),0);
    const firstKey=await row.getAttribute('data-row-key');await upload();await page.waitForFunction(()=>!document.querySelector('#dailySheetCsvButton').disabled);assert.equal(await page.locator('.daily-sheet-row').count(),2);assert.equal(await row.getAttribute('data-row-key'),firstKey);
    await page.locator('#dailySheetCsvFile').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('Chiến dịch,Kết quả\nA,abc')});await page.waitForSelector('#dailySheetCsvStatus.is-error');assert.equal(await row.locator('[data-field="campaign"]').inputValue(),'Bonbon');assert.equal(await page.locator('.daily-sheet-row').count(),2);
    await page.locator('#activeModalForm button[type="submit"]').click();await page.waitForFunction(()=>window.__saved.length===6);
    const saved=await page.evaluate(()=>window.__saved.find(r=>r.ref.includes('/dailyReports/')&&r.data.campaign==='Bonbon').data);assert.equal(saved.messages,409);assert.equal(saved.avgMessageCost,113);assert.equal(saved.spend,46062);assert.equal(saved.metaSnapshot.name,'Bonbon');assert.equal(saved.reportDate,'2026-11-05');assert.ok(saved.metaSnapshot.rawColumns.length>0);
    await page.evaluate(()=>{document.querySelector('#authScreen').classList.add('hidden');document.querySelector('#app').classList.remove('hidden');});
    await page.locator('#fbtqAssistantLauncher').click();
    const chooserPromise=page.waitForEvent('filechooser');await page.locator('#fbtqAssistantWindow [data-assistant-import="metrics"]').click();
    const chooser=await chooserPromise;await chooser.setFiles({name:'Meta-helper.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({campaigns:[{campaign:'JSON campaign',account:'123',delivery:'Đang tắt',budget:30000,spend:46062,results:409,costPerResult:113}]}))});
    await page.waitForFunction(()=>document.querySelector('#dailySheetCsvStatus').textContent.includes('Đã nhập 1'));
    assert.ok(await page.locator('#page-assistant.active').count());assert.equal(await page.locator('[data-field="campaign"]').inputValue(),'JSON campaign');assert.equal(await page.locator('[data-field="messageCost"]').inputValue(),'113');assert.equal(await page.evaluate(()=>window.__saved.length),6);await page.locator('.modal-close').click();
    await page.evaluate(()=>window.__dailyTest.stubPdf());
    const pdfChooserPromise=page.waitForEvent('filechooser');await page.locator('#page-assistant [data-assistant-import="invoice"]').click();const pdfChooser=await pdfChooserPromise;await pdfChooser.setFiles({name:'invoice.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
    await page.waitForFunction(()=>document.querySelector('[name="supplier"]').value==='Meta Platforms');assert.equal(await page.locator('[name="total"]').inputValue(),'110000');assert.ok(await page.locator('#page-assistant.active').count());assert.equal(await page.evaluate(()=>window.__saved.length),6);await page.locator('.modal-close').click();
    await page.evaluate(()=>window.__dailyTest.processFbtqAssistantCommand('Nhập số liệu chiến dịch'));assert.ok(await page.locator('#dailySheetCsvButton').isVisible());assert.ok(await page.locator('#page-assistant.active').count());await page.locator('.modal-close').click();
    await page.evaluate(()=>window.__dailyTest.processFbtqAssistantCommand('Nhập hóa đơn'));assert.ok(await page.locator('#metaInvoiceFile').count());assert.ok(await page.locator('#page-assistant.active').count());await page.locator('.modal-close').click();
    await page.evaluate(()=>window.__dailyTest.receiveExtensionImport({kind:'metrics',campaigns:[{campaign:'From extension',name:'From extension',account:'123',status:'Đang tắt',budget:30000,spend:46062,results:409,costPerResult:113}]}));
    assert.ok(await page.locator('#page-assistant.active').count());assert.ok((await page.locator('#assistantImportStatus').textContent()).includes('1 chiến dịch'));await page.locator('.modal-close').click();
    await page.evaluate(()=>window.__dailyTest.receiveExtensionImport({kind:'invoice-pdf',base64:btoa('%PDF-1.4 test'),filename:'Meta.pdf'}));await page.waitForFunction(()=>document.querySelector('[name="supplier"]').value==='Meta Platforms');assert.ok(await page.locator('#page-assistant.active').count());assert.equal(await page.locator('#metaInvoiceFile').evaluate(el=>el.files[0].name),'Meta.pdf');
    assert.deepEqual(errors,[]);console.log('PASS: CSV button, six-field autofill, replacing old rows, totals, blank fields, date, repeat import, invalid file rollback, save and Meta snapshot; Assistant CSV/JSON/PDF buttons, import commands and both extension handoffs.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
