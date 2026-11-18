import {fanpageColor} from './inbox-notifications.js?v=20261118-blue-chatbot-menu';
import {pageAvatar} from './inbox-realtime.js?v=20261118-blue-chatbot-menu';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initInboxPagePicker({page,state,onChange,callFunction,showToast}){
 const root=document.createElement('details');root.className='inbox-page-picker';root.innerHTML='<summary><span>Gộp Fanpage</span><b data-page-picker-label>Tất cả Trang</b></summary><div class="inbox-page-picker-body"><p>Tick các Trang muốn hiển thị chung trong hộp thư.</p><div class="inbox-page-picker-actions"><button type="button" data-pages-all>Chọn tất cả</button><button type="button" data-pages-none>Bỏ chọn</button></div><div data-page-picker-options></div><button type="button" class="btn btn-secondary" data-profile-refresh>Cập nhật ảnh đại diện</button><p data-profile-refresh-status role="status"></p></div>';page.querySelector('.inbox-search').after(root);

 let uid='',selected=null,available=[],busy=false,generation=0;
 const storageKey=()=> 'fbtq_inbox_pages_v1_'+uid;
 function account(){const next=state.user?.uid||'';if(next===uid)return;uid=next;selected=null;generation++;root.open=false;root.querySelector('[data-profile-refresh-status]').textContent='';try{const value=JSON.parse(localStorage.getItem(storageKey())||'null');if(Array.isArray(value)&&value.every(id=>typeof id==='string'))selected=value;}catch{}}
 function publish(){state.inboxSelectedPageIds=selected===null?null:[...selected];}
 function change(value){account();selected=value;try{localStorage.setItem(storageKey(),JSON.stringify(selected));}catch{}publish();onChange();}
 root.querySelector('[data-pages-all]').onclick=()=>change(null);root.querySelector('[data-pages-none]').onclick=()=>change([]);
 root.querySelector('[data-page-picker-options]').onchange=e=>{const id=e.target.dataset.pageChoice;if(!id)return;const next=new Set(selected===null?available.map(p=>p.pageId):selected);e.target.checked?next.add(id):next.delete(id);change([...next]);};
 function colorChange(e){const id=e.target.dataset.pageColor;if(id)state.inboxSetPageColor?.(id,e.target.value);}
 root.addEventListener('change',colorChange);root.addEventListener('click',e=>{const id=e.target.closest('[data-page-color-reset]')?.dataset.pageColorReset;if(id)state.inboxSetPageColor?.(id,'');});
 function render(){account();const items=new Map();for(const p of state.pages||[])if(p.pageId)items.set(p.pageId,{...p});for(const t of state.inboxThreads||[])if(t.pageId&&!items.has(t.pageId))items.set(t.pageId,{pageId:t.pageId,pageName:t.pageName||t.pageId});available=[...items.values()];publish();
  const options=root.querySelector('[data-page-picker-options]');const focused=options.contains(document.activeElement)?document.activeElement?.dataset.pageChoice:null;
  const choosing=page.contains(document.activeElement)&&document.activeElement?.matches('[data-page-color]');
  if(!choosing){
  options.innerHTML=available.map(p=>{const count=state.inboxThreads.filter(t=>t.pageId===p.pageId).length,checked=selected===null||selected.includes(p.pageId);return `<div class="fanpage-picker-row"><label><input type="checkbox" data-page-choice="${esc(p.pageId)}" ${checked?'checked':''}><span class="fanpage-choice-name">${pageAvatar(p)}</span><small>${count}</small></label><input type="color" data-page-color="${esc(p.pageId)}" value="${fanpageColor(p)}" aria-label="Màu Fanpage ${esc(p.pageName||p.pageId)}"><button type="button" data-page-color-reset="${esc(p.pageId)}" title="Khôi phục màu mặc định" aria-label="Khôi phục màu ${esc(p.pageName||p.pageId)}">↺</button></div>`;}).join('')||'<p>Chưa có Fanpage. Bấm + Fanpage để kết nối.</p>';}
  if(focused)[...options.querySelectorAll('input')].find(el=>el.dataset.pageChoice===focused)?.focus();
  const count=selected===null?available.length:available.filter(p=>selected.includes(p.pageId)).length;root.querySelector('[data-page-picker-label]').textContent=selected===null?'Tất cả '+count+' Trang':count+' / '+available.length+' Trang';root.querySelector('[data-profile-refresh]').disabled=busy||!state.firebase||!uid||!state.inboxThreads.some(t=>selected===null||selected.includes(t.pageId));
 }
 root.querySelector('[data-profile-refresh]').onclick=async()=>{account();if(busy||!uid||!state.firebase)return;const owner=uid,run=generation,status=root.querySelector('[data-profile-refresh-status]'),rows=state.inboxThreads.filter(t=>selected===null||selected.includes(t.pageId)).sort((a,b)=>Number(!!a.senderPhotoUrl)-Number(!!b.senderPhotoUrl)).slice(0,10),groups=new Map();for(const t of rows){if(!groups.has(t.pageId))groups.set(t.pageId,[]);groups.get(t.pageId).push(t.id);}busy=true;render();status.textContent='Đang kiểm tra và làm mới ảnh từ Meta…';
  try{const results=[];for(const [pageId,threadIds]of groups){const data=await callFunction('refreshMessengerProfiles',{pageId,threadIds},{timeout:125000});if(state.user?.uid!==owner||run!==generation)return;results.push(...data.results);}
   const ready=results.filter(r=>r.status==='ready').length,restricted=results.filter(r=>r.status==='restricted').length;status.textContent=`${ready} / ${results.length} hồ sơ có ảnh từ Meta.${restricted?' '+restricted+' hồ sơ bị Meta giới hạn quyền.':''}${results.length-ready-restricted?' Một số ảnh chưa được Meta trả về; hệ thống sẽ thử lại.':''} Kết quả được lưu và hiển thị tự động.`;
  }catch(e){if(state.user?.uid===owner&&run===generation){status.textContent=e.message||'Không làm mới được ảnh.';showToast?.(status.textContent,'error');}}finally{busy=false;render();}
 };
 return {filter(rows){render();return selected===null?rows:rows.filter(t=>selected.includes(t.pageId));},isAll:()=>selected===null,reset(){change(null);}};
}
