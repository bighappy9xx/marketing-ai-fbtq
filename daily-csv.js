const key=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
const fields={
  campaign:['Bài chạy','Tên chiến dịch','Chiến dịch','Campaign name','Campaign','name','Tên nhóm quảng cáo','Ad set name'],
  adAccount:['ID tài khoản quảng cáo','ID tài khoản','Account ID','Ad account ID','Tài khoản quảng cáo','Tên TKQC','Tên tài khoản quảng cáo','Account name','account','adAccount'],
  status:['Phân phối','Phân phối chiến dịch','Lượt phân phối chiến dịch','Phân phối nhóm quảng cáo','Trạng thái','Campaign delivery','Ad set delivery','Delivery','status'],
  dailyBudget:['Ngân sách','Ngân sách/ngày','Ngân sách nhóm quảng cáo','Campaign budget','Ad set budget','Budget','dailyBudget'],
  actualSpend:['Số tiền đã chi tiêu (VND)','Số tiền đã chi tiêu','Số tiền đã chi','Chi tiêu thực tế/ngày','Chi tiêu thực tế ngày','Số tiền chi tiêu thực tế/ngày','Amount spent (VND)','Amount spent','spend','actualSpend'],
  dailyMessages:['Số Mess','Tổng số mess','dailyMessages','Kết quả','Results'],
  dailyAvgMessageCost:['Giá mess TB','Giá Mess Trung bình','dailyAvgMessageCost','Chi phí mỗi kết quả','Chi phí trên mỗi kết quả','Chi phí trên mỗi kết quả (VND)','Cost per result'],
  dailyPhones:['SĐT/Camp','Số điện thoại','Tổng SĐT','dailyPhones','phoneLeads'],
  dailyPhoneRevenue:['Doanh thu SĐT/Camp','Tổng doanh thu số mới','dailyPhoneRevenue','phoneRevenue'],
  dailyKpi:['KPI/ngày','dailyKpi'],dailyAvgPhoneCost:['Giá số TB','Giá số trung bình','dailyAvgPhoneCost'],
  dailyNewPhoneRate:['Tỷ lệ xin số mới','Tỷ lệ xin số mới (%)','dailyNewPhoneRate'],
  dailyThreshold:['Ngưỡng','dailyThreshold'],dailyThresholdSpent:['Ngưỡng đã chi','Ngưỡng đã chi tiêu','dailyThresholdSpent'],
  dailyIssue:['Vấn đề / Nguyên nhân','Vấn đề gặp phải - Nguyên nhân vì sao','dailyIssue'],dailyResolution:['Hướng giải quyết','dailyResolution'],
  impressions:['Lượt hiển thị','Impressions'],reach:['Người tiếp cận','Reach'],
  newMessagingContacts:['Người liên hệ nhắn tin mới','New messaging contacts'],
  messagingConversationsStarted:['Lượt bắt đầu cuộc trò chuyện','Lượt bắt đầu cuộc trò chuyện qua tin nhắn','Messaging conversations started'],
  costPerNewMessagingContact:['Chi phí trên mỗi người liên hệ nhắn tin mới','Chi phí trên mỗi người liên hệ nhắn tin mới (VND)','Cost per new messaging contact'],
  costPerMessagingConversationStart:['Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện','Chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn (VND)','Cost per messaging conversation start'],
  reportStart:['Ngày bắt đầu báo cáo','Lượt bắt đầu báo cáo','Bắt đầu báo cáo','Reporting starts','reportStart'],
  reportEnd:['Ngày kết thúc báo cáo','Lượt kết thúc báo cáo','Kết thúc báo cáo','Reporting ends','reportEnd'],
  reportAt:['Ngày báo cáo','Ngày','Report date','reportDate','reportAt'],
  campaignId:['ID chiến dịch','Campaign ID','campaignId','ID nhóm quảng cáo','Ad set ID']
};
const numericFields=['dailyBudget','actualSpend','dailyMessages','dailyAvgMessageCost','dailyPhones','dailyPhoneRevenue','dailyKpi','dailyAvgPhoneCost','dailyNewPhoneRate','dailyThreshold','dailyThresholdSpent','impressions','reach','newMessagingContacts','messagingConversationsStarted','costPerNewMessagingContact','costPerMessagingConversationStart'];
function matrix(input,delimiter) {
  const rows=[];let row=[],field='',quoted=false,closed=false;
  const cell=()=>{row.push(field.trim());field='';closed=false;};
  const line=()=>{cell();if(row.some(Boolean))rows.push(row);row=[];};
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){if(c==='"'&&input[i+1]==='"'){field+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else field+=c;continue;}
    if(c==='"'&&!field.trim()&&!closed){field='';quoted=true;continue;}
    if(c===delimiter){cell();continue;}
    if(c==='\n'||c==='\r'){line();if(c==='\r'&&input[i+1]==='\n')i++;continue;}
    if(closed&&!/\s/.test(c))throw new Error('CSV có nội dung sai sau dấu ngoặc kép. Hãy xuất lại file CSV UTF-8.');
    field+=c;
  }
  if(quoted)throw new Error('CSV có ô chưa đóng dấu ngoặc kép.');
  line();return rows;
}
export function csvTable(text) {
  let input=String(text).replace(/^\uFEFF/,'');
  const separator=input.match(/^sep=([,;\t])\r?\n/i);if(separator)input=input.slice(separator[0].length);
  let rows;
  if(separator)rows=matrix(input,separator[1]);
  else {
    const candidates=[',',';','\t'].map(delimiter=>{try{return {rows:matrix(input,delimiter)};}catch(error){return {error};}});
    const parsed=candidates.filter(c=>c.rows).sort((a,b)=>(b.rows[0]?.length||0)-(a.rows[0]?.length||0));
    if(!parsed.length)throw candidates[0].error;
    rows=parsed[0].rows;
  }
  if(rows.length<2)throw new Error('CSV cần có hàng tiêu đề và ít nhất một dòng dữ liệu.');
  const headers=rows.shift(),nonempty=headers.map(key).filter(Boolean);
  if(new Set(nonempty).size!==nonempty.length)throw new Error('CSV có tiêu đề cột bị trùng. Hãy giữ mỗi cột một lần.');
  if(rows.some(row=>row.length>headers.length&&row.slice(headers.length).some(Boolean)))throw new Error('Số cột dữ liệu không khớp tiêu đề. Kiểm tra dấu phân cách và các số có dấu phẩy.');
  return {headers,rows};
}
function numeric(value,label,line) {
  const raw=String(value??'').trim();if(!raw||/^(?:[—–-]|n\/?a|null)$/i.test(raw))return null;
  let text=raw.split(/\r?\n/)[0].replace(/[₫đ$€%]|\b(?:VND|USD|EUR)\b/gi,'').replace(/[\s\u00a0]/g,'');
  if(!/^[+]?\d[\d.,]*$/.test(text))throw new Error(`Dòng ${line}: giá trị “${raw}” ở cột ${label} không phải số không âm hợp lệ.`);
  if(text.includes('.')&&text.includes(','))text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  else if(/^[+]?\d{1,3}(?:[.,]\d{3})+$/.test(text))text=text.replace(/[.,]/g,'');
  else text=text.replace(',','.');
  const n=Number(text);if(!Number.isFinite(n)||n<0)throw new Error(`Dòng ${line}: số ở cột ${label} không hợp lệ.`);return n;
}
function isoDate(value) {
  const raw=String(value||'').trim();let date=raw;
  const m=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)date=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date?date:'';
}
export function parseDailyCsv(text) {
  const {headers,rows}=csvTable(text),columns={};
  for(const [field,aliases] of Object.entries(fields))columns[field]=aliases.map(alias=>headers.findIndex(h=>key(h)===key(alias))).find(index=>index>=0)??-1;
  if(columns.campaign<0)throw new Error('Không tìm thấy cột Bài chạy / Chiến dịch / Tên chiến dịch / Campaign name trong CSV.');
  const output=[],warnings=[];let skipped=0;
  for(const [index,values] of rows.entries()){
    const read=field=>columns[field]>=0?values[columns[field]]||'':'';
    const campaign=read('campaign');
    if(!campaign||/^(?:tổng(?: cộng)?|tổng kết quả|kết quả từ \d+ chiến dịch|total(?: results)?|summary)$/i.test(campaign)){skipped++;continue;}
    const row={campaign,name:campaign,adAccount:read('adAccount'),account:read('adAccount'),status:read('status'),delivery:read('status'),dailyIssue:read('dailyIssue'),dailyResolution:read('dailyResolution'),campaignId:read('campaignId'),rawColumns:headers.map((label,i)=>({label,value:values[i]||''})).filter(column=>column.label)};
    for(const field of numericFields){
      const raw=read(field);
      if(field==='dailyBudget'&&raw&&!/\d/.test(raw)&&!/[—–-]/.test(raw)){row[field]=null;row.budgetType=raw;continue;}
      row[field]=numeric(raw,headers[columns[field]]||field,index+2);
    }
    if(row.dailyMessages!==null&&!Number.isInteger(row.dailyMessages)||row.dailyPhones!==null&&!Number.isInteger(row.dailyPhones))throw new Error(`Dòng ${index+2}: Số Mess và SĐT phải là số nguyên không âm.`);
    Object.assign(row,{budget:row.dailyBudget,spend:row.actualSpend,results:row.dailyMessages,costPerResult:row.dailyAvgMessageCost,reportStart:isoDate(read('reportStart')),reportEnd:isoDate(read('reportEnd')),reportAt:isoDate(read('reportAt'))});
    if(row.reportStart&&row.reportEnd&&row.reportStart>row.reportEnd)throw new Error(`Dòng ${index+2}: ngày bắt đầu sau ngày kết thúc báo cáo.`);
    output.push(row);
  }
  if(!output.length)throw new Error('CSV không có dòng chiến dịch hợp lệ để nhập.');
  if(output.length>2000)throw new Error('Mỗi lần nhập tối đa 2.000 chiến dịch. Hãy chia nhỏ CSV.');
  const dates=[...new Set(output.map(row=>row.reportAt||(row.reportStart===row.reportEnd?row.reportEnd:'')))];
  const periods=output.some(row=>row.reportStart&&row.reportEnd&&row.reportStart!==row.reportEnd);
  if(periods||dates.filter(Boolean).length>1)warnings.push('File chứa nhiều ngày hoặc một khoảng ngày. Số liệu được giữ nguyên theo file; hãy kiểm tra ngày báo cáo trước khi lưu.');
  if(skipped)warnings.push(`Đã bỏ qua ${skipped} dòng trống/tổng cộng.`);
  return {rows:output,reportDate:!periods&&dates.length===1?dates[0]:'',warnings};
}
export async function readDailyCsv(file) {
  if(file.size>10*1024*1024)throw new Error('File CSV tối đa 10 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let encoding='utf-8';
  if(bytes[0]===0xff&&bytes[1]===0xfe)encoding='utf-16le';else if(bytes[0]===0xfe&&bytes[1]===0xff)encoding='utf-16be';
  let text;try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw new Error('Không đọc được tiếng Việt trong CSV. Hãy lưu file dưới dạng CSV UTF-8 rồi thử lại.');}
  if(/\.json$/i.test(file.name||'')||file.type==='application/json')return parseDailyJson(text);
  return parseDailyCsv(text);
}
export function parseDailyJson(text) {
  let payload;try{payload=JSON.parse(String(text).replace(/^\uFEFF/,''));}catch{throw new Error('JSON không hợp lệ. Hãy chọn file CSV hoặc JSON xuất từ Meta Helper.');}
  const rows=Array.isArray(payload)?payload:payload?.campaigns||payload?.rows||payload?.data;
  if(!Array.isArray(rows)||!rows.length||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('JSON cần chứa danh sách chiến dịch (campaigns, rows hoặc data).');
  if(rows.length>2000)throw new Error('Mỗi lần nhập tối đa 2.000 chiến dịch.');
  const headers=[...new Set(rows.flatMap(row=>Object.keys(row).filter(field=>row[field]===null||['string','number','boolean'].includes(typeof row[field]))))];
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  return parseDailyCsv([headers.map(quote).join(','),...rows.map(row=>headers.map(h=>quote(row[h])).join(','))].join('\n'));
}
