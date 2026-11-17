const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createReviewRewrite({field,panel,call,userId,words,notify}){
 const doc=field.ownerDocument,box=doc.createElement('div');box.className='review-rewrite';
 box.innerHTML='<div class="review-rewrite-heading"><div><b>✦ AI biên tập bài viết</b><small>OpenAI đề xuất câu chữ rõ ràng, hấp dẫn hơn, giữ thông tin đã cung cấp.</small></div><button type="button" class="btn btn-primary" data-rewrite-start>AI phân tích & chỉnh bài</button></div><label>Yêu cầu chỉnh thêm (tuỳ chọn)<input data-rewrite-goal maxlength="800" placeholder="Ví dụ: Mở đầu cuốn hút, giọng gần gũi, giữ các thông tin chính"></label><p data-rewrite-status role="status" aria-live="polite">Xem bản đề xuất rồi Hoàn tất chỉnh sửa để cập nhật ô nội dung. Gửi duyệt và phê duyệt dùng nút riêng.</p><div data-rewrite-proposal hidden><div class="review-rewrite-compare"><div><b>Bản hiện tại</b><pre data-rewrite-original></pre></div><label>Bản đề xuất — có thể sửa tiếp<textarea data-rewrite-draft maxlength="8000" rows="9"></textarea></label></div><ul data-rewrite-notes></ul><p data-rewrite-words></p><div class="review-rewrite-actions"><button type="button" class="btn btn-primary" data-rewrite-apply>Hoàn tất chỉnh sửa</button><button type="button" class="btn btn-secondary" data-rewrite-cancel>Giữ bản hiện tại</button></div></div><button type="button" class="btn btn-secondary" data-rewrite-undo disabled>↶ Hoàn tác chỉnh sửa</button>';
 panel.append(box);const q=s=>box.querySelector(s),history=[];let owner=userId(),policy=JSON.stringify(words()),revision=0,requestId=0,busy=false,proposal=null,committing=false,disposed=false;
 const status=text=>{q('[data-rewrite-status]').textContent=text;};
 function controls(){q('[data-rewrite-start]').disabled=busy||!field.value.trim();q('[data-rewrite-goal]').disabled=busy;q('[data-rewrite-undo]').disabled=busy||!history.length;q('[data-rewrite-apply]').disabled=busy||!proposal||!q('[data-rewrite-draft]').value.trim();q('[data-rewrite-proposal]').hidden=!proposal;}
 function draftStatus(){const matches=globalThis.FBTQKeywords.findKeywordMatches(q('[data-rewrite-draft]').value,[...words(),...(proposal?.companyMatches||[])]);q('[data-rewrite-words]').textContent=matches.length?'Bản đề xuất còn từ khoá công ty: '+[...new Set(matches.map(m=>m.word))].join(', ')+'. Nội dung sẽ được kiểm tra lại sau khi áp dụng.':'Chưa thấy từ khoá công ty khớp trong bản đề xuất. Nội dung sẽ được kiểm tra lại sau khi áp dụng.';controls();}
 function showProposal(base,text,notes,undoRecord=null,companyMatches=[]){proposal={base,undoRecord,companyMatches};q('[data-rewrite-original]').textContent=base;q('[data-rewrite-draft]').value=text;q('[data-rewrite-notes]').innerHTML=notes.map(note=>'<li>'+esc(note)+'</li>').join('');status('Đã có bản đề xuất. Đọc và sửa tiếp nếu cần, rồi bấm Hoàn tất chỉnh sửa.');draftStatus();}
 function write(text){committing=true;revision++;proposal=null;field.value=text;field.dispatchEvent(new Event('input',{bubbles:true}));committing=false;field.focus();controls();}
 async function start(){
  refresh();if(busy||!field.value.trim())return;if(!userId())return status('Đăng nhập trước khi dùng AI biên tập.');
  const uid=userId(),base=field.value,version=revision,ticket=++requestId;busy=true;proposal=null;status('AI đang đọc và đề xuất chỉnh sửa…');controls();
  try{
   const result=await call({text:base,goal:q('[data-rewrite-goal]').value});
   if(disposed||uid!==userId()||ticket!==requestId||!field.isConnected)return;
   if(version!==revision||base!==field.value){status('Nội dung đã thay đổi trong lúc AI chạy. Bấm phân tích lại để có bản đề xuất mới.');return;}
   if(!result||typeof result.text!=='string'||!result.text.trim()||result.text.length>8000||!Array.isArray(result.improvements)||result.improvements.some(s=>typeof s!=='string'))throw Error('Bản đề xuất chưa hợp lệ. Nội dung gốc được giữ nguyên.');
   showProposal(base,result.text,result.improvements,null,Array.isArray(result.companyMatches)?result.companyMatches.filter(w=>typeof w==='string'):[]);
  }catch(e){if(!disposed&&uid===userId()&&ticket===requestId)status(e.message||'AI chưa chỉnh được bài. Nội dung gốc được giữ nguyên.');}
  finally{if(!disposed&&ticket===requestId){busy=false;controls();}}
 }
 function apply(){
  if(!proposal||busy)return;refresh();if(!proposal)return;
  if(field.value!==proposal.base){proposal=null;status('Nội dung đã đổi. Hãy tạo lại đề xuất trước khi áp dụng.');controls();return;}
  const text=q('[data-rewrite-draft]').value;if(!text.trim()||text.length>8000)return status('Bản sửa cần từ 1 đến 8.000 ký tự.');
  const before=field.value,undoRecord=proposal.undoRecord;
  if(undoRecord&&history.at(-1)===undoRecord)history.pop();else if(text!==before){history.push({before,after:text});if(history.length>10)history.shift();}
  write(text);status('Đã hoàn tất chỉnh sửa trong ô nội dung. Hệ thống đang kiểm tra lại; bài chưa tự gửi duyệt.');notify('Đã áp dụng bản chỉnh sửa. Có thể Hoàn tác.');
 }
 function undo(){
  refresh();if(busy||!history.length)return;const last=history.at(-1);
  if(field.value!==last.after){showProposal(field.value,last.before,['Bạn đã sửa tiếp sau lần dùng AI. Xem bản khôi phục rồi Hoàn tất chỉnh sửa nếu muốn quay lại.'],last);return;}
  history.pop();write(last.before);status('Đã khôi phục nội dung trước lần chỉnh sửa. Hệ thống sẽ kiểm tra lại.');notify('Đã hoàn tác chỉnh sửa.');
 }
 function input(){if(committing)return;revision++;if(proposal){proposal=null;status('Ô nội dung đã thay đổi. Bấm AI phân tích để tạo lại bản đề xuất.');}if(!field.value.trim())history.length=0;controls();}
 function clear(){owner=userId();policy=JSON.stringify(words());revision++;requestId++;busy=false;proposal=null;history.length=0;q('[data-rewrite-goal]').value='';q('[data-rewrite-draft]').value='';q('[data-rewrite-original]').textContent='';q('[data-rewrite-notes]').replaceChildren();status('Xem bản đề xuất rồi Hoàn tất chỉnh sửa để cập nhật ô nội dung.');controls();}
 function refresh(){if(owner!==userId())clear();if(policy!==JSON.stringify(words())){policy=JSON.stringify(words());revision++;proposal=null;status('Danh sách từ khoá đã thay đổi. Hãy tạo lại đề xuất nếu cần.');}if(!field.value.trim())history.length=0;controls();}
 q('[data-rewrite-goal]').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();start();}});q('[data-rewrite-start]').onclick=start;q('[data-rewrite-apply]').onclick=apply;q('[data-rewrite-undo]').onclick=undo;q('[data-rewrite-draft]').oninput=draftStatus;q('[data-rewrite-cancel]').onclick=()=>{proposal=null;status('Đã bỏ bản đề xuất. Ô nội dung được giữ nguyên.');controls();};field.addEventListener('input',input);controls();
 return {refresh,clear,dispose(){disposed=true;requestId++;field.removeEventListener('input',input);history.length=0;proposal=null;}};
}
