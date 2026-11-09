export const vnToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function compareDailyReports(reports,{dateA,dateB,uid='all'}={}){
  const sum=date=>reports.filter(r=>r.reportDate===date&&(uid==='all'||r.createdBy===uid)).reduce((a,r)=>{a.spend+=Number(r.spend??r.actualSpend)||0;a.messages+=Number(r.messages)||0;a.phones+=Number(r.phoneLeads)||0;a.revenue+=Number(r.revenue)||0;a.campaigns+=r.isOtherRevenue?0:1;return a;},{spend:0,messages:0,phones:0,revenue:0,campaigns:0});
  const a=sum(dateA),b=sum(dateB);return {a,b,delta:Object.fromEntries(Object.keys(a).map(key=>[key,b[key]-a[key]]))};
}
export function safeChatMessages(rows){
  return [...new Map((Array.isArray(rows)?rows:[]).filter(r=>r&&typeof r.id==='string'&&['user','assistant'].includes(r.role)&&typeof r.text==='string'&&typeof r.createdAt==='string').map(r=>[r.id,{id:r.id,role:r.role,text:r.text.slice(0,12000),createdAt:r.createdAt,pending:!!r.pending}])).values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function createAssistantHistory({getUser,getFirebase,onRestore,onStatus,storage=localStorage}){
  let uid='',messages=[],lastDoc=null,more=false,epoch=0,writing=false;
  const cacheKey=()=>`fbtq_assistant_chat_v2_${uid}`;
  function cache(){try{storage.setItem(cacheKey(),JSON.stringify(messages.slice(-200)));}catch{onStatus?.('Lịch sử trên máy đã đầy; kiểm tra đồng bộ Firebase.');}}
  async function flush(){
    const f=getFirebase();if(writing||!uid||!f?.storeMod?.setDoc)return;
    writing=true;const run=epoch,owner=uid;let completed=false;
    try{
      for(const message of messages.filter(r=>r.pending)){
        if(run!==epoch||getUser()?.uid!==owner)return;
        const {pending,...data}=message;
        await f.storeMod.setDoc(f.storeMod.doc(f.db,'workspaces','fbtq','assistantChatMessages',message.id),{...data,createdBy:owner});
        if(run!==epoch)return;message.pending=false;
      }
      cache();completed=true;onStatus?.('Lịch sử đã đồng bộ');
    }catch(error){if(run===epoch){cache();onStatus?.(`Lịch sử đã lưu trên máy · chưa đồng bộ (${error.code||'mất kết nối'})`);}}
    finally{if(run===epoch){writing=false;if(completed&&messages.some(r=>r.pending))queueMicrotask(()=>flush());}}
  }
  function record(role,text){
    if(!uid||uid!==getUser()?.uid)return;
    messages.push({id:crypto.randomUUID(),role,text:String(text).slice(0,12000),createdAt:new Date().toISOString(),pending:true});cache();void flush();
  }
  async function load(older=false){
    const f=getFirebase(),run=epoch;if(!uid||!f?.storeMod?.getDocs){onStatus?.('Lịch sử lưu riêng trên máy');return;}
    const s=f.storeMod;
    try{
      const clauses=[s.where('createdBy','==',uid),s.orderBy('createdAt','desc')];if(older&&lastDoc)clauses.push(s.startAfter(lastDoc));clauses.push(s.limit(100));
      const snapshot=await s.getDocs(s.query(s.collection(f.db,'workspaces','fbtq','assistantChatMessages'),...clauses));if(run!==epoch)return;
      const loaded=snapshot.docs.map(doc=>({...doc.data(),id:doc.id,pending:false}));more=snapshot.docs.length===100;lastDoc=snapshot.docs.at(-1)||lastDoc;
      const pending=messages.filter(m=>m.pending&&!loaded.some(r=>r.id===m.id));messages=safeChatMessages([...loaded,...messages.filter(m=>!loaded.some(r=>r.id===m.id)),...pending]);cache();onRestore?.(messages,more);onStatus?.('Lịch sử đã tải');await flush();
    }catch(error){if(run===epoch)onStatus?.(`Lịch sử lưu trên máy · không tải được từ Firebase (${error.code||'mất kết nối'})`);}
  }
  function start(){stop();uid=getUser()?.uid||'';if(!uid)return;try{messages=safeChatMessages(JSON.parse(storage.getItem(cacheKey())||'[]'));}catch{messages=[];}onRestore?.(messages,false);onStatus?.('Đang tải lịch sử…');void load();}
  function stop(){epoch++;uid='';messages=[];lastDoc=null;more=false;writing=false;}
  return {record,start,stop,loadOlder:()=>load(true),sync:flush};
}

export function initActionApproval({getUser,esc,onLog,onError}){
  const passed=new WeakSet();let cancelPending=null;
  const fingerprint=form=>JSON.stringify([...new FormData(form)].map(([k,v])=>[k,typeof v==='string'?v:[v.name,v.size,v.lastModified]]) .concat([...form.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value])));
  function cancel(){cancelPending?.();}
  async function ask(form,submitter){
    cancel();const user=getUser();if(!user)return false;const actor=user.uid,signature=fingerprint(form),started=Date.now();
    const root=document.createElement('div');root.className='assistant-approval-overlay';root.id='assistantActionApproval';
    const title=form.closest('.modal')?.querySelector('h3')?.textContent||form.closest('.page')?.querySelector('h1')?.textContent||'Thao tác hệ thống';
    const rows=[...form.querySelectorAll('input,select,textarea')].filter(input=>!input.disabled&&input.type!=='password'&&input.type!=='hidden'&&(input.value||input.files?.length)).slice(0,24).map(input=>{
      const label=input.closest('label')?.querySelector('span')?.textContent||input.name||input.dataset.field||'Thông tin';
      const value=input.type==='file'?[...input.files].map(f=>f.name).join(', '):input.tagName==='SELECT'?input.selectedOptions[0]?.textContent:input.value;
      return `<div><dt>${esc(label)}</dt><dd>${esc(String(value||'').slice(0,500))}</dd></div>`;
    }).join('');
    root.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="assistantApprovalTitle"><h3 id="assistantApprovalTitle">Xác thực thao tác</h3><p><b>${esc(title)}</b> · ${esc(user.name||user.email||'Tài khoản')}</p><p>Kiểm tra nội dung trước khi cho phép hệ thống thực hiện. Quyền tài khoản vẫn được kiểm tra khi lưu.</p><dl>${rows||'<p>Thực hiện thao tác đã chọn trên biểu mẫu.</p>'}</dl><footer><button type="button" class="btn btn-secondary" data-action-reject>Từ Chối</button><button type="button" class="btn btn-primary" data-action-approve>Phê Duyệt</button></footer></section>`;
    form.inert=true;document.body.append(root);
    return new Promise(resolve=>{
      let done=false;const finish=approved=>{if(done)return;done=true;clearTimeout(timer);form.inert=false;root.remove();cancelPending=null;
        const valid=approved&&form.isConnected&&getUser()?.uid===actor&&Date.now()-started<300000&&fingerprint(form)===signature;
        onLog?.(valid?`Đã phê duyệt thao tác: ${title}.`:`Đã từ chối/hủy thao tác: ${title}.`);resolve(valid);
      };
      const timer=setTimeout(()=>finish(false),300000);cancelPending=()=>finish(false);
      root.querySelector('[data-action-reject]').onclick=()=>finish(false);root.querySelector('[data-action-approve]').onclick=()=>finish(true);root.querySelector('[data-action-reject]').focus();
    });
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!(form instanceof HTMLFormElement)||!getUser()||['assistantCommandForm','fbtqAssistantForm','loginForm','registerForm'].includes(form.id))return;
    if(!form.closest('#app,#modalRoot'))return;
    if(passed.has(form)){passed.delete(form);return;}
    event.preventDefault();event.stopImmediatePropagation();const submitter=event.submitter;
    try{if(await ask(form,submitter)){passed.add(form);form.requestSubmit(submitter?.isConnected?submitter:undefined);}}catch(error){passed.delete(form);onError?.(error.message);}
  },true);
  return {cancel};
}
