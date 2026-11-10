(() => {
  if (window.__fbtqExtensionBridgeLoaded) return;
  window.__fbtqExtensionBridgeLoaded = true;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'FBTQ_APP_READY') chrome.runtime.sendMessage({ type: 'FBTQ_WEBSITE_READY' }).catch(() => {});
    if (event.data?.type === 'FBTQ_EXTENSION_IMPORT_RESULT') chrome.runtime.sendMessage({ type: 'FBTQ_IMPORT_RESULT', deliveryId: event.data.deliveryId, ok: !!event.data.ok }).catch(() => {});
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'FBTQ_DELIVER_TO_SITE' || !message.payload) return;
    window.postMessage({ type: 'FBTQ_EXTENSION_IMPORT', payload: message.payload }, location.origin);
  });
})();
