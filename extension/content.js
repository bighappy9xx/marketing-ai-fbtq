(() => {
  if (document.getElementById('fbtq-helper-root')) return;
  const root = document.createElement('div');
  root.id = 'fbtq-helper-root';
  const logo = chrome.runtime.getURL('favicon.svg');
  root.innerHTML = `
    <section id="fbtq-helper-panel" class="fbtq-panel" hidden aria-label="Marketing Ai FBTQ Meta Helper">
      <header class="fbtq-head"><div class="fbtq-brand"><img src="${logo}" alt=""><span><b>Marketing Ai FBTQ</b><small>Meta Helper</small></span></div><button type="button" class="fbtq-close" aria-label="Đóng">×</button></header>
      <div class="fbtq-panel-body">
        <div id="fbtq-metrics-view">
          <div class="fbtq-section-title"><span class="fbtq-icon">▦</span><div><b>Chỉ số quảng cáo</b><small id="fbtq-metric-count">Đang quét bảng Ads Manager…</small></div></div>
          <p class="fbtq-help">Đọc các hàng chiến dịch đang được Meta tải trên trang. Chọn đúng tab và kỳ báo cáo, rồi bấm Quét lại nếu vừa đổi bảng hoặc bộ lọc.</p>
          <label class="fbtq-check"><input type="checkbox" id="fbtq-visible-only"> Chỉ lấy các hàng đang nhìn thấy</label>
          <div class="fbtq-actions"><button type="button" id="fbtq-rescan" class="fbtq-button fbtq-secondary">Quét lại bảng</button><button type="button" id="fbtq-send-metrics" class="fbtq-button fbtq-primary">Gửi vào Báo cáo hàng ngày <span>→</span></button><button type="button" id="fbtq-copy" class="fbtq-button fbtq-secondary">Sao chép JSON</button><button type="button" id="fbtq-download" class="fbtq-button fbtq-secondary">Tải JSON</button></div>
        </div>
        <div id="fbtq-invoice-view" hidden>
          <div class="fbtq-section-title"><span class="fbtq-icon fbtq-icon-invoice">▤</span><div><b>Biên lai Meta PDF</b><small id="fbtq-pdf-count">Quét liên kết trên trang</small></div></div>
          <p class="fbtq-help">Tìm liên kết PDF/biên lai đang hiển thị. Extension chuyển tệp vào website để tự đọc và điền form hóa đơn.</p>
          <button type="button" id="fbtq-scan-pdfs" class="fbtq-button fbtq-secondary fbtq-full">Quét lại liên kết biên lai</button>
          <div id="fbtq-pdf-list" class="fbtq-pdf-list"></div>
          <label class="fbtq-file-button">Chọn PDF đã tải xuống<input id="fbtq-local-pdf" type="file" accept="application/pdf,.pdf"></label>
        </div>
        <div id="fbtq-status" class="fbtq-status" role="status" aria-live="polite"></div>
        <div class="fbtq-footer"><span class="fbtq-dot"></span>Dữ liệu chỉ chuyển tới website FBTQ khi bạn bấm gửi.</div>
      </div>
    </section>
    <button id="fbtq-helper-toggle" type="button" aria-expanded="false"><img src="${logo}" alt=""><span>Meta Helper</span><i></i></button>`;
  document.documentElement.append(root);

  const panel = root.querySelector('#fbtq-helper-panel');
  const status = root.querySelector('#fbtq-status');
  const metricView = root.querySelector('#fbtq-metrics-view');
  const invoiceView = root.querySelector('#fbtq-invoice-view');
  const count = root.querySelector('#fbtq-metric-count');
  const pdfCount = root.querySelector('#fbtq-pdf-count');
  const pdfList = root.querySelector('#fbtq-pdf-list');
  let lastRows = [];
  let lastPath = location.pathname;

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const elementText = element => normalize(element?.innerText || element?.textContent || element?.getAttribute('aria-label') || element?.getAttribute('title') || '');
  const key = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  const setStatus = (message, tone = 'info') => { status.textContent = message; status.dataset.tone = tone; };
  const billingPage = () => /\/billing_hub\//i.test(location.pathname) || /\/billing\//i.test(location.pathname);
  let lastScanInfo = { headers: [], rows: 0 };

  function numberFrom(value) {
    let text = normalize(value).replace(/−/g, '-').replace(/[^\d.,kmbKMB-]/g, '');
    if (!text || text === '-') return null;
    const multiplier = /k$/i.test(text) ? 1e3 : /m$/i.test(text) ? 1e6 : /b$/i.test(text) ? 1e9 : 1;
    text = text.replace(/[kmb]$/i, '');
    if (text.includes('.') && text.includes(',')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else if (text.includes(',')) text = /,\d{1,2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
    else if (text.includes('.')) text = /^-?\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
    const parsed = Number(text) * multiplier;
    return Number.isFinite(parsed) ? parsed : null;
  }
  function headerIndex(headers, alternatives) {
    const aliases = alternatives.map(key).filter(Boolean);
    const exact = headers.find(header => aliases.includes(key(header.label)));
    if (exact) return exact.index;
    const matches = headers.filter(header => aliases.some(alias => alias.length > 8 && key(header.label).includes(alias)));
    return matches[0]?.index ?? -1;
  }
  function cellValue(headers, cells, alternatives) {
    const index = headerIndex(headers, alternatives);
    return index >= 0 ? cells.get(index) || '' : '';
  }
  function readGrid(rootElement, onlyVisible) {
    const headerElements = [...rootElement.querySelectorAll('[role="columnheader"],thead th')];
    const headerMap = new Map();
    headerElements.forEach((element, position) => {
      const label = elementText(element);
      if (!label) return;
      const ariaIndex = Number(element.getAttribute('aria-colindex'));
      const index = Number.isInteger(ariaIndex) && ariaIndex > 0 ? ariaIndex - 1 : position;
      if (!headerMap.has(index) || label.length > headerMap.get(index).label.length) headerMap.set(index, { index, label });
    });
    const headers = [...headerMap.values()].sort((a, b) => a.index - b.index);
    const rowElements = [...rootElement.querySelectorAll('[role="row"],tr')].filter(row => row.querySelector('[role="gridcell"],[role="cell"],td') && (!onlyVisible || visibleOnScreen(row)));
    const rows = rowElements.map(row => {
      const cellElements = [...row.querySelectorAll('[role="gridcell"],[role="cell"],td')];
      const cells = new Map();
      cellElements.forEach((element, position) => {
        const ariaIndex = Number(element.getAttribute('aria-colindex'));
        const index = Number.isInteger(ariaIndex) && ariaIndex > 0 ? ariaIndex - 1 : position;
        const value = elementText(element);
        if (value && (!cells.has(index) || value.length > cells.get(index).length)) cells.set(index, value);
      });
      return { row, cells, fullText: elementText(row) };
    });
    const nameHeader = headerIndex(headers, ['ad set name','adset name','ad set','adset','tên nhóm quảng cáo','nhóm quảng cáo','bài chạy','campaign name','campaign','tên chiến dịch','chiến dịch','name']);
    const spendHeader = headerIndex(headers, ['amount spent','spend','số tiền đã chi tiêu','số tiền đã chi','số tiền chi tiêu thực tế','chi tiêu']);
    const score = (nameHeader >= 0 ? 100 : 0) + (spendHeader >= 0 ? 15 : 0) + Math.min(rows.length, 20) + Math.min(headers.length, 20);
    return { headers, rows, score, nameHeader };
  }
  function visibleOnScreen(element) {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  }
  function rowsFromTable() {
    const onlyVisible = root.querySelector('#fbtq-visible-only').checked;
    const candidateRoots = [...document.querySelectorAll('[role="grid"],[role="table"],table')];
    let grids = candidateRoots.map(element => readGrid(element, onlyVisible)).filter(grid => grid.rows.length);
    if (grids.some(candidate => candidate.nameHeader >= 0)) grids = grids.filter(candidate => candidate.nameHeader >= 0);
    else {
      const pageGrid = readGrid(document, onlyVisible);
      if (pageGrid.rows.length && (pageGrid.nameHeader >= 0 || !grids.length)) grids = [pageGrid];
    }
    const grid = grids.sort((a, b) => b.score - a.score)[0] || { headers: [], rows: [] };
    const { headers, rows } = grid;
    lastScanInfo = { headers: headers.map(header => header.label), rows: rows.length };
    const account = normalize(document.querySelector('[data-testid*="account"]')?.innerText || document.querySelector('[aria-label*="account"]')?.getAttribute('aria-label') || new URL(location.href).searchParams.get('act') || 'Meta Ads');
    const now = new Date(), reportAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const output = [];
    for (const { cells, fullText } of rows) {
      if (cells.size < 3) continue;
      if (!fullText) continue;
      const campaign = cellValue(headers,cells,['campaign name','tên chiến dịch','campaign','chiến dịch']);
      const adSet = cellValue(headers,cells,['ad set name','adset name','ad set','adset','tên nhóm quảng cáo','nhóm quảng cáo','bài chạy']);
      const fallbackName = [...cells.values()].find(value => value.length > 2 && !/^(on|off|active|paused|đang chạy|đã tắt|bản nháp)$/i.test(value) && !/^\d[\d., ]*$/.test(value));
      const name = (adSet || campaign || fallbackName || '').split(/\n/)[0].trim();
      if (!name || /^(total|total results|kết quả tổng cộng|tổng cộng|draft|campaigns|ad sets|ads|chiến dịch|nhóm quảng cáo)$/i.test(name)) continue;
      const statusText = cellValue(headers,cells,['delivery','phân phối','status','trạng thái','trạng thái phân phối']);
      const messaging = numberFrom(cellValue(headers,cells,['new messaging contacts','messaging conversations started','conversations started','tin nhắn mới','số mess']));
      const item = {
        id: cellValue(headers,cells,['ad set id','campaign id','id nhóm quảng cáo','id chiến dịch','id']),
        name,
        account,
        platform: 'Facebook',
        status: (statusText || 'Đang chạy').split('\n')[0],
        budget: numberFrom(cellValue(headers,cells,['budget','ngân sách'])),
        spend: numberFrom(cellValue(headers,cells,['amount spent','spend','số tiền đã chi tiêu','số tiền đã chi','số tiền chi tiêu thực tế','chi tiêu'])),
        impressions: numberFrom(cellValue(headers,cells,['impressions','lượt hiển thị','hiển thị'])),
        reach: numberFrom(cellValue(headers,cells,['reach','người tiếp cận'])),
        results: numberFrom(cellValue(headers,cells,['results','kết quả'])),
        resultIndicator: cellValue(headers,cells,['result indicator','chỉ báo kết quả']),
        newMessagingContacts: numberFrom(cellValue(headers,cells,['new messaging contacts','người liên hệ nhắn tin mới'])),
        messagingConversationsStarted: numberFrom(cellValue(headers,cells,['messaging conversations started','lượt bắt đầu cuộc trò chuyện'])),
        dailyMessages: messaging,
        dailyPhones: numberFrom(cellValue(headers,cells,['sđt/camp','phone leads','số điện thoại/camp'])),
        dailyPhoneRevenue: numberFrom(cellValue(headers,cells,['doanh thu sđt/camp','phone revenue'])),
        dailyKpi: numberFrom(cellValue(headers,cells,['kpi/ngày','daily kpi'])),
        dailyAvgMessageCost: numberFrom(cellValue(headers,cells,['giá mess trung bình','cost per messaging conversation'])),
        dailyAvgPhoneCost: numberFrom(cellValue(headers,cells,['giá số trung bình','cost per phone'])),
        dailyNewPhoneRate: numberFrom(cellValue(headers,cells,['tỷ lệ xin số mới','new phone rate'])),
        dailyThreshold: numberFrom(cellValue(headers,cells,['ngưỡng'])),
        dailyThresholdSpent: numberFrom(cellValue(headers,cells,['ngưỡng đã chi tiêu'])),
        dailyIssue: cellValue(headers,cells,['vấn đề gặp phải','nguyên nhân vì sao']),
        dailyResolution: cellValue(headers,cells,['hướng giải quyết']),
        costPerResult: numberFrom(cellValue(headers,cells,['cost per result','chi phí trên mỗi kết quả'])),
        costPerNewMessagingContact: numberFrom(cellValue(headers,cells,['cost per new messaging contact','chi phí trên mỗi người liên hệ nhắn tin mới'])),
        roas: numberFrom(cellValue(headers,cells,['purchase roas','roas','lợi tức trên chi tiêu'])),
        source: 'Meta Ads Manager',
        reportAt,
        capturedAt: new Date().toISOString()
      };
      output.push(item);
    }
    const distinct = new Map(output.map(item => [item.id ? `id:${item.id}` : `${key(item.account)}|${key(item.name)}|${item.spend}`, item]));
    return [...distinct.values()];
  }
  function collectMetrics() {
    lastRows = rowsFromTable();
    const headerSummary = lastScanInfo.headers.slice(0, 8).join(' · ');
    count.textContent = `${lastRows.length} hàng chiến dịch được nhận diện`;
    count.title = headerSummary ? `Các cột Meta được đọc: ${headerSummary}` : 'Chưa tìm thấy tiêu đề cột trên trang.';
    setStatus(lastRows.length ? 'Đã quét bảng Meta. Số liệu sẽ được chuyển sang Báo cáo hàng ngày cho ngày hôm nay; hãy kiểm tra trước khi lưu.' : headerSummary ? `Chưa nhận diện được tên chiến dịch. Các cột hiện đọc được: ${headerSummary}. Bật cột Tên chiến dịch/Tên nhóm quảng cáo rồi quét lại.` : 'Meta chưa hiển thị bảng chiến dịch. Chọn tab Chiến dịch hoặc Nhóm quảng cáo, chờ bảng tải xong rồi quét lại.', lastRows.length ? 'success' : 'warning');
    return lastRows;
  }
  function scanPdfLinks() {
    const candidates = [...document.querySelectorAll('a[href],iframe[src],object[data],embed[src]')].map(element => {
      const href = element.href || element.src || element.data || '';
      const label = normalize(`${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.title || ''} ${href}`);
      return { href, label };
    }).filter(item => {
      if (!/^https:\/\//i.test(item.href) || !/(pdf|receipt|invoice|biên lai|hóa đơn|download|tải xuống)/i.test(item.label)) return false;
      try { const host=new URL(item.href).hostname;return host==='facebook.com'||host.endsWith('.facebook.com')||host.endsWith('.fbcdn.net')||host.endsWith('.fbsbx.com'); } catch { return false; }
    });
    return [...new Map(candidates.map(item => [item.href, item])).values()].slice(0, 20);
  }
  function renderPdfLinks() {
    const links = scanPdfLinks();
    pdfCount.textContent = links.length ? `${links.length} liên kết cần kiểm tra` : 'Chưa thấy liên kết PDF trực tiếp';
    pdfList.replaceChildren();
    if (!links.length) {
      const note = document.createElement('div');
      note.className = 'fbtq-empty-note';
      note.textContent = 'Mở mục Giao dịch/Hoạt động thanh toán hoặc mở biên lai PDF trong Meta rồi quét lại. Nếu Meta không đưa liên kết tải trực tiếp, hãy chọn PDF đã tải xuống.';
      pdfList.append(note);
      return;
    }
    for (const item of links) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fbtq-pdf-link';
      button.textContent = item.label.slice(0, 100) || 'Tệp PDF Meta';
      button.addEventListener('click', () => fetchAndSendPdf(item.href, item.label));
      pdfList.append(button);
    }
  }
  function setMode() {
    const billing = billingPage();
    metricView.hidden = billing;
    invoiceView.hidden = !billing;
    root.querySelector('#fbtq-helper-toggle span').textContent = billing ? 'Biên lai Meta' : 'Meta Helper';
    if (billing) renderPdfLinks(); else collectMetrics();
  }
  function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    return btoa(binary);
  }
  async function queuePayload(payload) {
    const result = await chrome.runtime.sendMessage({ type: 'FBTQ_QUEUE_TO_WEBSITE', payload });
    if (!result?.ok) throw new Error(result?.error || 'Không chuyển được dữ liệu vào website.');
    setStatus('Đã đưa vào hàng đợi của Chrome. Website sẽ mở form sau khi sẵn sàng; nếu cần hãy đăng nhập trước.', 'success');
  }
  async function sendMetrics() {
    const rows = collectMetrics();
    if (!rows.length) return;
    try { await queuePayload({ kind: 'metrics', campaigns: rows, reportAt: rows[0]?.reportAt || '', capturedAt: new Date().toISOString(), source: 'Marketing Ai FBTQ Meta Helper' }); }
    catch (error) { setStatus(error.message || 'Không gửi được chỉ số.', 'error'); }
  }
  async function fetchAndSendPdf(url, label = '') {
    setStatus('Đang lấy PDF từ Meta…');
    try {
      const file = await chrome.runtime.sendMessage({ type: 'FBTQ_FETCH_META_PDF', url });
      if (!file?.ok) throw new Error(file?.error || 'Không lấy được PDF.');
      await queuePayload({ kind: 'invoice-pdf', filename: file.filename || label || 'meta-receipt.pdf', mimeType: 'application/pdf', base64: file.base64 });
    } catch (error) { setStatus(error.message || 'Không lấy được PDF. Hãy thử chọn tệp đã tải.', 'error'); }
  }
  async function sendLocalPdf(file) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setStatus('Tệp cần có định dạng PDF.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { setStatus('Tệp vượt giới hạn 5 MB của form upload hóa đơn.', 'error'); return; }
    try {
      setStatus('Đang chuẩn bị tệp PDF…');
      const base64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
      await queuePayload({ kind: 'invoice-pdf', filename: file.name, mimeType: 'application/pdf', base64 });
    } catch (error) { setStatus(error.message || 'Không chuyển được PDF.', 'error'); }
  }
  async function copyJson() {
    const rows = collectMetrics();
    if (!rows.length) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify({ source: 'Marketing Ai FBTQ Meta Helper', capturedAt: new Date().toISOString(), campaigns: rows }, null, 2));
      setStatus('Đã sao chép JSON. Có thể dán vào Hiệu suất marketing → Nhập chỉ số.', 'success');
    } catch { setStatus('Clipboard bị chặn. Hãy dùng nút Tải JSON.', 'warning'); }
  }
  function downloadJson() {
    const rows = lastRows.length ? lastRows : collectMetrics();
    if (!rows.length) return;
    const blob = new Blob([JSON.stringify({ source: 'Marketing Ai FBTQ Meta Helper', capturedAt: new Date().toISOString(), campaigns: rows }, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `fbtq-ads-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1200);
    setStatus(`Đã tải ${rows.length} hàng chỉ số dạng JSON.`, 'success');
  }
  root.querySelector('#fbtq-helper-toggle').addEventListener('click', () => {
    panel.hidden = !panel.hidden; root.querySelector('#fbtq-helper-toggle').setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) setMode();
  });
  root.querySelector('.fbtq-close').addEventListener('click', () => { panel.hidden = true; root.querySelector('#fbtq-helper-toggle').setAttribute('aria-expanded', 'false'); });
  root.querySelector('#fbtq-send-metrics').addEventListener('click', sendMetrics);
  root.querySelector('#fbtq-rescan').addEventListener('click', collectMetrics);
  root.querySelector('#fbtq-copy').addEventListener('click', copyJson);
  root.querySelector('#fbtq-download').addEventListener('click', downloadJson);
  root.querySelector('#fbtq-scan-pdfs').addEventListener('click', renderPdfLinks);
  root.querySelector('#fbtq-local-pdf').addEventListener('change', event => sendLocalPdf(event.target.files?.[0]));
  if (document.documentElement) setMode();
  setInterval(() => { if (lastPath !== location.pathname) { lastPath = location.pathname; setMode(); } }, 1500);
})();
