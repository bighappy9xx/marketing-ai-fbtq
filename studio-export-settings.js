import {probeHardware,AUDIO_RATE} from './studio-hardware-export.js?v=20261113-hardware-setup';

const storageKey='fbtq_studio_export_engine';
const modes=new Set(['auto','hardware','software','realtime']);
export async function inspectExportSupport(api,width,height){
  const [hardware,software,audio]=await Promise.allSettled([
    probeHardware(api,width,height,false,'hardware'),
    probeHardware(api,width,height,false,'software'),
    api.canEncodeAudio('aac',{sampleRate:AUDIO_RATE,numberOfChannels:2,bitrate:192000})
  ]);
  return {hardware:hardware.status==='fulfilled',software:software.status==='fulfilled',
    audio:audio.status==='fulfilled'&&audio.value===true,
    reason:hardware.status==='rejected'?hardware.reason.message:''};
}
export function initExportSettings(root,{dimensions,disabled=()=>false,storage=localStorage,environment=window,getAPI=()=>import('./vendor/mediabunny/mediabunny-1.65.2.mjs')}){
  root.querySelector('.cs-topbar').insertAdjacentHTML('afterend',`<details class="cs-export-settings" id="csExportSettings">
    <summary>⚡ Thiết lập xuất bằng phần cứng <span>MP4 · H.264 · 30 fps</span></summary>
    <div class="cs-export-settings-body"><div><strong>Tăng tốc mã hóa video trên máy của bạn</strong>
    <p>Tự động ưu tiên bộ mã hóa phần cứng, chuyển CPU nếu cấu hình không được hỗ trợ. Chọn “Ưu tiên phần cứng” để giữ yêu cầu phần cứng khi xuất.</p>
    <div class="cs-export-settings-actions"><button type="button" class="btn btn-secondary" id="csCheckEncoder">Kiểm tra máy này</button><button type="button" class="btn btn-primary" id="csEnableHardware">Dùng ưu tiên phần cứng</button></div>
    <p id="csEncoderReport" role="status" aria-live="polite">Chưa kiểm tra. Kiểm tra theo đúng kích thước khung hình hiện tại; không tải video lên máy chủ.</p></div>
    <div><strong>Bật tăng tốc trong Chrome / Edge</strong><ol><li>Mở Cài đặt → Hệ thống, bật “Sử dụng tính năng tăng tốc đồ họa khi có thể”, rồi khởi động lại trình duyệt.</li><li>Mở lại website bằng HTTPS và bấm “Kiểm tra máy này”.</li><li>Chọn chế độ xuất, rồi bấm “Xuất video”. Giữ tab mở trong khi xuất.</li></ol>
    <p class="muted">WebCodecs chỉ cung cấp tùy chọn ưu tiên, không xác nhận bộ mã hóa vật lý đang được dùng. Hiệu ứng, dựng lớp và âm thanh vẫn có thể giới hạn tốc độ. Không cần cài FFmpeg hay bật Firebase Blaze để xuất file trên máy.</p></div></div>
  </details>`);
  const select=root.querySelector('#csExportEngine'),report=root.querySelector('#csEncoderReport'),buttons=[root.querySelector('#csCheckEncoder'),root.querySelector('#csEnableHardware')];
  try{const saved=storage.getItem(storageKey);if(modes.has(saved))select.value=saved;}catch{}
  function persist(){try{storage.setItem(storageKey,select.value);return true;}catch{return false;}}
  select.addEventListener('change',persist);
  let checking=false;
  async function check(apply){
    if(checking||disabled())return;
    checking=true;buttons.forEach(b=>b.disabled=true);
    const [width,height]=dimensions();
    report.textContent='Đang kiểm tra H.264 và AAC · '+width+' × '+height+' px…';
    try{
      if(!environment.isSecureContext||!environment.VideoEncoder)throw Error('Cần Chrome/Edge máy tính mới, mở website bằng HTTPS để dùng WebCodecs.');
      const result=await inspectExportSupport(await getAPI(),width,height);
      let message=width+' × '+height+' px · H.264 ưu tiên phần cứng: '+(result.hardware?'được trình duyệt chấp nhận':'chưa hỗ trợ')+' · CPU: '+(result.software?'hỗ trợ':'chưa hỗ trợ')+' · AAC: '+(result.audio?'hỗ trợ':'chưa hỗ trợ; video có âm thanh sẽ không xuất được bằng chế độ MP4 này')+'.';
      if(!result.hardware)message+=' '+result.reason;
      if(apply&&result.hardware){
        // Do not change export options after an export started while the probe was pending.
        if(disabled())return;
        select.value='hardware';const saved=persist();
        message+=' Đã chọn ưu tiên phần cứng'+(saved?' và lưu cho trình duyệt này.':'; trình duyệt không cho lưu lựa chọn.');
      }
      if(!environment.showSaveFilePicker)message+=' Lưu trực tiếp ra thư mục cần Chrome/Edge máy tính hỗ trợ chọn file.';
      report.textContent=message;
    }catch(error){report.textContent=error.message||'Không kiểm tra được bộ mã hóa. Hãy thử lại.';}
    finally{checking=false;buttons.forEach(b=>b.disabled=disabled());}
  }
  buttons[0].addEventListener('click',()=>check(false));buttons[1].addEventListener('click',()=>check(true));
  return {isChecking:()=>checking};
}
