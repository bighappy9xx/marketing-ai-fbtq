const paths={
<<<<<<< HEAD
=======
 lock:'M6 10h12v11H6z M8 10V6a4 4 0 018 0v4',unlock:'M6 10h12v11H6z M8 10V6a4 4 0 018 0',
 text:'M5 5h14 M12 5v15 M8 20h8',upload:'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
 folder:'M3 7V4h7l2 3h9v13H3z',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
>>>>>>> 92a65212e075b8af161c2b276f7ced1bb07d734a
 eyeOff:'M3 3l18 18 M9 5a11 11 0 013-0c6 0 10 7 10 7a19 19 0 01-4 4 M6 6a20 20 0 00-4 6s4 7 10 7a12 12 0 005-1',speakerOff:'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',
 panel:'M4 4h16v16H4z M9 4v16 M14 9l-3 3 3 3',
 split:'M8 4v16 M16 4v16 M4 7h4 M16 7h4 M4 17h4 M16 17h4',
 trash:'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 10v7 M14 10v7',
 select:'M6 3l12 9-6 1-3 7z',hand:'M7 12V6a1.5 1.5 0 013 0v5-7a1.5 1.5 0 013 0v7-6a1.5 1.5 0 013 0v6-3a1.5 1.5 0 013 0v7c0 5-3 7-7 7-3 0-4-2-6-5l-2-3a1.5 1.5 0 012-2z',
 undo:'M9 5L4 10l5 5 M4 10h10a6 6 0 016 6',redo:'M15 5l5 5-5 5 M20 10H10a6 6 0 00-6 6',
 plus:'M12 5v14 M5 12h14',minus:'M5 12h14',fullscreen:'M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5',
 fit:'M4 9V4h5 M15 4h5v5 M4 15v5h5 M20 15v5h-5 M8 8h8v8H8z',
 rotate:'M5 8a8 8 0 111 10 M5 3v5h5',layers:'M12 3L2 8l10 5 10-5z M2 12l10 5 10-5 M2 16l10 5 10-5',
 duplicate:'M8 8h12v12H8z M16 8V4H4v12h4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6',
 speaker:'M4 9h4l5-4v14l-5-4H4z M16 8a6 6 0 010 8 M19 5a10 10 0 010 14',
 play:'M9 5l11 7-11 7z',pause:'M8 5v14 M16 5v14',crop:'M7 3v14h14 M3 7h14v14'
};
export function editorIcon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${name==='play'?'<path d="'+paths.play+'" fill="currentColor" stroke="none"/>':'<path d="'+(paths[name]||paths.select)+'"/>'}</svg>`;}
export function initEditorChrome(root,{zoomBy,onVisualAction}){
<<<<<<< HEAD
=======
 root.querySelector('.cs-topbar').append(root.querySelector('#csExpand'));
>>>>>>> 92a65212e075b8af161c2b276f7ced1bb07d734a
 const q=s=>root.querySelector(s),button=(id,icon,label)=>`<button type="button" id="${id}" title="${label}" aria-label="${label}">${editorIcon(icon)}</button>`;
 const stage=q('#csStage'),toggle=document.createElement('button');toggle.type='button';toggle.id='csToggleLibrary';toggle.className='cs-material-toggle';toggle.title=toggle.ariaLabel='Hiện / ẩn khung dự án';toggle.setAttribute('aria-expanded','true');toggle.innerHTML=editorIcon('panel');stage.append(toggle);toggle.onclick=()=>{const hidden=root.classList.toggle('cs-library-collapsed');toggle.setAttribute('aria-expanded',String(!hidden));};
 const bar=q('.cs-timeline-toolbar');
 const left=document.createElement('div');left.className='cs-tools-left';
 for(const [id,icon,label] of [['csSelectTool','select','Chọn (A)'],['csSplitTool','split','Công cụ tách (B)'],['csPanTool','hand','Kéo trượt (H)'],['csSplit','split','Tách tại đầu phát'],['csDelete','trash','Xoá đoạn'],['csUndo','undo','Hoàn tác'],['csRedo','redo','Làm lại'],['csAddSmartTrack','plus','Thêm lớp']]){const b=q('#'+id);b.innerHTML=editorIcon(icon);b.title=label;b.setAttribute('aria-label',label);left.append(b);}
 const center=document.createElement('div');center.className='cs-tools-playback';center.append(q('#csPlay'),q('#csClock'));
 const right=document.createElement('div');right.className='cs-tools-right';right.innerHTML=button('csZoomOut','minus','Thu nhỏ timeline')+button('csZoomIn','plus','Phóng to timeline')+button('csPreviewExpand','fullscreen','Mở rộng không gian');right.insertBefore(q('#csZoom').closest('label'),right.children[1]);
 bar.replaceChildren(left,center,right);q('.cs-transport').classList.add('cs-scrub-strip');
 q('#csZoomOut').onclick=()=>zoomBy(-6);q('#csZoomIn').onclick=()=>zoomBy(6);q('#csPreviewExpand').onclick=()=>q('#csExpand').click();
 const floating=document.createElement('div');floating.className='cs-canvas-actions';floating.hidden=true;floating.setAttribute('aria-label','Thao tác với đối tượng đã chọn');floating.innerHTML=button('csObjectFit','fit','Vừa khung')+button('csObjectCover','crop','Lấp đầy khung')+button('csObjectRotate','rotate','Xoay 90°')+button('csObjectDuplicate','duplicate','Nhân đôi')+button('csObjectForward','layers','Đưa lên trên');stage.append(floating);
 for(const [id,action] of [['csObjectFit','contain'],['csObjectCover','cover'],['csObjectRotate','rotate']])q('#'+id).onclick=()=>onVisualAction(action);
 q('#csObjectDuplicate').onclick=()=>q('#csDuplicate').click();q('#csObjectForward').onclick=()=>q('#csForward').click();
 function updateSelection(visible){floating.hidden=!visible;}
 return {updateSelection};
}
