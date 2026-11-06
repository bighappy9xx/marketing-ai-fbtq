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
vm.runInContext("function dailyReportMetricsForUser(){return [metric]} function reportDateKey(){return '2026-11-05'}"+app.slice(app.indexOf('function dailySheetPrefillRows('),app.indexOf('function openDailyReportForm(')),ctx);
const fresh=ctx.dailySheetPrefillRows('2026-11-05',true)[0];
assert.equal(fresh.campaign,'Bonbon');assert.equal(fresh.status,'Đang tắt');assert.equal(fresh.dailyBudget,30000);assert.equal(fresh.actualSpend,46062);assert.equal(fresh.dailyMessages,409);assert.equal(fresh.dailyAvgMessageCost,113);
assert.equal(ctx.dailySheetPrefillRows('2026-11-05')[0].campaign,'WRONG');
console.log('PASS: three screenshot rows, adjacent attribution column, missing column, multiline results, and fresh import overriding saved values.');
