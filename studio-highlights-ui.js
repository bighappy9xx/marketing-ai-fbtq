import {timecode,highlightOptions,highlightSourceKey,highlightReport,highlightCSV} from './studio-highlights-core.js?v=20261112-wide-studio';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initStudioHighlights(panel,{getState,call,execute,message,seek,splitMoment}){
  let result=null,source=null,revision=0,owner=getState().uid,cutPlan=null;
  let chosenMediaId='',lastTimelineMediaId='',playerMediaId='',controller=null,analyzingKey='';
  const section=document.createElement('section');section.className='cs-ai-highlights';section.innerHTML='<div class="cs-highlights-workspace"><div class="cs-highlights-view"><div class="cs-highlights-video-heading"><div><span class="cs-highlights-eyebrow">VIDEO NGUỒN</span><h3 id="csHighlightsVideoName">Thêm video để bắt đầu</h3><p id="csHighlightsVideoMeta">Nguồn tối đa 8 GB/file · Xem và phân tích toàn bộ video</p></div><button type="button" data-highlight-action="import">＋ Thêm video</button></div><video id="csHighlightsPlayer" controls playsinline preload="metadata" aria-label="Xem toàn bộ video nguồn"></video><div id="csHighlightsEmpty" class="cs-highlights-empty"><b>Video của bạn sẽ hiện ở đây</b><span>Bấm Thêm video. Studio tự chọn video vừa nhập để phân tích.</span></div><div class="cs-highlights-video-footer"><span>Xem đầy đủ video bằng thanh phát hoặc mở toàn màn hình.</span><button type="button" data-highlight-action="fullscreen">⛶ Toàn màn hình</button></div></div><div class="cs-highlights-settings"><span class="cs-highlights-eyebrow">THIẾT LẬP CLIP NGẮN</span><h3>Tự tìm khoảnh khắc hấp dẫn</h3><p>AI tự chọn số đoạn phù hợp dựa trên nội dung toàn bộ video.</p><label>Video trong project<select id="csHighlightsVideoSelect" aria-label="Video nguồn để phân tích"></select></label><div class="cs-highlights-options"><label>Tối thiểu (giây)<input id="csHighlightsMin" type="number" min="5" max="180" step="1" value="10"></label><label>Tối đa (giây)<input id="csHighlightsMax" type="number" min="5" max="180" step="1" value="60"></label></div><label>Nền tảng<select id="csHighlightsPlatform"><option>TikTok / Reels / Shorts</option><option>TikTok</option><option>Facebook Reels</option><option>YouTube Shorts</option></select></label><label>Khán giả & mục tiêu<textarea id="csHighlightsGoal" maxlength="1000" rows="3" placeholder="Ví dụ: Người mới tìm hiểu sản phẩm, ưu tiên chia sẻ kiến thức..."></textarea></label><button type="button" class="cs-ai-primary" data-highlight-action="analyze">✦ Phân tích toàn bộ video</button><div id="csHighlightsProgress" hidden><label for="csHighlightsProgressBar" id="csHighlightsProgressText">Đang chuẩn bị…</label><progress id="csHighlightsProgressBar" max="100" value="0"></progress><button type="button" data-highlight-action="cancel-analysis">Dừng phân tích</button></div><small>Gemini qua Firebase AI Logic. Video lớn được nén và phân tích từng phần trên máy. Giữ tab mở; thời gian và số lượt AI phụ thuộc độ dài video.</small></div></div><div id="csHighlightsResult" hidden></div><div id="csHighlightsCutConfirm" hidden></div>';
  panel.querySelector('.cs-ai-video').before(section);const q=s=>section.querySelector(s),player=q('#csHighlightsPlayer');
  function available(){const s=getState(),ids=[...new Set(s.clips.filter(c=>c.type==='video').map(c=>c.mediaId))];return ids.map(id=>s.resources.get(id)).filter(Boolean);}
  function videoSource(){
    const s=getState(),resources=available(),timelineId=s.current?.type==='video'?s.current.mediaId:'';
    if(timelineId&&timelineId!==lastTimelineMediaId){chosenMediaId=timelineId;lastTimelineMediaId=timelineId;}
    if(!resources.some(r=>r.key===chosenMediaId))chosenMediaId=resources.at(-1)?.key||'';
    const resource=resources.find(r=>r.key===chosenMediaId);if(!resource)return null;
    return {resource,clip:{id:'source:'+resource.key,mediaId:resource.key,type:'video',name:resource.name,in:0,start:0,duration:resource.duration,sourceDuration:resource.duration}};
  }
  function refreshVideo(){
    const selected=videoSource(),resources=available(),signature=JSON.stringify(resources.map(r=>[r.key,r.name]));
    if(q('#csHighlightsVideoSelect').dataset.options!==signature){q('#csHighlightsVideoSelect').innerHTML=resources.map(r=>'<option value="'+esc(r.key)+'">'+esc(r.name)+'</option>').join('')||'<option value="">Chưa có video</option>';q('#csHighlightsVideoSelect').dataset.options=signature;}
    q('#csHighlightsVideoSelect').value=chosenMediaId;
    const resource=selected?.resource,mediaId=resource?.key||'';
    if(mediaId!==playerMediaId){player.pause();playerMediaId=mediaId;if(resource)player.src=resource.url;else{player.removeAttribute('src');player.load();}}
    player.hidden=!resource;q('#csHighlightsEmpty').hidden=!!resource;
    q('#csHighlightsVideoName').textContent=resource?.name||'Thêm video để bắt đầu';
    q('#csHighlightsVideoMeta').textContent=resource?timecode(resource.duration)+' · '+(resource.blob.size/1024**2>=1024?(resource.blob.size/1024**3).toFixed(2)+' GB':(resource.blob.size/1024**2).toFixed(1)+' MB')+' · Phân tích toàn bộ nguồn':'Nguồn tối đa 8 GB/file · Tự chọn video vừa thêm';
    return selected;
  }
  function currentSource(){const v=videoSource();return v?.clip.mediaId===source?.mediaId?v.clip:null;}
  function timelineClip(moment){return getState().clips.find(c=>c.type==='video'&&c.mediaId===source?.mediaId&&(c.in||0)<=moment.start+.0001&&(c.in||0)+c.duration>=moment.end-.0001);}
  function requireResult(){if(!result||highlightSourceKey(getState().uid,currentSource())!==source.key)throw Error('Đoạn nguồn đã thay đổi. Phân tích lại trước khi dùng kết quả.');return currentSource();}
  function draw(){
    const target=q('#csHighlightsResult');target.hidden=!result;panel.classList.toggle('cs-ai-panel--highlights',!!result);
    if(!result){target.textContent='';return;}
    const cues=(rows,label)=>`<div class="cs-highlight-cues"><b>${label}</b>${rows.length?'<ul>'+rows.map(c=>`<li><time>${timecode(c.at)}</time> ${esc(c.advice)}</li>`).join('')+'</ul>':'<p>Không đề xuất thêm ở đoạn này.</p>'}</div>`;
    target.innerHTML=`<div class="cs-highlights-result-heading"><h3>${result.moments.length} khoảnh khắc · ${esc(result.sourceName)}</h3><div><button type="button" data-highlight-action="copy">Sao chép kế hoạch</button><button type="button" data-highlight-action="csv">Xuất bảng CSV</button></div></div><p>Timecode tính từ đầu file nguồn. Gợi ý khả năng thu hút, không bảo đảm viral. Các hiệu ứng, nhạc và phụ đề bên dưới là đề xuất để bạn dựng tiếp.</p>${result.note?`<p class="cs-highlights-note">${esc(result.note)}</p>`:''}${result.moments.length?`<div class="cs-highlights-table-scroll"><table class="cs-highlights-table"><caption>Bảng timeline đề xuất cắt clip</caption><thead><tr><th scope="col">STT</th><th scope="col">Timecode Start</th><th scope="col">Timecode End</th><th scope="col">Câu nói / hành động</th><th scope="col">Lý do hấp dẫn</th></tr></thead><tbody>${result.moments.map(m=>`<tr><td>${m.number}</td><td><button type="button" data-highlight-action="seek" data-number="${m.number}">${timecode(m.start)}</button></td><td>${timecode(m.end)}</td><td>${esc(m.summary)}</td><td>${esc(m.reason)}</td></tr>`).join('')}</tbody></table></div><div class="cs-highlights-cards">${result.moments.map(m=>`<article class="cs-highlight-card" data-highlight-card="${m.number}"><div class="cs-highlight-card-heading"><b>Đoạn ${m.number} · ${timecode(m.start)} → ${timecode(m.end)}</b><span>${(m.end-m.start).toFixed(1)} giây</span></div><p><b>Hook:</b> ${esc(m.hook)}</p><h4>${esc(m.title)}</h4><p class="cs-highlight-description">${esc(m.description)}</p><p class="cs-highlight-hashtags">${m.hashtags.map(esc).join(' ')}</p><div class="cs-highlight-editing">${cues(m.transitions,'Chuyển cảnh')}${cues(m.music,'Nhạc nền')}${cues(m.subtitles,'Phụ đề & từ khoá')}</div><div class="cs-highlight-actions"><button type="button" data-highlight-action="seek" data-number="${m.number}">Đến đoạn này trên timeline</button><button type="button" data-highlight-action="copy-clip" data-number="${m.number}">Sao chép nội dung clip</button><button type="button" data-highlight-action="split" data-number="${m.number}">Đặt điểm cắt đoạn ${m.number}</button></div></article>`).join('')}</div>`:'<p>Chưa tìm được đoạn phù hợp. Thử chọn video khác hoặc nới thời lượng.</p>'}`;
  }
  async function analyze(){
    const s=getState(),selection=refreshVideo();if(s.mode!=='video'||!selection)throw Error('Thêm video vào project trước khi phân tích.');
    const {clip,resource}=selection;
    const options=highlightOptions({minDuration:Number(q('#csHighlightsMin').value),maxDuration:Number(q('#csHighlightsMax').value),platform:q('#csHighlightsPlatform').value,goal:q('#csHighlightsGoal').value});
    const uid=s.uid,key=highlightSourceKey(uid,clip),version=++revision,snapshot=structuredClone(clip);
    result=null;source=null;cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;draw();message('Gemini đang xem video, chọn hook và lập bảng timeline…');
    const taskController=controller=new AbortController();analyzingKey=key;q('#csHighlightsProgress').hidden=false;
    let data;
    try{data=await call('analyzeStudioHighlights',{blob:resource.blob,clip:snapshot,options,signal:taskController.signal,onProgress:p=>{if(uid!==getState().uid||version!==revision)return;q('#csHighlightsProgressBar').value=p.percent;q('#csHighlightsProgressText').textContent=(p.phase==='prepare'?'Nén video trên máy':p.phase==='done'?'Đã xử lý xong':'Gemini đang phân tích')+' · Phần '+p.index+'/'+p.total+' · '+Math.round(p.percent)+'%';}});}catch(error){if(taskController.signal.aborted)throw Error('Đã dừng phân tích video. Bạn có thể bấm phân tích lại.');throw error;}finally{if(version===revision){controller=null;analyzingKey='';q('#csHighlightsProgress').hidden=true;}}

    if(uid!==getState().uid||version!==revision)return;
    const latest=videoSource()?.clip;
    if(highlightSourceKey(uid,latest)!==key)throw Error('Đoạn video đã thay đổi trong lúc phân tích. Hãy phân tích lại.');
    source={id:snapshot.id,mediaId:snapshot.mediaId,key};result={...data,sourceName:resource.name||clip.name||'Video',options};draw();
    message(`Đã tìm ${result.moments.length} khoảnh khắc. Xem timecode và gợi ý dựng bên dưới.`);
  }
  section.addEventListener('click',event=>{
    const button=event.target.closest('[data-highlight-action]');if(!button)return;const action=button.dataset.highlightAction;
    if(action==='cancel-analysis'){controller?.abort();message('Đang dừng phân tích…');return;}
    if(action==='import'){panel.closest('#page-creative-studio').querySelector('#csUpload').click();return;}
    if(action==='fullscreen'){player.requestFullscreen?.().catch(e=>message(e.message,true));return;}
    execute(async()=>{
      if(action==='analyze'){await analyze();return;}
      if(action==='cancel'){cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;return;}
      const clip=requireResult(),moment=result.moments.find(m=>m.number===button.dataset.number);
      if(action==='seek'){if(moment){player.currentTime=moment.start;const match=timelineClip(moment);if(match)seek(match.start+moment.start-(match.in||0));}return;}
      if(action==='copy'||action==='copy-clip'){await navigator.clipboard.writeText(highlightReport(action==='copy'?result:{...result,moments:moment?[moment]:[]}));message('Đã sao chép kế hoạch clip.');return;}
      if(action==='csv'){const url=URL.createObjectURL(new Blob([highlightCSV(result)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='FBTQ-khoanh-khac-video.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Đã xuất bảng timeline CSV.');return;}
      if(action==='split'&&moment){
        const match=timelineClip(moment);if(!match)throw Error('Khoảnh khắc nằm ngoài các phần video đang giữ trên timeline. Thêm lại toàn bộ video để đặt điểm cắt.');cutPlan={clipId:match.id,moment,signature:JSON.stringify(getState().clips)};
        q('#csHighlightsCutConfirm').hidden=false;q('#csHighlightsCutConfirm').innerHTML=`<b>Đặt hai điểm cắt · Đoạn ${moment.number}</b><p>Tách video tại ${timecode(moment.start)} và ${timecode(moment.end)} theo file nguồn. Giữ phần trước/sau và vị trí các lớp khác. Sau khi tách, chọn đoạn để chỉnh tiếp; dùng Hoàn tác nếu cần.</p><button type="button" data-highlight-action="confirm">Xác nhận đặt điểm cắt</button><button type="button" data-highlight-action="cancel">Huỷ</button>`;q('#csHighlightsCutConfirm').scrollIntoView({block:'nearest'});return;
      }
      if(action==='confirm'&&cutPlan){await splitMoment(cutPlan);cutPlan=null;result=null;source=null;q('#csHighlightsCutConfirm').hidden=true;draw();message('Đã tách và chọn khoảnh khắc trên timeline. Có thể dùng Hoàn tác.');}
    });
  });
  q('#csHighlightsVideoSelect').addEventListener('change',()=>{controller?.abort();chosenMediaId=q('#csHighlightsVideoSelect').value;lastTimelineMediaId=getState().current?.type==='video'?getState().current.mediaId:'';reset({preserveVideo:true});refreshVideo();});
  function reset({preserveVideo=false}={}){controller?.abort();controller=null;analyzingKey='';player.pause();if(!preserveVideo){chosenMediaId='';lastTimelineMediaId='';playerMediaId='';player.removeAttribute('src');player.load();}q('#csHighlightsProgress').hidden=true;revision++;owner=getState().uid;result=null;source=null;cutPlan=null;q('#csHighlightsCutConfirm').hidden=true;draw();}
  function sync(){const s=getState();if(s.uid!==owner)reset();section.hidden=s.mode!=='video';if(s.mode==='video')refreshVideo();else player.pause();if(controller&&highlightSourceKey(s.uid,videoSource()?.clip)!==analyzingKey)controller.abort();panel.classList.toggle('cs-ai-panel--highlights',s.mode==='video'&&!!result);if(result&&highlightSourceKey(s.uid,currentSource())!==source.key){reset();message('Đoạn nguồn đã thay đổi. Phân tích lại để có bảng timecode mới.');}}
  return {sync,reset,pause:()=>player.pause()};
}
