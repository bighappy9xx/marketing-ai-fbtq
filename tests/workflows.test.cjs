const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const core=require('../functions/workflow-core'),{registerWorkflows}=require('../functions/workflows');
const now=new Date('2026-11-06T12:00:00Z');
const profiles={employee:{name:'Nhân viên A',role:'employee',branch:'Tuyên Quang',department:'Marketing'},head:{name:'Trưởng phòng',role:'department_manager',branch:'Tuyên Quang',department:'Marketing'},manager:{name:'Quản lý',role:'branch_manager',branch:'Tuyên Quang',department:'Marketing'},accountant:{name:'Kế toán',role:'accountant',branch:'Trụ sở',department:'Kế toán'},director:{name:'Giám đốc',role:'director',branch:'Trụ sở'}};
const user=id=>core.actor(id,profiles[id]);
const advance=()=>core.createRecord('advance',{amount:1000000,date:'2026-11-06',description:'Chạy quảng cáo tháng 11'},user('employee'),now);
const leave=()=>core.createRecord('request',{type:'leave',date:'2026-11-07',sessions:['morning'],description:'Xin nghỉ có việc gia đình'},user('employee'),now);
test('advance needs manager then accountant; payment only after both; immutable audit',()=>{
  let record=advance();const initial=structuredClone(record);
  for(const actor of [user('manager'),user('director'),{...user('head'),branch:'other'},{...user('head'),department:'other'},{...user('head'),uid:'employee'}])assert.throws(()=>core.reviewRecord(record,{stage:'manager',decision:'approve'},actor,now),{code:'permission-denied'});
  assert.throws(()=>core.reviewRecord(record,{stage:'accountant',decision:'approve'},user('accountant'),now),{code:'permission-denied'});
  assert.throws(()=>core.disburseRecord(record,{date:'2026-11-06',reference:'TX1'},user('accountant'),now),{code:'failed-precondition'});
  record=core.reviewRecord(record,{stage:'manager',decision:'approve',note:'Đúng kế hoạch'},user('head'),now);
  assert.equal(record.status,'pending');assert.deepEqual(initial.approvals.manager,{status:'pending'});
  record=core.reviewRecord(record,{stage:'accountant',decision:'approve'},user('accountant'),now);assert.equal(record.status,'approved');
  const paid=core.disburseRecord(record,{date:'2026-11-06',reference:'TX-123'},user('accountant'),now);assert.equal(paid.status,'disbursed');assert.equal(paid.disbursement.amount,1000000);assert.equal(paid.history.length,4);
  assert.throws(()=>core.disburseRecord(paid,{date:'2026-11-06',reference:'TX-124'},user('accountant'),now),{code:'failed-precondition'});
});
test('reject wrong branch, department, self approval, same actor at both stages and invalid dates',()=>{
  const r=leave();
  for(const p of [{...user('head'),branch:'Hà Nội'},{...user('head'),department:'Sales'},{...user('head'),uid:'employee'},user('director')])assert.throws(()=>core.reviewRecord(r,{stage:'department',decision:'approve'},p,now),{code:'permission-denied'});
  let approved=core.reviewRecord(r,{stage:'department',decision:'approve'},user('head'),now);
  assert.throws(()=>core.reviewRecord(approved,{stage:'branch',decision:'approve'},{...user('manager'),uid:'head'},now),{code:'permission-denied'});
  assert.equal(core.reviewRecord(approved,{stage:'branch',decision:'approve'},user('manager'),now).status,'approved');
  assert.throws(()=>core.reviewRecord(r,{stage:'department',decision:'reject',note:''},user('head'),now),{code:'invalid-argument'});
  const rejected=core.reviewRecord(r,{stage:'department',decision:'reject',note:'Thiếu thông tin'},user('head'),now);assert.equal(rejected.status,'rejected');
  assert.throws(()=>core.reviewRecord(rejected,{stage:'branch',decision:'approve'},user('manager'),now),{code:'failed-precondition'});
  assert.equal(core.validDate('2026-02-30'),false);assert.equal(core.validDate('2028-02-29'),true);
  assert.throws(()=>core.createRecord('advance',{amount:1.5,date:'2026-11-06',description:'Nội dung'},user('employee'),now),{code:'invalid-argument'});
  assert.throws(()=>core.createRecord('request',{type:'leave',date:'2026-11-06',sessions:['night'],description:'Nội dung'},user('employee'),now),{code:'invalid-argument'});
});
function service(){
  const data=new Map(Object.entries(profiles).map(([id,p])=>['users/'+id,p]));let queue=Promise.resolve();
  const db={doc:path=>({path}),runTransaction:fn=>{const run=queue.then(async()=>{const writes=[];const tx={get:async ref=>({exists:data.has(ref.path),data:()=>structuredClone(data.get(ref.path))}),create:(ref,v)=>writes.push(['create',ref.path,v]),set:(ref,v)=>writes.push(['set',ref.path,v]),delete:ref=>writes.push(['delete',ref.path])};const result=await fn(tx);for(const [type,key] of writes)if(type==='create'&&data.has(key))throw Error('Conflict');for(const [type,key,value] of writes)type==='delete'?data.delete(key):data.set(key,structuredClone(value));return result;});queue=run.catch(()=>{});return run;}};
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
  return {data,...registerWorkflows({db,onCall:(_,fn)=>fn,HttpsError})};
}
const req=(uid,data)=>({auth:{uid},data});
test('server callable ignores forged approvers and amounts; retries are idempotent and roles re-read',async()=>{
  const s=service(),payload={kind:'advance',amount:500000,date:'2026-11-06',description:'Chạy quảng cáo',clientRequestId:'idempotent-00000001',status:'approved',createdBy:'manager',approvals:{manager:{status:'approved'}}};
  const result=await s.createWorkflow(req('employee',payload));await s.createWorkflow(req('employee',payload));
  const key='workspaces/fbtq/advanceInvoices/'+result.id;assert.equal(s.data.get(key).status,'pending');assert.equal(s.data.get(key).createdBy,'employee');assert.equal(s.data.get(key).history.length,1);
  await assert.rejects(s.createWorkflow(req('employee',{...payload,amount:600000})),{code:'already-exists'});
  await assert.rejects(s.createWorkflow({data:payload}),{code:'unauthenticated'});
  const decision={kind:'advance',id:result.id,stage:'manager',decision:'approve'};
  const attempts=await Promise.allSettled([s.reviewWorkflow(req('head',decision)),s.reviewWorkflow(req('head',decision))]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(s.data.get(key).history.length,2);
  s.data.set('users/accountant',{...profiles.accountant,role:'employee'});await assert.rejects(s.reviewWorkflow(req('accountant',{...decision,stage:'accountant'})),{code:'permission-denied'});
  s.data.set('users/accountant',profiles.accountant);await s.reviewWorkflow(req('accountant',{...decision,stage:'accountant'}));
  const payments=await Promise.allSettled([1,2].map(i=>s.disburseAdvance(req('accountant',{id:result.id,date:'2026-01-01',reference:'TX-'+i,amount:999}))));assert.equal(payments.filter(x=>x.status==='fulfilled').length,1);assert.equal(s.data.get(key).disbursement.amount,500000);
});
test('leave slots prevent overlaps atomically and rejection frees a slot',async()=>{
  const s=service(),payload={kind:'request',type:'leave',date:'2026-11-07',sessions:['morning'],description:'Việc gia đình',clientRequestId:'leave-request-0001'};
  const first=await s.createWorkflow(req('employee',payload));await assert.rejects(s.createWorkflow(req('employee',{...payload,clientRequestId:'leave-request-0002'})),{code:'already-exists'});
  await s.createWorkflow(req('employee',{...payload,sessions:['afternoon'],clientRequestId:'leave-request-0003'}));
  await s.reviewWorkflow(req('head',{kind:'request',id:first.id,stage:'department',decision:'reject',note:'Chọn lại ngày'}));
  await s.createWorkflow(req('employee',{...payload,clientRequestId:'leave-request-0004'}));assert.equal([...s.data.keys()].filter(k=>k.includes('/leaveSlots/')).length,2);
});
test('monthly summary handles leap years, half days, duplicate slots, filters and colored XLSX',async()=>{
  const {leaveSummary,monthDays,leaveWorkbook}=await import('../workflow-reports.js'),{workbookBytes}=await import('../xlsx-export.js');
  assert.equal(monthDays('2028-02').length,29);assert.equal(monthDays('2026-02').length,28);
  const base={kind:'request',type:'leave',createdBy:'u1',createdByName:'=HYPERLINK("bad")',branch:'A',department:'M',status:'approved',date:'2026-11-07',description:'Việc gia đình',approvals:{},sessions:['morning']};
  const rows=[{...base,id:'1'},{...base,id:'2'},{...base,id:'3',sessions:['afternoon']},{...base,id:'4',date:'2026-11-08',status:'pending'},{...base,id:'5',date:'2026-11-09',status:'rejected'},{...base,id:'6',branch:'B',createdBy:'u2'},{...base,id:'7',date:'2026-12-01'},{...base,id:'8',legacy:true,date:'2026-11-10'}];
  const summary=leaveSummary(rows,'2026-11',{branch:'A',user:'all'});assert.equal(summary.length,1);assert.equal(summary[0].totalDays,1);assert.equal(summary[0].pendingCount,1);
  const sheets=leaveWorkbook(rows,'2026-11',{branch:'A',user:'all'});assert.equal(sheets.length,3);assert.equal(sheets[0].rows[1][9].style,4);
  const bytes=workbookBytes(sheets);assert.equal(Buffer.from(bytes).readUInt32LE(0),0x04034b50);const output=process.env.FBTQ_TEST_OUTPUT||path.join(process.env.TEMP||process.env.TMP||'.','fbtq-workflows-test.xlsx');fs.writeFileSync(output,bytes);
  console.log('XLSX QA artifact:',output);
});
