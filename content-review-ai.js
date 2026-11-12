const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Keep UTF-16 offsets so a red phrase selects the exact original textarea range.
export function companyIssues(text,words=[]){
  let normalized='',offset=0;const starts=[],ends=[];
  const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
  for(const char of text){const part=normalize(char);for(let i=0;i<part.length;i++){normalized+=part[i];starts.push(offset);ends.push(offset+char.length);}if(!part&&ends.length)ends[ends.length-1]=offset+char.length;offset+=char.length;}
  const out=[];
  for(const word of [...new Set(words)]){
    const term=normalize(String(word).trim());if(!term)continue;
    let from=0,start;
    while((start=normalized.indexOf(term,from))>=0&&out.length<200){
      const a=starts[start],b=ends[start+term.length-1];
      if(!out.some(row=>row.start===a&&row.end===b))out.push({start:a,end:b,quote:text.slice(a,b),type:'banned',reason:'Thuộc danh sách từ cấm của công ty.',replacement:null,source:'company'});
      from=start+term.length;
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}
export function highlightContent(text,issues){
  const ranges=issues.filter(i=>Number.isInteger(i.start)&&Number.isInteger(i.end)&&i.start>=0&&i.end>i.start&&i.end<=text.length).sort((a,b)=>a.start-b.start);
  const merged=[];for(const row of ranges){const last=merged.at(-1);if(last&&row.start<last.end)last.end=Math.max(last.end,row.end);else merged.push({start:row.start,end:row.end});}
  let html='',from=0;for(const row of merged){html+=escapeHTML(text.slice(from,row.start))+`<mark tabindex="0" role="button" title="Chọn đoạn này để sửa" data-review-ai-start="${row.start}" data-review-ai-end="${row.end}">${escapeHTML(text.slice(row.start,row.end))}</mark>`;from=row.end;}
  return html+escapeHTML(text.slice(from));
}

export function initContentReviewAI({call,words,userId,notify,document:doc=document,delay=1500}){
  const editors=new Map(),cache=new Map();let identity=userId(),sequence=0,queue=Promise.resolve();
  const selector='#contentReviewText,[data-review-manager-text],[data-review-owner-text]';
  const visible=()=>doc.querySelector('#page-content-review')?.classList.contains('active');
  const key=text=>JSON.stringify([userId(),words(),text]);
  function local(editor){return companyIssues(editor.field.value,[...words(),...(editor.result?.companyMatches||[])]);}
  function select(editor,start,end){editor.field.focus();editor.field.setSelectionRange(start,end);editor.field.scrollIntoView({block:'center',behavior:'smooth'});}
  function render(editor){
    const {field,panel}=editor,text=field.value,issues=[...(editor.result?.issues||[]),...local(editor)].filter((row,index,all)=>all.findIndex(other=>other.start===row.start&&other.end===row.end&&other.type===row.type)===index);
    editor.issues=issues;
    const banned=issues.filter(i=>i.type==='banned').length,spelling=issues.filter(i=>i.type==='spelling').length,blocked=editor.result?.blocked||banned>0;
    panel.querySelector('[data-ai-status]').textContent=editor.busy?'Gemini đang đọc nội dung…':editor.error?editor.error:editor.result?(blocked?`Đang chặn: ${banned} đoạn có từ cấm. Hãy sửa trước khi gửi / phê duyệt.`:spelling?`Đã kiểm tra AI · ${spelling} lỗi chính tả cần xem lại.`:'Đã kiểm tra AI · Chưa phát hiện từ cấm hoặc lỗi chính tả.'):banned?`Đã phát hiện ${banned} đoạn thuộc danh sách từ cấm. AI chưa kiểm tra xong.`:'Gemini tự kiểm tra sau khi bạn ngừng gõ. Kết quả cần được người duyệt xem lại.';
    panel.classList.toggle('has-issues',issues.length>0);panel.classList.toggle('has-error',!!editor.error);
    panel.querySelector('[data-ai-check]').disabled=editor.busy||!text.trim();
    panel.querySelector('[data-ai-preview]').innerHTML=highlightContent(text,issues)||'<span class="muted">Nhập nội dung để kiểm tra.</span>';
    panel.querySelector('[data-ai-issues]').innerHTML=issues.map((issue,index)=>`<li><div><b>${issue.type==='banned'?'⊘ Từ cấm':'✎ Chính tả'}: ${escapeHTML(issue.quote)}</b><p>${escapeHTML(issue.reason)}</p>${typeof issue.replacement==='string'?`<small>Gợi ý: ${issue.replacement?escapeHTML(issue.replacement):'Bỏ đoạn này'}</small>`:''}</div><div class="review-ai-issue-actions"><button type="button" class="text-button" data-ai-select="${index}">Chọn để sửa</button>${typeof issue.replacement==='string'?`<button type="button" class="btn btn-secondary" data-ai-fix="${index}">Áp dụng gợi ý</button>`:''}</div></li>`).join('');
  }
  function reset(editor){clearTimeout(editor.timer);editor.version++;editor.text=editor.field.value;editor.result=null;editor.resultKey=null;editor.promise=null;editor.promiseKey=null;editor.error='';editor.busy=false;render(editor);}
  async function check(editor,{force=false}={}){
    if(identity!==userId())clear();
    clearTimeout(editor.timer);
    if(editor.text!==editor.field.value||editor.policy!==JSON.stringify(words())){reset(editor);editor.policy=JSON.stringify(words());}
    const text=editor.field.value,requestKey=key(text),uid=userId(),version=editor.version;
    if(!text.trim()){render(editor);return null;}
    if(editor.promise&&editor.promiseKey===requestKey)return editor.promise;
    if(!force&&cache.has(requestKey)&&cache.get(requestKey).expires>Date.now()){editor.result=cache.get(requestKey).result;editor.resultKey=requestKey;editor.error='';render(editor);return editor.result;}
    if(!uid){editor.error='Đăng nhập Firebase để AI đọc và kiểm tra nội dung.';render(editor);return null;}
    editor.busy=true;editor.error='';render(editor);editor.promiseKey=requestKey;
    const promise=(async()=>{
      try{
        const work=queue.then(()=>{
          if(userId()!==uid||editor.version!==version||!editor.field.isConnected)return null;
          return call({text});
        });queue=work.catch(()=>{});
        const result=await work;
        if(userId()!==uid||editor.version!==version)return null;
        if(!result||!Array.isArray(result.issues)||typeof result.blocked!=='boolean')throw Error('Kết quả AI không hợp lệ. Hãy kiểm tra lại.');
        if(userId()!==uid||editor.version!==version||editor.field.value!==text||key(text)!==requestKey||!editor.field.isConnected)return null;
        cache.set(requestKey,{result,expires:Date.now()+600000});if(cache.size>30)cache.delete(cache.keys().next().value);
        editor.result=result;editor.resultKey=requestKey;return result;
      }catch(error){
        if(userId()===uid&&editor.version===version){editor.error=error.message||'Gemini chưa kiểm tra được. Kiểm tra Firebase AI Logic và App Check.';editor.result=null;editor.resultKey=null;}
        return null;
      }finally{if(editor.version===version&&userId()===uid){editor.busy=false;editor.promise=null;render(editor);}}
    })();editor.promise=promise;return promise;
  }
  function schedule(editor){clearTimeout(editor.timer);if(visible()&&editor.field.value.trim())editor.timer=setTimeout(()=>check(editor),delay);}
  function attach(field){
    if(editors.has(field))return editors.get(field);
    const panel=doc.createElement('section');panel.className='review-ai-panel';panel.setAttribute('aria-label','Kiểm tra nội dung bằng AI');
    const id='review-ai-status-'+(++sequence);panel.innerHTML=`<div class="review-ai-heading"><b>✦ Gemini · Từ cấm & chính tả</b><button type="button" class="btn btn-secondary" data-ai-check>Kiểm tra lại</button></div><p id="${id}" data-ai-status role="status" aria-live="polite"></p><small class="muted">Firebase AI Logic · Đoạn đỏ là phần cần sửa. Bấm đoạn đỏ để chọn vị trí trong ô nội dung.</small><div class="review-ai-preview" data-ai-preview></div><ul class="review-ai-issues" data-ai-issues></ul>`;
    // Place outside the label so check/fix buttons never activate the textarea label.
    const label=field.closest('label');(label||field).after(panel);field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),id].filter(Boolean).join(' '));
    const editor={field,panel,text:field.value,policy:JSON.stringify(words()),version:0,result:null,error:'',busy:false};editors.set(field,editor);
    field.addEventListener('input',()=>{reset(editor);schedule(editor);});
    field.addEventListener('focus',()=>{if(!editor.result||editor.resultKey!==key(field.value))schedule(editor);});
    panel.addEventListener('click',event=>{
      if(event.target.closest('[data-ai-check]')){check(editor,{force:true});return;}
      const mark=event.target.closest('[data-review-ai-start]');if(mark){select(editor,Number(mark.dataset.reviewAiStart),Number(mark.dataset.reviewAiEnd));return;}
      const button=event.target.closest('[data-ai-select],[data-ai-fix]');if(!button)return;
      const issue=editor.issues[Number(button.dataset.aiSelect??button.dataset.aiFix)];if(!issue)return;
      if(button.hasAttribute('data-ai-fix')&&typeof issue.replacement==='string'){
        if(field.value.slice(issue.start,issue.end)!==issue.quote){reset(editor);schedule(editor);return;}
        if(field.value.length-(issue.end-issue.start)+issue.replacement.length>8000){notify('Bản sửa vượt giới hạn 8.000 ký tự. Hãy sửa thủ công.','error');return;}
        field.setRangeText(issue.replacement,issue.start,issue.end,'select');field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();
      }else select(editor,issue.start,issue.end);
    });
    panel.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-review-ai-start]')){event.preventDefault();event.target.click();}});
    render(editor);return editor;
  }
  function refresh(){
    if(identity!==userId())clear();
    for(const [field,editor]of editors)if(!field.isConnected){clearTimeout(editor.timer);editor.version++;editors.delete(field);}
    for(const field of doc.querySelectorAll(selector)){
      const editor=attach(field);if(editor.text!==field.value||editor.policy!==JSON.stringify(words())){reset(editor);editor.policy=JSON.stringify(words());if(field.id==='contentReviewText')schedule(editor);}else render(editor);
    }
  }
  function clear(){identity=userId();cache.clear();for(const editor of editors.values()){reset(editor);editor.policy=JSON.stringify(words());} }
  async function ensureAllowed(text,field){
    const uid=userId(),editor=field?attach(field):null;
    if(!editor){notify('Mở bài viết trong mục Kiểm duyệt nội dung để AI kiểm tra trước khi phê duyệt.','error');return false;}
    if(field.value.trim()!==text.trim()){notify('Nội dung đã thay đổi. Hãy kiểm tra lại.','error');return false;}
    // Revalidate company policy on the server before any positive workflow action.
    const result=await check(editor,{force:true});
    if(userId()!==uid||field.value.trim()!==text.trim()){notify('Nội dung hoặc tài khoản đã thay đổi. Hãy kiểm tra lại.','error');return false;}
    if(!result){notify(editor.error||'AI chưa kiểm tra xong. Hãy kiểm tra lại trước khi gửi / phê duyệt.','error');editor.panel.scrollIntoView({block:'center'});return false;}
    if(editor.resultKey!==key(field.value)){notify('Danh sách từ cấm đã thay đổi. Hãy kiểm tra lại.','error');return false;}
    if(result.blocked||local(editor).length){notify('Nội dung có từ bị cấm. Hãy sửa các đoạn màu đỏ trước khi tiếp tục.','error');editor.panel.scrollIntoView({block:'center'});return false;}
    return true;
  }
  const observer=new MutationObserver(refresh);const list=doc.querySelector('#contentReviewList');if(list)observer.observe(list,{childList:true});refresh();
  return {refresh,clear,ensureAllowed};
}
