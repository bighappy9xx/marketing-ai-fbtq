const test=require('node:test'),assert=require('node:assert/strict');
const load=()=>import('../daily-csv.js');
test('Meta Vietnamese headers map to the six report fields without guessing positions',async()=>{
  const {parseDailyCsv}=await load();
  const parsed=parseDailyCsv('\uFEFFID tài khoản,Chiến dịch,Phân phối,Kết quả,Chi phí trên mỗi kết quả,Ngân sách,Số tiền đã chi tiêu (VND),Lượt hiển thị,Người tiếp cận,Ngày bắt đầu báo cáo,Ngày kết thúc báo cáo\r\n3092737904212442,"Campaign, ""A""",Đang tắt,143,266,30.000,37.979,1.251,898,2026-11-05,2026-11-05\r\n3092737904212442,Bonbon,Đang tắt,409,113,30.000,46.062,910,878,2026-11-05,2026-11-05\r\n,Tổng cộng,,552,,,84.041,,,,');
  assert.equal(parsed.rows.length,2);assert.equal(parsed.rows[0].campaign,'Campaign, "A"');assert.equal(parsed.rows[0].adAccount,'3092737904212442');assert.equal(parsed.rows[0].status,'Đang tắt');
  for(const [field,value] of Object.entries({dailyMessages:409,dailyAvgMessageCost:113,dailyBudget:30000,actualSpend:46062}))assert.equal(parsed.rows[1][field],value);
  assert.equal(parsed.rows[0].impressions,1251);assert.equal(parsed.rows[0].dailyPhones,null);assert.equal(parsed.reportDate,'2026-11-05');assert.equal(parsed.warnings.length,1);
});
test('semicolon/Excel sep declaration, custom fields, decimal comma and multiline text',async()=>{
  const {parseDailyCsv}=await load();const result=parseDailyCsv('sep=;\nTên TKQC;Bài chạy;Trạng thái;Chi tiêu thực tế / ngày;Số Mess;Giá mess TB;SĐT/Camp;Doanh thu SĐT/Camp;KPI/ngày;Tỷ lệ xin số mới (%);Vấn đề / Nguyên nhân;Hướng giải quyết\nTK01;Bonbon;Đang chạy;"1.234,50";0;0;2;500.000;100.000;"12,5";"Dòng 1\nDòng 2";Thử nội dung mới');
  const r=result.rows[0];assert.equal(r.actualSpend,1234.5);assert.equal(r.dailyMessages,0);assert.equal(r.dailyAvgMessageCost,0);assert.equal(r.dailyPhones,2);assert.equal(r.dailyPhoneRevenue,500000);assert.equal(r.dailyKpi,100000);assert.equal(r.dailyNewPhoneRate,12.5);assert.equal(r.dailyIssue,'Dòng 1\nDòng 2');
});
test('English tab export, missing values, budget text and period warning',async()=>{
  const {parseDailyCsv}=await load();const result=parseDailyCsv('Account ID\tCampaign name\tDelivery\tAmount spent\tResults\tCost per result\tBudget\tReporting starts\tReporting ends\n123\tSummer\tinactive\t"1,234.56"\t—\t—\tUsing campaign budget\t2026-10-07\t2026-11-05');
  assert.equal(result.rows[0].actualSpend,1234.56);assert.equal(result.rows[0].dailyBudget,null);assert.equal(result.rows[0].budgetType,'Using campaign budget');assert.equal(result.rows[0].dailyMessages,null);assert.equal(result.reportDate,'');assert.ok(result.warnings[0].includes('nhiều ngày'));
});
test('invalid CSV is rejected before changing any form data',async()=>{
  const {parseDailyCsv}=await load();for(const input of ['Foo,Bar\na,b','Chiến dịch,Kết quả\nA,abc','Chiến dịch,Kết quả\nA,-1','Chiến dịch,Kết quả\nA,1.5','Chiến dịch,Chiến dịch\nA,B','Chiến dịch,Kết quả\nA,1,2'])assert.throws(()=>parseDailyCsv(input));
});
test('UTF-16 LE CSV can be read and oversized file is rejected',async()=>{
  const {readDailyCsv}=await load();const bytes=Buffer.concat([Buffer.from([255,254]),Buffer.from('Chiến dịch,Kết quả\r\nBonbon,409','utf16le')]);const result=await readDailyCsv({size:bytes.length,arrayBuffer:async()=>bytes});assert.equal(result.rows[0].dailyMessages,409);
  await assert.rejects(readDailyCsv({size:11*1024*1024}),/10 MB/);
});
