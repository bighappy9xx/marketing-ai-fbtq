import {timecode,highlightOptions,highlightSourceKey,highlightReport,highlightCSV} from './studio-highlights-core.js?v=20261112-highlights';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initStudioHighlights(panel,{getState,call,execute,message,seek,splitMoment}){
  let result=null,source=null,revision=0,owner=getState().uid,cutPlan=null;
  const section=document.createElement('section');section.className='cs-ai-highlights';section.innerHTML=`<h3>✦ Tìm khoảnh khắc hấp dẫn</h3><p>Gemini đọc hình ảnh và âm thanh video đang chọn. Nhận bảng cắt, nội dung đăng và gợi ý dựng qua Firebase AI Logic.</p><div class="cs-highlights-options"><label>Số clip muốn tìm<input id="csHighlightsCount" type="number" min="1" max="10" step="1" value="3"></label><label>Tối thiểu (giây)<input id="csHighlightsMin" type="number" min="5" max="180" step="1" value="10"></label><label>Tối đa (giây)<input id="csHighlightsMax" type="number" min="5" max="180" step="1" value="60"></label></div><label>Nền tảng<select id="csHighlightsPlatform"><option>TikTok / Reels / Shorts</option><option>TikTok</option><option>Facebook Reels</option><option>YouTube Shorts</option></select></label><label>Khán giả & mục tiêu<textarea id="csHighlightsGoal" maxlength="1000" rows="2" placeholder="Ví dụ: Người mới tìm hiểu sản phẩm, ưu tiên chia sẻ kiến thức..."></textarea></label><button type="button" class="cs-ai-primary" data-highlight-action="analyze">Phân tích khoảnh khắc hấp dẫn</button><small>Phân tích đoạn đang chọn tối đa 10 phút; file nguồn tối đa 12 MB. Video được gửi tới Gemini khi bấm phân tích. Số clip thực tế phụ thuộc nội dung.</small><div id="csHighlightsResult" hidden></div><div id="csHighlightsCutConfirm" hidden></div>`;
  panel.querySelector('.cs-ai-video').before(section);const q=s=>section.querySelector(s);
  function currentSource(){return source&&getState().clips.find(c=>c.id===source.id);}
  function requireResult(){if(!result||highlightSourceKey(getState().uid,currentSource())!==source.key)throw Error('Đoạn nguồn đã thay đổi. Phân tích lại trước khi dùng kết quả.');return currentSource();}
  function draw(){
    const target=q('#csHighlightsResult');target.hidden=!result;panel.classList.toggle('cs-ai-panel--highlights',!!result);
    if(!result){target.textContent='';return;}
    const cues=(rows,label)=>`<div class="cs-highlight-cues"><b>${label}</b>${rows.length?'<ul>'+rows.map(c=>`<li><time>${timecode(c.at)}</time> ${esc(c.advice)}</li>`).join('')+'</ul>':'<p>Không đề xuất thêm ở đoạn này.</p>'}</div>`;
    target.innerHTML=`<div class="cs-highlights-result-heading"><h3>${result.moments.length}/${result.options.count} khoảnh khắc · ${esc(result.sourceName)}</h3><div><button type="button" data-highlight-action="copy">Sao chép kế hoạch</button><button type="button" data-highlight-action="csv">Xuất bảng CSV</button></div></div><p>Timecode tính từ đầu file nguồn. Gợi ý khả năng thu hút, không bảo đảm viral. Các hiệu ứng, nhạc và phụ đề bên dưới là đề xuất để bạn dựng tiếp.</p>${result.note?`<p class="cs-highlights-note">${esc(result.note)}</p>`:''}${result.moments.length?`<div class="cs-highlights-table-scroll"><table class="cs-highlights-table"><caption>Bảng timeline đề xuất cắt clip</caption><thead><tr><th scope="col">STT</th><th scope="col">Timecode Start</th><th scope="col">Timecode End</th><th scope="col">Câu nói / hành động</th><th scope="col">Lý do hấp dẫn</th></tr></thead><tbody>${result.moments.map(m=>`<tr><td>${m.number}</td><td><button type="button" data-highlight-action="seek" data-number="${m.number}">${timecode(m.start)}</button></td><td>${timecode(m.end)}</td><td>${esc(m.summary)}</td><td>${esc(m.reason)}</td></tr>`).join('')}</tbody></table></div><div class="cs-highlights-cards">${result.moments.map(m=>`<article class="cs-highlight-card" data-highlight-card="${m.number}"><div class="cs-highlight-card-heading"><b>Đoạn ${m.number} · ${timecode(m.start)} → ${timecode(m.end)}</b><span>${(m.end-m.start).toFixed(1)} giây</span></div><p><b>Hook:</b> ${esc(m.hook)}</p><h4>${esc(m.title)}</h4><p class="cs-highlight-description">${esc(m.description)}</p><p class="cs-highlight-hashtags">${m.hashtags.map(esc).join(' ')}</p><div class="cs-highlight-editing">${cues(m.transitions,'Chuyển cảnh')}${cues(m.music,'Nhạc nền')}${cues(m.subtitles,'Phụ đề & từ khoá')}</div><div class="cs-highlight-actions"><button type="button" data-highlight-action="seek" data-number="${m.number}">Đến đoạn này trên timeline</button><button type="button" data-highlight-action="copy-clip" data-number="${m.number}">Sao chép nội dung clip</button><button type="button" data-highlight-action="split" data-number="${m.number}">Đặt điểm cắt đoạn ${m.number}</button></div></article>`).join('')}</div>`:'<p>Chưa tìm được đoạn phù hợp. Thử chọn video khác hoặc nới thời lượng.</p>'}`;
  }
  async function analyze(){
    const s=getState(),clip=s.current;if(s.mode!=='video'||!clip||clip.type!=='video'||clip.locked)throw Error('Chọn một đoạn video đã mở khoá trên timeline để tìm khoảnh khắc.');
    const resource=s.resources.get(clip.mediaId);if(!resource)throw Error('Không tìm thấy video nguồn.');
    const options=highlightOptions({count:Number(q('#csHighlightsCount').value),minDuration:Number(q('#csHighlightsMin').value),maxDuration:Number(q('#csHighlightsMax').value),platform:q('#csHighlightsPlatform').value,goal:q('#csHighlightsGoal').value});
    const uid=s.uid,key=highlightSourceKey(uid,clip),version=++revision,snapshot=structuredClone(clip);
    result=null;source=null;cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;draw();message('Gemini đang xem video, chọn hook và lập bảng timeline…');
    const data=await call('analyzeStudioHighlights',{blob:resource.blob,clip:snapshot,options});
    if(uid!==getState().uid||version!==revision)return;
    const latest=getState().clips.find(c=>c.id===snapshot.id);
    if(highlightSourceKey(uid,latest)!==key)throw Error('Đoạn video đã thay đổi trong lúc phân tích. Hãy phân tích lại.');
    source={id:snapshot.id,key};result={...data,sourceName:resource.name||clip.name||'Video',options};draw();
    message(`Đã tìm ${result.moments.length}/${options.count} khoảnh khắc. Xem timecode và gợi ý dựng bên dưới.`);
  }
  section.addEventListener('click',event=>{
    const button=event.target.closest('[data-highlight-action]');if(!button)return;const action=button.dataset.highlightAction;
    execute(async()=>{
      if(action==='analyze'){await analyze();return;}
      if(action==='cancel'){cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;return;}
      const clip=requireResult(),moment=result.moments.find(m=>m.number===button.dataset.number);
      if(action==='seek'){if(moment)seek(clip.start+moment.start-(clip.in||0));return;}
      if(action==='copy'||action==='copy-clip'){await navigator.clipboard.writeText(highlightReport(action==='copy'?result:{...result,moments:moment?[moment]:[]}));message('Đã sao chép kế hoạch clip.');return;}
      if(action==='csv'){const url=URL.createObjectURL(new Blob([highlightCSV(result)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='FBTQ-khoanh-khac-video.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Đã xuất bảng timeline CSV.');return;}
      if(action==='split'&&moment){
        cutPlan={clipId:clip.id,moment,signature:JSON.stringify(getState().clips)};
        q('#csHighlightsCutConfirm').hidden=false;q('#csHighlightsCutConfirm').innerHTML=`<b>Đặt hai điểm cắt · Đoạn ${moment.number}</b><p>Tách video tại ${timecode(moment.start)} và ${timecode(moment.end)} theo file nguồn. Giữ phần trước/sau và vị trí các lớp khác. Sau khi tách, chọn đoạn để chỉnh tiếp; dùng Hoàn tác nếu cần.</p><button type="button" data-highlight-action="confirm">Xác nhận đặt điểm cắt</button><button type="button" data-highlight-action="cancel">Huỷ</button>`;q('#csHighlightsCutConfirm').scrollIntoView({block:'nearest'});return;
      }
      if(action==='confirm'&&cutPlan){await splitMoment(cutPlan);cutPlan=null;result=null;source=null;q('#csHighlightsCutConfirm').hidden=true;draw();message('Đã tách và chọn khoảnh khắc trên timeline. Có thể dùng Hoàn tác.');}
    });
  });
  function reset(){revision++;owner=getState().uid;result=null;source=null;cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;draw();}
  function sync(){const s=getState();if(s.uid!==owner)reset();section.hidden=s.mode!=='video';panel.classList.toggle('cs-ai-panel--highlights',s.mode==='video'&&!!result);if(result&&highlightSourceKey(s.uid,currentSource())!==source.key){reset();message('Đoạn nguồn đã thay đổi. Phân tích lại để có bảng timecode mới.');}}
  return {sync,reset};
}
