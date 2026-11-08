const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('extension/content.js','utf8');
const app = fs.readFileSync('app.js','utf8');
const ctx = { console, TextEncoder, state: { user: { uid: 'tester' }, dailyReports: [] } };
vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  const normalize ='),source.indexOf('  const setStatus =')),ctx);
vm.runInContext(source.slice(source.indexOf('  function numberFrom'),source.indexOf('  function parseMetaDateRange')),ctx);
vm.runInContext(source.slice(source.indexOf('  function columnBounds'),source.indexOf('  function hasBlueSelectionFill')),ctx);
vm.runInContext(source.slice(source.indexOf('  function headerIndex'),source.indexOf('  function rowIsSelected')),ctx);
vm.runInContext('function rowIsSelected(){return true}',ctx);
const rect = (left,right,top=260,height=40) => ({left,right,top,bottom:top+height,width:right-left,height});
const headers = [ [0,48,''], [48,126,'Tắt/Bật'], [126,414,'Chiến dịch'], [414,548,'Phân phối'], [548,614,'Cài đặt ghi nhận'], [614,726,'Kết quả'], [726,860,'Chi phí trên mỗi kết quả'], [860,972,'Ngân sách'], [972,1084,'Số tiền đã chi tiêu'] ];
const node = (text,bounds) => ({innerText:text,getBoundingClientRect:()=>bounds,getAttribute:()=>null,closest:()=>null});
for (const [name,result,cost,spend] of [['New post engagement campaign - Bản sao',3,2829,8487],['New post engagement campaign',143,266,37979],['Bonbon',409,113,46062]]) {
  const texts=['','',name,'Đang tắt','Lượt click trong 7 ngày hoặc lượt xem trong 1 ngày',String(result)+'\nLượt tương tác',cost.toLocaleString('vi-VN')+' đ\nTrên mỗi lượt tương tác','30.000 đ\nHàng ngày',spend.toLocaleString('vi-VN')+' đ'];
  const hs=headers.map(([l,r,t])=>node(t,rect(l,r,218)));
  const cells=headers.map(([l,r],i)=>node(texts[i],rect(l,r)));
  // An unrelated descendant must not overwrite campaign/status via position fallback.
  cells.push(node('Lượt click trong 7 ngày',rect(560,612)));
  const row={innerText:texts.join(' '),querySelector:()=>cells[0],querySelectorAll:()=>cells};
  cells.forEach(c=>c.closest=()=>row);
  const grid={querySelectorAll:q=>q.includes('columnheader')?hs:[row]};
  const parsed=ctx.readGrid(grid), data=parsed.rows[0].cells;
  const get=alias=>ctx.cellValue(parsed.headers,data,[alias]);
  assert.equal(get('Chiến dịch'),name);assert.equal(get('Phân phối'),'Đang tắt');
  assert.equal(ctx.numberFrom(get('Kết quả')),result);assert.equal(ctx.numberFrom(get('Chi phí trên mỗi kết quả')),cost);
  assert.equal(ctx.numberFrom(get('Ngân sách')),30000);assert.equal(ctx.numberFrom(get('Số tiền đã chi tiêu')),spend);
}
const rowBounds=rect(0,1084);
const items=[{text:'Lượt click trong 7 ngày',rect:rect(550,612)}, {text:'409',rect:rect(690,718,264,14)}, {text:'Lượt ThruPlay',rect:rect(635,719,282,12)}];
assert.equal(ctx.textInColumn(items,rect(614,726,218),rowBounds),'409');
assert.equal(ctx.textInColumn(items,rect(414,548,218),rowBounds),'');
assert.equal(ctx.numberFrom('—'),null);
// Fresh import must win over saved report values for the six mapped fields.
ctx.metric={id:'m1',name:'Bonbon',account:'3092737904212442',delivery:'Đang tắt',status:'Đang tắt',budget:30000,spend:46062,results:409,dailyMessages:409,costPerResult:113};
ctx.state.dailyReports=[{createdBy:'tester',metricId:'m1',campaign:'WRONG',status:'WRONG',messages:0,spend:1,budget:1,avgMessageCost:999}];
vm.runInContext("function dailyReportMetricsForUser(){return [metric]} function reportDateKey(){return '2026-11-05'}"+app.slice(app.indexOf('function savedDailySheetRows('),app.indexOf('function openDailyReportForm(')),ctx);
const fresh=ctx.dailySheetPrefillRows('2026-11-05',true)[0];
assert.equal(fresh.campaign,'Bonbon');assert.equal(fresh.status,'Đang tắt');assert.equal(fresh.dailyBudget,30000);assert.equal(fresh.actualSpend,46062);assert.equal(fresh.dailyMessages,409);assert.equal(fresh.dailyAvgMessageCost,113);
assert.equal(ctx.dailySheetPrefillRows('2026-11-05')[0].campaign,'WRONG');
console.log('PASS: three screenshot rows, adjacent attribution column, missing column, multiline results, and fresh import overriding saved values.');
// Full screenshot-shaped grid: all columns, selected rows, and unknown extra columns.
ctx.URL=URL;ctx.location={href:'https://adsmanager.facebook.com/adsmanager/?act=3092737904212442'};
ctx.getComputedStyle=()=>({backgroundColor:'rgb(255,255,255)'});
vm.runInContext(source.slice(source.indexOf('  const headerSpecs ='),source.indexOf('  // Use the full header cell')),ctx);
vm.runInContext(source.slice(source.indexOf('  function rowIsSelected'),source.indexOf('  const headerSpecs =')),ctx);
vm.runInContext('let lastScanInfo={}; function activeReportRange(){return {start:"2026-10-07",end:"2026-11-05"}}',ctx);
vm.runInContext(source.slice(source.indexOf('  function completeMetric'),source.indexOf('  function renderMetricPreview')),ctx);
const columnNames=['','Tắt/Bật','Chiến dịch','Phân phối','Kết quả','Chi phí trên mỗi kết quả','Ngân sách','Số tiền đã chi tiêu','Lượt hiển thị','Người tiếp cận','Người liên hệ nhắn tin mới','Chi phí trên mỗi người liên hệ nhắn tin mới','Lượt bắt đầu cuộc trò chuyện','Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện','Cột bổ sung'];
const widths=[40,80,320,...Array(12).fill(130)];let left=0;
const fullHeaders=columnNames.map((label,i)=>{const r=rect(left,left+widths[i],0,40);left+=widths[i];const h=node(label,r);h.closest=()=>h;return h});
const values=[
['','','New post engagement campaign - Bản sao','Đang tắt','3\nTương tác','2.829 đ\nTrên mỗi lượt tương tác','30.000 đ\nHàng ngày','8.487 đ','121','110','—','—','—','—','Gốc 1'],
['','','New post engagement campaign','Đang tắt','143\nLượt tương tác với bài viết','266 đ\nTrên mỗi lượt tương tác với bài viết','30.000 đ\nHàng ngày','37.979 đ','1.251','898','1','37.979 đ','1','37.979 đ','Gốc 2'],
['','','Bonbon','Đang tắt','409\nLượt ThruPlay','113 đ\nChi phí trên mỗi lượt ThruPlay','30.000 đ\nHàng ngày','46.062 đ','910','878','—','—','—','—','Gốc 3'],
['','','Kết quả từ 3 chiến dịch','','—','—','','92.528 đ','2.282','1.855','1','92.528 đ','1','92.528 đ','']];
const fullRows=values.map((texts,i)=>{
  const row={innerText:texts.join(' '),getAttribute:name=>name==='aria-selected'?String(i<2):null,getBoundingClientRect:()=>rect(0,left,44+i*40,40)};
  const cells=fullHeaders.map((h,j)=>node(texts[j],{...h.getBoundingClientRect(),top:44+i*40,bottom:84+i*40}));cells.forEach(c=>c.closest=()=>row);
  row.querySelectorAll=q=>q.includes('gridcell')||q.startsWith('a,')?cells:[];
  row.querySelector=q=>q.includes('switch')?{getAttribute:()=> 'false'}:cells[0];return row;
});
const fullGrid={querySelectorAll:q=>q.includes('columnheader')?fullHeaders:fullRows};
ctx.document={querySelector:()=>null,querySelectorAll:q=>q.includes('role="grid"')?[fullGrid]:[]};
const all=ctx.rowsFromTable();assert.equal(all.length,2);
assert.equal(all[0].results,3);assert.equal(all[0].resultIndicator,'Tương tác');assert.equal(all[0].enabled,false);assert.equal(all[0].newMessagingContacts,null);
for(const [field,value] of Object.entries({results:143,costPerResult:266,budget:30000,spend:37979,impressions:1251,reach:898,newMessagingContacts:1,costPerNewMessagingContact:37979,messagingConversationsStarted:1,costPerMessagingConversationStart:37979})) assert.equal(all[1][field],value,field);
assert.equal(all[1].budgetType,'Hàng ngày');assert.equal(all[1].rawColumns.find(c=>c.label==='Cột bổ sung').value,'Gốc 2');
vm.runInContext(app.slice(app.indexOf('const metricHeaderKey='),app.indexOf('function assignMetricIds')),ctx);
ctx.raw=all[1];const saved=vm.runInContext('formatMetric(raw)',ctx);
assert.equal(saved.rawColumns.length,all[1].rawColumns.length);assert.equal(saved.costPerMessagingConversationStart,37979);assert.equal(saved.enabled,false);
// Exercise the visual fallback itself (no semantic grid), not only its helper.
ctx.innerWidth=2048;ctx.innerHeight=900;
const control={parentElement:fullRows[0],getAttribute:n=>n==='aria-checked'?'true':null,matches:()=>false};
ctx.document={body:{innerText:''},querySelector:()=>null,querySelectorAll:q=>q.startsWith('[role="checkbox"]')?[control]:q==='div,span,button,th'?fullHeaders:[]};
vm.runInContext(source.slice(source.indexOf('  function hasBlueSelectionFill'),source.indexOf('  function completeMetric')),ctx);
const visual=ctx.fallbackSelectedRows();assert.equal(visual.length,1);assert.equal(visual[0].name,values[0][2]);assert.equal(visual[0].results,3);assert.equal(visual[0].impressions,121);assert.equal(visual[0].costPerResult,2829);
console.log('PASS: full-column grid and visual fallback, selected-only extraction, skipped summary, null dashes, toggle, labels, raw columns and system persistence.');
vm.runInContext(app.slice(app.indexOf('function metaColumnsTable('),app.indexOf('function openDailyReportForm(')),ctx);
ctx.esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const markup=ctx.metaColumnsTable(all);assert.ok(markup.includes('1.251'));assert.ok(markup.includes('37.979 đ'));assert.ok(markup.includes('Gốc 2'));
const snapshot=ctx.metaReportSnapshot(all[1]);assert.equal(snapshot.impressions,1251);assert.equal(snapshot.newMessagingContacts,1);assert.equal(snapshot.rawColumns.length,all[1].rawColumns.length);
assert.ok(app.includes('metaSnapshot:metaReportSnapshot(metrics.find(metric=>metric.id===row.rowKey))'));
assert.equal(all[0].rawColumns.find(c=>c.label==='Tắt/Bật').value,'Tắt');
console.log('PASS: system full-column display and saved Meta snapshot.');
