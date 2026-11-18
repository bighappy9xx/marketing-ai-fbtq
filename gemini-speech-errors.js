export function speechErrorInfo(error){
 const detail=String(error?.message||error||'Không tạo được giọng đọc.'),raw=detail+' '+String(error?.code||'');
 if(/functions\/not-found|GEMINI_FREE_API_KEY/.test(raw))return {kind:'setup',title:'Chưa kích hoạt backend Gemini Free',detail};
 if(/Gemini Free: key đang thuộc project yêu cầu thanh toán/.test(raw))return {kind:'free-project',title:'Key chưa dùng project Gemini Free Tier',detail};
 if(/prepay(?:ment)?[\s_-]*credits?.*(?:depleted|exhausted|insufficient)|prepay required|payment required|\b402\b/i.test(raw))return {kind:'billing',title:'Gemini đã hết tín dụng trả trước',detail};
 if(/app.?check|attestation|invalid.*token/i.test(raw))return {kind:'app-check',title:'App Check chưa xác thực website',detail};
 if(/\b429\b|quota|resource.exhausted|rate.limit/i.test(raw))return {kind:'quota',title:'Gemini đã chạm hạn mức sử dụng',detail};
 if(/\b401\b|\b403\b|permission.denied/i.test(raw))return {kind:'permission',title:'Project chưa được phép dùng Gemini TTS',detail};
 return {kind:'other',title:'Không tạo được giọng đọc',detail};
}
export function speechErrorMarkup(error){
 const info=speechErrorInfo(error),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const messages={
  setup:`<p>Chạy <code>node scripts/setup-gemini-free.cjs</code> trong Terminal của thư mục dự án, nhập kín key Gemini từ project <b>gen-lang-client-0906214986</b> và đợi triển khai hàm <code>synthesizeFreeSpeech</code>. Không dán key vào website hoặc cuộc trò chuyện.</p>`,
  'free-project':`<p>Kiểm tra key đã lưu trong <code>GEMINI_FREE_API_KEY</code> thuộc project <b>gen-lang-client-0906214986</b> ở Free Tier, không liên kết Billing. Website không tự chuyển sang project trả phí. Dùng trình cài đặt Terminal để thay key nếu nhập nhầm.</p>`,
  billing:`<p>Google báo số dư trả trước của Gemini đã hết hoặc chưa được nạp. Firebase Blaze và số dư OpenAI không thay thế tín dụng Gemini.</p><ol><li>Mở <a href="https://aistudio.google.com/projects" target="_blank" rel="noopener noreferrer">Google AI Studio → Projects ↗</a>, chọn đúng project <b>mediafbtq-6e1bb</b>.</li><li>Vào Billing của project, kiểm tra <b>Prepay credit balance</b>. Nếu bằng 0, bạn cần tự bổ sung tín dụng theo hướng dẫn của Google.</li><li>Nếu đã có số dư dương nhưng vẫn lỗi, kiểm tra đúng project/tài khoản thanh toán và trạng thái giao dịch; liên hệ hỗ trợ Google khi số dư chưa được ghi nhận. Không nạp lặp chỉ vì vẫn thấy lỗi.</li><li>Sau khi Google ghi nhận số dư, quay lại đây và bấm <b>Tạo giọng đọc</b> để thử một câu ngắn.</li></ol><p>Đổi model, tạo lại API key hoặc cấu hình lại App Check không xử lý lỗi hết tín dụng. Website không tự gửi lại yêu cầu hay tự chuyển nhà cung cấp.</p><p><a href="https://ai.google.dev/gemini-api/docs/billing#prepay" target="_blank" rel="noopener noreferrer">Hướng dẫn thanh toán Gemini ↗</a></p>`,
  'app-check':`<p>Kiểm tra Firebase Console → App Check → Apps: đăng ký đúng Web App với reCAPTCHA Enterprise. Site key cần cho phép tên miền <code>bighappy9xx.github.io</code>.</p><p>Lưu site key công khai tại <b>Cài đặt → Firebase &amp; dữ liệu</b>, tải lại website rồi thử lại. Không nhập reCAPTCHA secret key hoặc API key vào ô site key.</p>`,
  quota:`<p>Gemini đang giới hạn số yêu cầu hoặc lượng sử dụng. Kiểm tra quota của project <b>mediafbtq-6e1bb</b> trong Google AI Studio và thời điểm hạn mức phục hồi.</p><p>Không tự gửi lại yêu cầu. Bấm liên tục hoặc đổi giọng không khắc phục quota. Chỉ bổ sung tín dụng nếu trang Billing thực sự báo thiếu số dư.</p>`,
  permission:`<p>Kiểm tra Firebase AI Logic → Gemini Developer API và quyền truy cập model TTS của project <b>mediafbtq-6e1bb</b>. Không cần thay đổi API key OpenAI.</p>`,
  other:`<p>Giọng đọc dùng Gemini riêng. Kiểm tra kết nối mạng, quyền dùng model TTS và thử một đoạn ngắn. Chi tiết dưới đây giúp xác định nguyên nhân; website không tự gửi lại yêu cầu.</p>`
 };
 return `<div class="speech-error-heading"><span>!</span><b>${esc(info.title)}</b></div>${messages[info.kind]}<details><summary>Chi tiết lỗi</summary><code>${esc(info.detail)}</code></details>`;
}
