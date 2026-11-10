document.querySelector('#open-ads').addEventListener('click',()=>chrome.tabs.create({url:'https://adsmanager.facebook.com/adsmanager/'}));
<<<<<<< HEAD
document.querySelector('#open-site').addEventListener('click',()=>chrome.tabs.create({url:'https://bighappy9xx.github.io/marketing-ai-fbtq/#analytics'}));
=======
document.querySelector('#open-site').addEventListener('click',()=>chrome.tabs.create({url:'https://bighappy9xx.github.io/marketing-ai-fbtq/#assistant'}));
>>>>>>> 92a65212e075b8af161c2b276f7ced1bb07d734a
async function renderPending(){const record=(await chrome.storage.local.get('fbtqPendingWebsitePayload')).fbtqPendingWebsitePayload,box=document.querySelector('#pending-item');box.hidden=!record;if(record)document.querySelector('#pending-label').textContent=record.kind==='invoice-pdf'?record.filename||'PDF hóa đơn Meta':'Chỉ số quảng cáo · '+(record.campaigns?.length||0)+' hàng'}
document.querySelector('#cancel-pending').addEventListener('click',async()=>{await chrome.storage.local.remove('fbtqPendingWebsitePayload');await renderPending()});
chrome.storage.onChanged.addListener(changes=>{if(changes.fbtqPendingWebsitePayload)renderPending()});renderPending();

document.querySelector('#open-invoices').addEventListener('click',()=>chrome.tabs.create({url:'https://bighappy9xx.github.io/marketing-ai-fbtq/#automation'}));
