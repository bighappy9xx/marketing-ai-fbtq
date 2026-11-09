const SITE_URL = 'https://bighappy9xx.github.io/marketing-ai-fbtq/';
const PENDING_KEY = 'fbtqPendingWebsitePayload';
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function isMetaUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com') || url.hostname.endsWith('.fbcdn.net') || url.hostname.endsWith('.fbsbx.com'));
  } catch { return false; }
}
function bytesToBase64(bytes) {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(output);
}
function filenameFromResponse(response, url) {
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let name = encoded ? decodeURIComponent(encoded) : plain || decodeURIComponent(new URL(url).pathname.split('/').pop() || 'meta-receipt.pdf');
  name = name.replace(/[\\/:*?"<>|]/g, '_');
  return name.toLowerCase().endsWith('.pdf') ? name : `${name || 'meta-receipt'}.pdf`;
}
async function ensureWebsiteOpen(kind) {
  const tabs = await chrome.tabs.query({ url: `${SITE_URL}*` });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId !== undefined) await chrome.windows.update(tabs[0].windowId, { focused: true });
    return tabs[0].id;
  }
  const tab = await chrome.tabs.create({ url: SITE_URL+(kind==='invoice-pdf'?'#automation':'#analytics'), active: true });
  return tab.id;
}
async function queueForWebsite(payload) {
  const { [PENDING_KEY]: pending } = await chrome.storage.local.get(PENDING_KEY);
  if (pending) return { ok: false, error: 'Một mục khác đang chờ gửi. Hãy hoàn tất mục đó trên website trước.' };
  await chrome.storage.local.set({ [PENDING_KEY]: payload });
  const tabId = await ensureWebsiteOpen(payload.kind);
  try { await deliverPending(tabId); } catch {}
  return { ok: true, queued: true };
}
async function deliverPending(tabId) {
  const { [PENDING_KEY]: payload } = await chrome.storage.local.get(PENDING_KEY);
  if (!payload || payload.deliveryId) return { ok: true, empty: !payload, waitingForApp: !!payload };
  payload.deliveryId = crypto.randomUUID();
  await chrome.storage.local.set({ [PENDING_KEY]: payload });
  try { await chrome.tabs.sendMessage(tabId, { type: 'FBTQ_DELIVER_TO_SITE', payload }); }
  catch (error) { payload.deliveryId = ''; await chrome.storage.local.set({ [PENDING_KEY]: payload }); throw error; }
  return { ok: true, delivered: true };
}
async function fetchMetaPdf(url) {
  if (!isMetaUrl(url)) throw new Error('Chỉ tải PDF từ trang Meta/Facebook đang đăng nhập.');
  const response = await fetch(url, { credentials: 'include', redirect: 'follow' });
  if (!response.ok) throw new Error(`Meta không trả được tệp PDF (HTTP ${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new Error('PDF trống hoặc vượt giới hạn 5 MB của website.');
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Liên kết này không trả về PDF. Hãy mở biên lai PDF hoặc chọn tệp đã tải xuống.');
  return { ok: true, filename: filenameFromResponse(response, url), mimeType: 'application/pdf', base64: bytesToBase64(bytes) };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FBTQ_QUEUE_TO_WEBSITE') {
    if (!isMetaUrl(sender.url || '')) { sendResponse({ ok: false, error: 'Nguồn gửi không phải trang Meta.' }); return; }
    queueForWebsite(message.payload).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message || 'Không mở được website.' }));
    return true;
  }
  if (message?.type === 'FBTQ_FETCH_META_PDF') {
    if (!isMetaUrl(sender.url || '')) { sendResponse({ ok: false, error: 'Nguồn gửi không phải trang Meta.' }); return; }
    fetchMetaPdf(message.url).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message || 'Không tải được PDF.' }));
    return true;
  }
  if (message?.type === 'FBTQ_WEBSITE_READY') {
    if (!sender.tab?.id || !String(sender.url || '').startsWith(SITE_URL)) { sendResponse({ ok: false }); return; }
    deliverPending(sender.tab.id).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message || 'Không chuyển được dữ liệu.' }));
    return true;
  }
  if (message?.type === 'FBTQ_IMPORT_RESULT') {
    if (!String(sender.url || '').startsWith(SITE_URL)) { sendResponse({ ok: false }); return; }
    chrome.storage.local.get(PENDING_KEY).then(async result => {
      const pending = result[PENDING_KEY];
      if (pending?.deliveryId === message.deliveryId) {
        if (message.ok) await chrome.storage.local.remove(PENDING_KEY);
        else { pending.deliveryId = ''; await chrome.storage.local.set({ [PENDING_KEY]: pending }); }
      }
      sendResponse({ ok: true });
    }).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  return false;
});
