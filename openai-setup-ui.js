const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openAISetupMarkup(projectId,backendURL=''){
  if(typeof projectId!=='string'||!/^[a-z][a-z0-9-]{4,29}$/.test(projectId))throw Error('Chưa xác định được Firebase project. Kết nối Firebase rồi mở lại hướng dẫn.');
  const command=(value,id)=>'<div class="openai-setup-command"><code id="'+id+'">'+esc(value)+'</code><button type="button" class="btn btn-secondary" data-openai-copy="'+id+'">Sao chép lệnh</button></div>';
  return '<div class="openai-setup-guide"><p><b>Giữ Firebase Spark</b> cho đăng nhập và dữ liệu. Cloudflare Worker gọi OpenAI và giữ API key phía máy chủ. API OpenAI có thanh toán và hạn mức riêng.</p><div class="setup-callout"><span>🔒</span><div><b>Không dán API key vào website</b><p>Chỉ nhập URL backend ở bên dưới. API key được lưu bằng secret của Worker.</p></div></div><label>URL backend OpenAI<input id="openAIBackendURL" type="url" value="'+esc(backendURL)+'" placeholder="https://fbtq-openai-api.ten-cua-ban.workers.dev" autocomplete="off" spellcheck="false"></label><div class="settings-actions"><button type="button" class="btn btn-primary" id="saveOpenAIBackend">Lưu URL backend</button><button type="button" class="btn btn-secondary" id="openAISetupTest">Kiểm tra kết nối</button></div><p id="openAIBackendSaveStatus" role="status" aria-live="polite">Lưu URL trước khi kiểm tra. URL được lưu chung cho workspace, API key không được lưu trong Firestore.</p><details><summary>Hướng dẫn tạo backend riêng</summary><ol><li><b>Tạo API key OpenAI</b><p>Mở <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI API keys ↗</a>, tạo key và kiểm tra API billing/quyền model.</p></li><li><b>Tạo Worker và D1</b><p>Trong Terminal, chuyển vào thư mục <code>openai-worker</code> của dự án, đăng nhập Cloudflare và tạo database:</p>'+command('npx wrangler login\nnpx wrangler d1 create fbtq-openai-usage','openaiCreateCommand')+'<p>Điền database ID nhận được vào <code>wrangler.jsonc</code>. Điền Firebase Web API key công khai của project <b>'+projectId+'</b>, đúng tên miền website vào ALLOWED_ORIGINS và chọn OPENAI_MODEL được cấp quyền. Worker không cần Firebase service account.</p></li><li><b>Triển khai và lưu secret</b>'+command('npx wrangler d1 migrations apply fbtq-openai-usage --remote\nnpx wrangler deploy\nnpx wrangler secret put OPENAI_API_KEY','openaiDeployCommand')+'<p>Dán OpenAI key vào lời nhắc kín của lệnh cuối. Không đưa key vào mã nguồn hoặc chat.</p></li><li><b>Kết nối website</b><p>Sao chép URL Worker, dán vào ô trên và lưu. Kiểm tra kết nối sẽ gửi một yêu cầu API nhỏ có tính phí theo mức dùng. Sau khi thành công, chọn ChatGPT trong Studio nội dung hoặc OpenAI ở Trợ lý FBTQ.</p></li></ol></details><p class="muted">Backend hỗ trợ ChatGPT văn bản, tạo ảnh và phiên âm Studio. Gemini vẫn dùng Firebase AI Logic cho kiểm duyệt và phân tích video. Không tự chuyển sang OpenAI khi Gemini lỗi.</p><span id="openAISetupCopyStatus" class="muted" role="status" aria-live="polite"></span></div>';
}
export function initOpenAISetup({button,getProjectId,isManager,openModal,closeModal,check,getURL=()=>'',saveURL,notify,document:doc=document,clipboard=navigator.clipboard}){
  button.addEventListener('click',()=>{
    if(!isManager()){notify('Chỉ quản lý mới có thể cấu hình OpenAI API.','error');return;}
    let markup;try{markup=openAISetupMarkup(getProjectId(),getURL());}catch(error){notify(error.message,'error');return;}
    openModal('Thêm OpenAI API · Firebase Spark',markup,'');
    const guide=doc.querySelector('.openai-setup-guide');
    guide.addEventListener('click',async event=>{
      const copy=event.target.closest('[data-openai-copy]');if(!copy)return;
      const status=guide.querySelector('#openAISetupCopyStatus'),code=guide.querySelector('#'+copy.dataset.openaiCopy);
      try{await clipboard.writeText(code.textContent);status.textContent='Đã sao chép lệnh. Chạy trong Terminal tại thư mục openai-worker.';}catch{status.textContent='Trình duyệt chưa cho sao chép. Chọn và sao chép lệnh phía trên.';}
    });
    guide.querySelector('#saveOpenAIBackend').addEventListener('click',async event=>{
      const button=event.currentTarget,status=guide.querySelector('#openAIBackendSaveStatus'),url=guide.querySelector('#openAIBackendURL').value.trim();
      if(!url){status.textContent='Nhập URL backend của bạn trước khi lưu.';return;}
      button.disabled=true;try{await saveURL(url);status.textContent='Đã lưu URL backend. Bấm Kiểm tra kết nối để xác nhận API hoạt động.';}catch(error){status.textContent=error.message||'Không lưu được URL.';}finally{button.disabled=false;}
    });
    guide.querySelector('#openAISetupTest').addEventListener('click',()=>{
      if(guide.querySelector('#openAIBackendURL').value.trim().replace(/\/$/,'')!==getURL().replace(/\/$/,'')){guide.querySelector('#openAIBackendSaveStatus').textContent='Lưu URL backend đang nhập trước khi kiểm tra.';return;}
      if(!getURL()){guide.querySelector('#openAIBackendSaveStatus').textContent='Chưa lưu URL backend.';return;}closeModal();check();
    });
  });
}
