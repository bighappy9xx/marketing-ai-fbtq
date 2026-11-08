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
          <p class="fbtq-help"><b>1.</b> Mở tab <b>Chiến dịch</b> trên Meta và tích ô vuông cạnh từng dòng cần báo cáo. <b>2.</b> Quét để kiểm tra dữ liệu. <b>3.</b> Gửi sang Trợ lý FBTQ. <br><b>Ánh xạ:</b> Chiến dịch → Bài chạy · Phân phối → Trạng thái · Kết quả → Số Mess · Chi phí mỗi kết quả → Giá mess TB · Ngân sách → Ngân sách · Số tiền đã chi tiêu → Chi tiêu thực tế/ngày.</p>
          <div class="fbtq-actions"><button type="button" id="fbtq-rescan" class="fbtq-button fbtq-secondary">Quét mục đã chọn</button><button type="button" id="fbtq-send-metrics" class="fbtq-button fbtq-primary">Gửi vào Trợ lý FBTQ <span>→</span></button><button type="button" id="fbtq-copy" class="fbtq-button fbtq-secondary">Sao chép JSON đã chọn</button><button type="button" id="fbtq-download" class="fbtq-button fbtq-secondary">Tải JSON đã chọn</button></div><div id="fbtq-metric-preview" class="fbtq-metric-preview" hidden aria-live="polite"></div>
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
  let lastScanInfo = { headers: [], rows: 0, selected: 0 };

  function numberFrom(value) {
    let text = normalize(value).match(/-?\d[\d.,]*(?:\s*[kmb](?=\s|$))?/i)?.[0]?.replace(/\s/g, '') || '';
    if (!text || text === '-') return null;
    const multiplier = /k$/i.test(text) ? 1e3 : /m$/i.test(text) ? 1e6 : /b$/i.test(text) ? 1e9 : 1;
    text = text.replace(/[kmb]$/i, '');
    if (text.includes('.') && text.includes(',')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else if (text.includes(',')) text = /,\d{1,2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
    else if (text.includes('.')) text = /^-?\d{1,3}(?:\.\d{3})+$/.test(text) ? text.replace(/\./g, '') : text;
    const parsed = Number(text) * multiplier;
    return Number.isFinite(parsed) ? parsed : null;
  }
  function parseMetaDateRange(label) {
    const text = normalize(label);
    let match = text.match(/(\d{4}-\d{2}-\d{2})\s*(?:–|—|-|đến|to)\s*(\d{4}-\d{2}-\d{2})/i);
    if (match) return { start: match[1], end: match[2] };
    match = text.match(/(\d{1,2})\s+(?:tháng|thg)\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*(?:–|—|-|đến|to)\s*(\d{1,2})\s+(?:tháng|thg)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
    if (match) {
      const endYear = Number(match[6] || match[3]);
      const startYear = Number(match[3] || endYear);
      const iso = (day, month, year) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { start: iso(match[1], match[2], startYear), end: iso(match[4], match[5], endYear) };
    }
    match = text.match(/([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*(?:–|—|-|to)\s*([A-Za-z]{3,9})\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
    if (match) {
      const year = Number(match[6] || match[3]);
      const startDate = new Date(`${match[1]} ${match[2]}, ${match[3] || year}`);
      const endDate = new Date(`${match[4]} ${match[5]}, ${match[6] || year}`);
      if (Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime())) return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
    }
    return { start: '', end: '' };
  }
  function activeReportRange() {
    const controls = [...document.querySelectorAll('button,[role="button"],[aria-haspopup]')]
      .filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; })
      .map(elementText).filter(Boolean);
    for (const label of controls) {
      const range = parseMetaDateRange(label);
      if (range.start && range.end) return range;
    }
    return parseMetaDateRange(document.body?.innerText || '');
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
  function preferredCellValue(headers, cells, alternatives) {
    for (const alias of alternatives) {
      const index = headerIndex(headers, [alias]);
      if (index >= 0) return cells.get(index) || '';
    }
    return '';
  }
  function rowIsSelected(row) {
    if (row.getAttribute('aria-selected') === 'true' || row.getAttribute('data-selected') === 'true') return true;
    const controls = [...row.querySelectorAll('[role="checkbox"],input[type="checkbox"],[data-testid*="select"],[aria-label*="select" i],[aria-label*="chọn" i]')];
    if (controls.some(control => {
      if (control.getAttribute('role') === 'switch' || control.closest?.('[role="switch"]')) return false;
      const label = `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`;
      return control.matches('input[type="checkbox"]:checked') || control.getAttribute('aria-checked') === 'true' || control.getAttribute('data-state') === 'checked' || control.getAttribute('data-checked') === 'true' || control.getAttribute('aria-pressed') === 'true' || /\b(deselect|unselect|selected)\b|bỏ chọn/i.test(label);
    })) return true;
    // Meta's selected rows are blue-highlighted in some Ads Manager builds that omit checkbox ARIA state.
    const surfaces = [row, ...row.querySelectorAll('[role="gridcell"],[role="cell"],td')];
    return surfaces.some(element => {
      const channels = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
      if (channels.length < 3 || (channels.length > 3 && channels[3] < 0.45)) return false;
      const [red, green, blue] = channels;
      return blue > red + 12 && blue > green + 2;
    });
  }
  const headerSpecs = [
      { field: 'enabled', labels: ['Tắt/Bật','Bật/Tắt','Tắt...','Off/On'] },
      { field: 'campaign', labels: ['campaign name','tên chiến dịch','campaign','chiến dịch'] },
      { field: 'status', labels: ['lượt phân phối chiến dịch','phân phối','delivery','delivery status','status','trạng thái'] },
      { field: 'budget', labels: ['ngân sách nhóm quảng cáo','budget','ngân sách'] },
      { field: 'budgetType', labels: ['loại ngân sách nhóm quảng cáo','budget type'] },
      { field: 'spend', labels: ['số tiền đã chi tiêu (vnd)','amount spent','spend','số tiền đã chi tiêu','số tiền đã chi','chi tiêu'] },
      { field: 'impressions', labels: ['impressions','lượt hiển thị'] },
      { field: 'reach', labels: ['reach','người tiếp cận'] },
      { field: 'results', labels: ['results','kết quả'] },
      { field: 'resultIndicator', labels: ['result indicator','chỉ báo kết quả'] },
      { field: 'costPerResult', labels: ['cost per result','chi phí mỗi kết quả','chi phí trên mỗi kết quả'] },
      { field: 'newMessagingContacts', labels: ['new messaging contacts','người liên hệ nhắn tin mới'] },
      { field: 'costPerNewMessagingContact', labels: ['cost per new messaging contact','chi phí trên mỗi người liên hệ nhắn tin mới','chi phí trên mỗi người liên hệ nhắn tin mới (vnd)'] },
      { field: 'messagingConversationsStarted', labels: ['messaging conversations started','lượt bắt đầu cuộc trò chuyện','lượt bắt đầu cuộc trò chuyện qua tin nhắn'] },
      { field: 'costPerMessagingConversationStart', labels: ['cost per messaging conversation start','chi phí trên mỗi lượt bắt đầu cuộc trò chuyện','chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn','chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn (vnd)'] },
      { field: 'originalResults', labels: ['original results','kết quả ban đầu'] },
      { field: 'originalResultIndicator', labels: ['original result indicator','chỉ báo kết quả ban đầu'] },
      { field: 'reportStart', labels: ['reporting starts','lượt bắt đầu báo cáo'] },
      { field: 'reportEnd', labels: ['reporting ends','lượt kết thúc báo cáo'] },
      { field: 'adSetEnd', labels: ['end','kết thúc'] },
      { field: 'campaignId', labels: ['campaign id','id chiến dịch'] }
    ];
  // Use the full header cell, never the center of its short text label.
  function columnBounds(element) {
    let node = element;
    const explicit = element.closest?.('[role="columnheader"],th');
    if (explicit) return explicit.getBoundingClientRect();
    let rect = node.getBoundingClientRect();
    for (let depth = 0; node.parentElement && depth < 6; depth++) {
      const parent = node.parentElement, next = parent.getBoundingClientRect();
      if (next.width > 420 || next.height > 80 || next.height < rect.height || Math.abs(next.top - rect.top) > 35) break;
      node = parent; rect = next;
    }
    return rect;
  }
  function textInColumn(items, column, row, fullText = false) {
    const candidates = items.filter(item => {
      const r = item.rect;
      return r.width > 0 && r.height > 0 && r.left >= column.left - 2 && r.right <= column.right + 2 &&
        r.top >= row.top - 2 && r.bottom <= row.bottom + 2 && item.text;
    });
    // Pick the upper text line first: numeric value precedes its attribution label.
    candidates.sort((a,b) => a.rect.top - b.rect.top || a.rect.height - b.rect.height || a.rect.width - b.rect.width);
    if (!fullText) return candidates[0]?.text || '';
    // Prefer a full cell container, then deduplicate leaf lines in visual order.
    const enclosing = candidates.find(item => candidates.every(other => other.rect.left >= item.rect.left - 1 && other.rect.right <= item.rect.right + 1 && other.rect.top >= item.rect.top - 1 && other.rect.bottom <= item.rect.bottom + 1));
    return enclosing?.text || [...new Set(candidates.filter(item => !candidates.some(other => other !== item && item.element?.contains?.(other.element))).map(item => item.text))].join('\n');
  }
  function readGrid(rootElement) {
    const headerElements = [...rootElement.querySelectorAll('[role="columnheader"],thead th')];
    const headerMap = new Map();
    headerElements.forEach((element, position) => {
      const label = elementText(element);
      const ariaIndex = Number(element.getAttribute('aria-colindex'));
      const index = Number.isInteger(ariaIndex) && ariaIndex > 0 ? ariaIndex - 1 : position;
      if (!headerMap.has(index) || label.length > headerMap.get(index).label.length) {
        const rect = element.getBoundingClientRect();
        headerMap.set(index, { index, label, left: rect.left, right: rect.right, centerX: rect.left + rect.width / 2, width: rect.width });
      }
    });
    const allHeaders = [...headerMap.values()].sort((a, b) => a.index - b.index);
    const headers = allHeaders.filter(header => header.label);
    const rowElements = [...rootElement.querySelectorAll('[role="row"],tr')].filter(row => row.querySelector('[role="gridcell"],[role="cell"],td'));
    const rows = rowElements.map(row => {
      const cellElements = [...row.querySelectorAll('[role="gridcell"],[role="cell"],td')].filter(cell => cell.closest('[role="row"],tr') === row);
      const cells = new Map();
      cellElements.forEach((element, position) => {
        const ariaIndex = Number(element.getAttribute('aria-colindex'));
        const value = String(element.innerText || element.textContent || element.getAttribute('aria-label') || '').trim();
        if (!value) return;
        let index = Number.isInteger(ariaIndex) && ariaIndex > 0 ? ariaIndex - 1 : null;
        if (index === null) {
          const rect = element.getBoundingClientRect();
          const matches = allHeaders.filter(header => header.width > 0 && rect.left >= header.left - 2 && rect.right <= header.right + 2);
          if (matches.length !== 1) return;
          index = matches[0].index;
        }
        if (!cells.has(index) || value.length > cells.get(index).length) cells.set(index, value);
      });
      return { row, cells, fullText: elementText(row), selected: rowIsSelected(row) };
    });
    const nameHeader = headerIndex(headers, ['campaign name','tên chiến dịch','campaign','chiến dịch']);
    const spendHeader = headerIndex(headers, ['amount spent','spend','số tiền đã chi tiêu','số tiền đã chi','số tiền chi tiêu thực tế','chi tiêu']);
    const score = (nameHeader >= 0 ? 100 : 0) + (spendHeader >= 0 ? 15 : 0) + Math.min(rows.length, 20) + Math.min(headers.length, 20);
    return { headers, rows, score, nameHeader };
  }
  function hasBlueSelectionFill(element) {
    const isBlue = node => {
      const channels = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
      if (channels.length < 3 || (channels.length > 3 && channels[3] < 0.45)) return false;
      return channels[2] > channels[0] + 12 && channels[2] > channels[1] + 2;
    };
    if (isBlue(element)) return true;
    let blueCells = 0;
    for (const child of [...element.children].slice(0, 30)) {
      if (isBlue(child) || [...child.children].some(isBlue)) blueCells++;
      if (blueCells >= 2) return true;
    }
    return false;
  }
  function fallbackSelectedRows() {
    const headerTerms = headerSpecs.flatMap(spec => spec.labels.map(key)).filter(term => term.length > 5);
    const minWidth = Math.max(500, innerWidth * 0.45);
    const rowLike = element => {
      const rect = element.getBoundingClientRect();
      if (rect.width < minWidth || rect.height < 24 || rect.height > 100 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
      const text = elementText(element);
      return text.length > 5 && text.length < 1800;
    };
    const selectedControls = [...document.querySelectorAll('[role="checkbox"],input[type="checkbox"],[data-testid*="select" i],[aria-label*="deselect" i],[aria-label*="bỏ chọn" i]')].filter(control => {
      const label = `${control.getAttribute('aria-label') || ''} ${control.getAttribute('title') || ''}`;
      return control.matches('input[type="checkbox"]:checked') || control.getAttribute('aria-checked') === 'true' || control.getAttribute('data-state') === 'checked' || control.getAttribute('data-checked') === 'true' || control.getAttribute('aria-pressed') === 'true' || /\b(deselect|unselect|selected)\b|bỏ chọn/i.test(label);
    });
    const candidates = [];
    for (const control of selectedControls.filter(control => control.getAttribute('role') !== 'switch' && !control.closest?.('[role="switch"]'))) {
      let ancestor = control.parentElement;
      for (let depth = 0; ancestor && ancestor !== document.body && depth < 12; depth++, ancestor = ancestor.parentElement) {
        if (rowLike(ancestor)) { candidates.push(ancestor); break; }
      }
    }
    const metaSelectedCount = Number(normalize(document.body.innerText).match(/đã chọn\s+(\d+)\s+mục/i)?.[1]) || 0;
    if (candidates.length < metaSelectedCount || !candidates.length) {
      for (const element of document.querySelectorAll('div,tr,[role]')) {
        const rect = element.getBoundingClientRect();
        if (rect.width >= minWidth && rect.height >= 24 && rect.height <= 100 && rect.bottom > 0 && rect.top < innerHeight && hasBlueSelectionFill(element) && rowLike(element)) candidates.push(element);
      }
    }
    candidates.sort((a, b) => Math.abs(a.getBoundingClientRect().height - 46) - Math.abs(b.getBoundingClientRect().height - 46) || b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    const rows = [];
    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      const rowKey = key(elementText(element));
      if (headerTerms.filter(term => rowKey.includes(term)).length >= 3) continue;
      if (rows.some(row => { const other = row.getBoundingClientRect(); return Math.abs(rect.top - other.top) < 5 && Math.abs(rect.left - other.left) < 12; })) continue;
      rows.push(element);
    }
    const allHeaderNodes = [...document.querySelectorAll('div,span,button,th')].filter(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 10 || rect.height <= 8 || rect.height >= 70 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
      const text = key(elementText(element));
      return text && text.length < 65;
    });
    function findHeader(rowRect, spec) {
      const labels = spec.labels.map(key);
      return allHeaderNodes.map(element => ({ element, text: elementText(element), rect: columnBounds(element) }))
        .filter(item => labels.includes(key(item.text)) && item.rect.bottom <= rowRect.top + 6 && rowRect.top - item.rect.bottom < 260 && item.rect.left < rowRect.right && item.rect.right > rowRect.left)
        .sort((a, b) => labels.indexOf(key(a.text)) - labels.indexOf(key(b.text)) || b.rect.bottom - a.rect.bottom || a.rect.width * a.rect.height - b.rect.width * b.rect.height)[0] || null;
    }
    const account = normalize(document.querySelector('[data-testid*="account"]')?.innerText || document.querySelector('[aria-label*="account"]')?.getAttribute('aria-label') || new URL(location.href).searchParams.get('act') || 'Meta Ads');
    const now = new Date(), reportAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reportRange = activeReportRange();
    const output = [];
    const detectedHeaders = new Set();
    for (const row of rows) {
      const bounds = row.getBoundingClientRect(), centerY = bounds.top + bounds.height / 2;
      const cells = [...row.querySelectorAll('a,span,div,button,[role="gridcell"],[role="cell"],td')]
        .map(element => ({element, rect: element.getBoundingClientRect(), text: String(element.innerText || element.textContent || '').trim()}));
      const value = field => {
        const spec = headerSpecs.find(header => header.field === field), header = spec && findHeader(row.getBoundingClientRect(), spec);
        if (!header || !cells.length) return '';
        detectedHeaders.add(header.text);
        return textInColumn(cells, header.rect, bounds, true);
      };
      const name = (value('campaign') || '').split(/\n/)[0].trim();
      if (!name || /^(total|total results|kết quả tổng cộng|tổng cộng|draft|campaigns|ad sets|ads)$/i.test(name)) continue;
      const resultCount = numberFrom(value('results'));
      const newMessagingContacts = numberFrom(value('newMessagingContacts'));
      const messagingConversationsStarted = numberFrom(value('messagingConversationsStarted'));
      const delivery = value('status');
      if (!delivery || /^(?:lượt click trong|lượt nhấp trong|cài đặt ghi nhận|attribution)/i.test(name) || /click|nhấp|attribution|ghi nhận|7 ngày|1 ngày/i.test(delivery)) continue;
      const rawBudget = value('budget'), rawBudgetType = value('budgetType');
      const reportStart = value('reportStart') || reportRange.start;
      const reportEnd = value('reportEnd') || reportRange.end;
      const item = {
        id: value('campaignId'), name, campaign: name, adSetName: name, account, platform: 'Facebook',
        status: delivery, delivery, budget: numberFrom(rawBudget), budgetType: rawBudgetType || (numberFrom(rawBudget) === null ? rawBudget : ''), spend: numberFrom(value('spend')),
        impressions: numberFrom(value('impressions')), reach: numberFrom(value('reach')), results: resultCount,
        resultIndicator: value('resultIndicator'), costPerResult: numberFrom(value('costPerResult')),
        newMessagingContacts, costPerNewMessagingContact: numberFrom(value('costPerNewMessagingContact')),
        messagingConversationsStarted, costPerMessagingConversationStart: numberFrom(value('costPerMessagingConversationStart')),
        originalResults: numberFrom(value('originalResults')), originalResultIndicator: value('originalResultIndicator'),
        attributionSetting: value('attributionSetting') || '', adSetEnd: value('adSetEnd') || '',
        dailyMessages: resultCount,
        dailyAvgMessageCost: numberFrom(value('costPerResult')),
        source: 'Meta Ads Manager', reportStart, reportEnd, reportAt, capturedAt: new Date().toISOString()
      };
      const rawColumns = headerSpecs.map(spec => {const header = findHeader(bounds,spec);return header ? {label: header.text, value: value(spec.field), left:header.rect.left} : null;}).filter(Boolean).sort((a,b)=>a.left-b.left).map(({label,value})=>({label,value}));
      completeMetric(item, rawColumns, row);
      output.push(item);
    }
    lastScanInfo = { headers: [...detectedHeaders], rows: rows.length, selected: rows.length, metaSelectedCount };
    return [...new Map(output.map(item => [`${key(item.account)}|${key(item.name)}|${item.spend}`, item])).values()];
  }
  function completeMetric(item, rawColumns, row) {
    item.rawColumns = rawColumns;
    const headers = rawColumns.map((column,index) => ({label: column.label,index}));
    const cells = new Map(rawColumns.map((column,index) => [index,column.value]));
    const raw = field => {const spec=headerSpecs.find(spec=>spec.field===field);return spec?cellValue(headers,cells,spec.labels):'';};
    for (const field of ['impressions','reach','newMessagingContacts','costPerNewMessagingContact','messagingConversationsStarted','costPerMessagingConversationStart']) item[field] = numberFrom(raw(field));
    const subline = value => String(value || '').split(/\n/).slice(1).map(normalize).filter(Boolean).join(' ');
    item.resultIndicator = raw('resultIndicator') || subline(raw('results')) || item.resultIndicator || '';
    item.costPerResultLabel = subline(raw('costPerResult'));
    item.budgetType = raw('budgetType') || subline(raw('budget')) || item.budgetType || '';
    const toggle = row?.querySelector?.('[role="switch"],input[type="checkbox"][aria-label*="campaign" i]');
    item.enabled = toggle ? (toggle.getAttribute('aria-checked') === 'true' || toggle.checked === true) : null;
    if (toggle) {
      const column=rawColumns.find(column => /^(tatbat|battat|offon|tat)$/.test(key(column.label)));
      if (column) column.value=item.enabled?'Bật':'Tắt';
      else rawColumns.unshift({label:'Tắt/Bật',value:item.enabled?'Bật':'Tắt'});
    }
    item.dailyMessages = item.results;
    item.dailyAvgMessageCost = item.costPerResult;
  }
  function rowsFromTable() {
    const candidateRoots = [...document.querySelectorAll('[role="grid"],[role="table"],table')];
    let grids = candidateRoots.map(element => readGrid(element)).filter(grid => grid.rows.length);
    if (grids.some(candidate => candidate.nameHeader >= 0)) grids = grids.filter(candidate => candidate.nameHeader >= 0);
    else {
      const pageGrid = readGrid(document);
      if (pageGrid.rows.length && (pageGrid.nameHeader >= 0 || !grids.length)) grids = [pageGrid];
    }
    const grid = grids.sort((a, b) => b.score - a.score)[0] || { headers: [], rows: [] };
    const { headers, rows } = grid;
    const selectedRows = rows.filter(row => row.selected);
    lastScanInfo = { headers: headers.map(header => header.label), rows: rows.length, selected: selectedRows.length };
    const account = normalize(document.querySelector('[data-testid*="account"]')?.innerText || document.querySelector('[aria-label*="account"]')?.getAttribute('aria-label') || new URL(location.href).searchParams.get('act') || 'Meta Ads');
    const now = new Date(), reportAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reportRange = activeReportRange();
    const output = [];
    for (const { row, cells, fullText } of selectedRows) {
      if (cells.size < 1) continue;
      if (!fullText) continue;
      const campaign = preferredCellValue(headers,cells,['campaign name','tên chiến dịch','campaign','chiến dịch']);
      const name = campaign.split(/\n/)[0].trim();
      if (!name || /^(total|total results|kết quả tổng cộng|tổng cộng|draft|campaigns|ad sets|ads|chiến dịch|nhóm quảng cáo)$/i.test(name)) continue;
      const statusText = preferredCellValue(headers,cells,['lượt phân phối chiến dịch','phân phối','delivery','delivery status','trạng thái phân phối','status','trạng thái']);
      if (!statusText || /^(?:lượt click trong|lượt nhấp trong|cài đặt ghi nhận|attribution)/i.test(name) || /click|nhấp|attribution|ghi nhận|7 ngày|1 ngày/i.test(statusText)) continue;
      const resultCount = numberFrom(cellValue(headers,cells,['results','kết quả']));
      const newMessagingContacts = numberFrom(cellValue(headers,cells,['new messaging contacts','người liên hệ nhắn tin mới']));
      const messagingConversationsStarted = numberFrom(cellValue(headers,cells,['messaging conversations started','lượt bắt đầu cuộc trò chuyện qua tin nhắn']));
      const reportStart = cellValue(headers,cells,['reporting starts','lượt bắt đầu báo cáo']) || reportRange.start;
      const reportEnd = cellValue(headers,cells,['reporting ends','lượt kết thúc báo cáo']) || reportRange.end;
      const item = {
        id: cellValue(headers,cells,['campaign id','id chiến dịch','id']),
        name, campaign: name, adSetName: name, account, platform: 'Facebook',
        status: (statusText || 'Đang chạy').split('\n')[0], delivery: (statusText || 'Đang chạy').split('\n')[0],
        budget: numberFrom(cellValue(headers,cells,['ngân sách nhóm quảng cáo','ngân sách','budget'])),
        budgetType: cellValue(headers,cells,['loại ngân sách nhóm quảng cáo','budget type']) || (() => { const raw = cellValue(headers,cells,['ngân sách nhóm quảng cáo','ngân sách','budget']); return numberFrom(raw) === null ? raw : ''; })(),
        spend: numberFrom(cellValue(headers,cells,['số tiền đã chi tiêu (vnd)','amount spent','spend','số tiền đã chi tiêu','số tiền đã chi','chi tiêu'])),
        impressions: numberFrom(cellValue(headers,cells,['impressions','lượt hiển thị'])),
        reach: numberFrom(cellValue(headers,cells,['reach','người tiếp cận'])),
        results: resultCount,
        resultIndicator: cellValue(headers,cells,['result indicator','chỉ báo kết quả']),
        costPerResult: numberFrom(cellValue(headers,cells,['cost per result','chi phí mỗi kết quả','chi phí trên mỗi kết quả'])),
        newMessagingContacts,
        costPerNewMessagingContact: numberFrom(cellValue(headers,cells,['cost per new messaging contact','chi phí trên mỗi người liên hệ nhắn tin mới (vnd)'])),
        messagingConversationsStarted,
        costPerMessagingConversationStart: numberFrom(cellValue(headers,cells,['cost per messaging conversation start','chi phí trên mỗi lượt bắt đầu cuộc trò chuyện qua tin nhắn (vnd)'])),
        originalResults: numberFrom(cellValue(headers,cells,['original results','kết quả ban đầu'])),
        originalResultIndicator: cellValue(headers,cells,['original result indicator','chỉ báo kết quả ban đầu']),
        attributionSetting: cellValue(headers,cells,['attribution setting','cài đặt ghi nhận']),
        adSetEnd: cellValue(headers,cells,['end','kết thúc']),
        dailyMessages: resultCount,
        dailyAvgMessageCost: numberFrom(cellValue(headers,cells,['cost per result','chi phí mỗi kết quả','chi phí trên mỗi kết quả'])),
        source: 'Meta Ads Manager', reportStart, reportEnd, reportAt, capturedAt: new Date().toISOString()
      };
      completeMetric(item, headers.map(header => ({label: header.label, value: cells.get(header.index) || ''})), row);
      output.push(item);
    }
    const distinct = new Map(output.map(item => [item.id ? `id:${item.id}` : `${key(item.account)}|${key(item.name)}|${item.spend}`, item]));
    return distinct.size ? [...distinct.values()] : fallbackSelectedRows();
  }
  function renderMetricPreview(rows) {
    const preview = root.querySelector('#fbtq-metric-preview');
    preview.replaceChildren();
    preview.hidden = !rows.length;
    if (!rows.length) return;
    const title = document.createElement('b');
    title.className = 'fbtq-preview-title';
    title.textContent = 'Dữ liệu sắp chuyển';
    preview.append(title);
    const table = document.createElement('table');
    table.className = 'fbtq-preview-table';
    const labels = [...new Set(rows.flatMap(item => (item.rawColumns || []).map(column => column.label)))];
    const head = table.createTHead().insertRow();
    labels.forEach(label => {const th=document.createElement('th');th.textContent=label;head.append(th);});
    const body = table.createTBody();
    rows.forEach(item => {
      const tr=body.insertRow();
      labels.forEach(label => {const td=tr.insertCell();td.textContent=item.rawColumns?.find(column=>column.label===label)?.value || '—';});
    });
    preview.append(table);
  }

  function collectMetrics() {
    lastRows = rowsFromTable();
    renderMetricPreview(lastRows);
    const headerSummary = lastScanInfo.headers.slice(0, 8).join(' · ');
    count.textContent = lastScanInfo.selected ? `${lastScanInfo.selected} hàng đã chọn · ${lastRows.length} hàng nhận diện` : lastScanInfo.metaSelectedCount ? `Meta đã chọn ${lastScanInfo.metaSelectedCount} mục · chưa đọc được hàng` : `${lastScanInfo.rows} hàng trong bảng · chưa chọn`;
    count.title = headerSummary ? `Các cột Meta được đọc: ${headerSummary}` : 'Chưa tìm thấy tiêu đề cột trên trang.';
    const message = lastRows.length
      ? `Đã quét ${lastRows.length} dòng. Bài chạy lấy từ Chiến dịch; Số Mess lấy từ Kết quả. Hãy đối chiếu phần xem trước rồi gửi sang Trợ lý FBTQ.`
      : !lastScanInfo.selected
        ? lastScanInfo.metaSelectedCount ? `Meta đang báo đã chọn ${lastScanInfo.metaSelectedCount} mục nhưng extension chưa đọc được dòng. Giữ tab Chiến dịch đang mở, tải lại Ads Manager rồi quét lại.` : headerSummary ? 'Chưa có chiến dịch nào được tích chọn. Tích ô vuông bên trái các dòng trong tab Chiến dịch trên Meta, sau đó quét lại.' : 'Meta chưa hiển thị bảng Chiến dịch. Chọn tab Chiến dịch, chờ bảng tải xong rồi tích chọn các dòng cần gửi.'
        : headerSummary ? `Đã thấy ${lastScanInfo.selected} dòng được chọn nhưng chưa đọc được tên chiến dịch. Các cột đang thấy: ${headerSummary}.` : 'Đã thấy dòng được chọn nhưng chưa đọc được bảng Chiến dịch. Chờ bảng tải xong rồi quét lại.';
    setStatus(message, lastRows.length ? 'success' : 'warning');
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
    if (billing) renderPdfLinks(); else if (!panel.hidden) collectMetrics(); else count.textContent = 'Tích chọn dòng trên Meta rồi bấm Quét mục đã chọn';
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
    try { await queuePayload({ kind: 'metrics', campaigns: rows, reportAt: rows[0]?.reportAt || '', reportStart: rows[0]?.reportStart || '', reportEnd: rows[0]?.reportEnd || '', capturedAt: new Date().toISOString(), source: 'Marketing Ai FBTQ Meta Helper' }); }
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
    const json = JSON.stringify({ source: 'Marketing Ai FBTQ Meta Helper', reportAt: rows[0]?.reportAt || '', reportStart: rows[0]?.reportStart || '', reportEnd: rows[0]?.reportEnd || '', capturedAt: new Date().toISOString(), campaigns: rows }, null, 2);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(json);
      else throw new Error('Clipboard API chưa sẵn sàng.');
      setStatus('Đã sao chép JSON. Có thể dán vào Hiệu suất marketing → Nhập chỉ số.', 'success');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = json;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      setStatus(copied ? 'Đã sao chép JSON. Có thể dán vào Hiệu suất marketing → Nhập chỉ số.' : 'Chrome chặn sao chép clipboard. Hãy bấm Tải JSON đã chọn để lưu tệp.', copied ? 'success' : 'warning');
    }
  }
  function downloadJson() {
    const rows = collectMetrics();
    if (!rows.length) return;
    const blob = new Blob([JSON.stringify({ source: 'Marketing Ai FBTQ Meta Helper', reportAt: rows[0]?.reportAt || '', reportStart: rows[0]?.reportStart || '', reportEnd: rows[0]?.reportEnd || '', capturedAt: new Date().toISOString(), campaigns: rows }, null, 2)], { type: 'application/json' });
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
