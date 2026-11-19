import {pageAvatar} from './inbox-realtime.js?v=20261119-messenger-profile-identity';
import {fanpageColor} from './inbox-notifications.js?v=20261118-blue-chatbot-menu';

const icons={
  menu:'M4 6h16M4 12h16M4 18h16',
  filter:'M4 6h16M7 12h10m-7 6h4',
  back:'m15 5-7 7 7 7',
  add:'M12 5v14M5 12h14',
  chat:'M5 6h14v10H9l-4 3z',
  pages:'M5 4h10v12H5zm4 15h10V8',
  chart:'M4 19h16M7 15v-4m5 4V6m5 9V9',
  settings:'M5 7h14M5 12h14M5 17h14m-9-12v4m4 1v4m-5 1v4',
  details:'M7 20h10m-5-8v8m0-15v3 M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0',
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]}"/></svg>`;
const iconButton=(action,graphic,name)=>`<button type="button" class="inbox-mobile-icon" data-mobile-action="${action}" aria-label="${name}">${icon(graphic)}</button>`;

export function initMobileInbox({page,state,onConnect,onNavigate}){
  const media=matchMedia('(max-width:760px)');
  const list=page.querySelector('.inbox-list'),picker=list.querySelector('.inbox-page-picker');
  const header=document.createElement('header');
  header.className='inbox-mobile-header';
  header.innerHTML=`${iconButton('workspace','menu','Mở menu FBTQ')}<div class="inbox-mobile-title"><small>FBTQ INBOX</small><strong data-mobile-title>Hội thoại</strong></div><button class="inbox-mobile-pages" data-mobile-action="pages" type="button" aria-label="Chọn Fanpage"></button>${iconButton('connect','add','Kết nối Fanpage')}${iconButton('tools','settings','Công cụ hộp thư')}`;
  page.querySelector('.messenger-topbar').before(header);
  const search=list.querySelector('.inbox-search');
  const searchInput=search.querySelector('input');
  const desktopPlaceholder=searchInput.placeholder;
  const syncSearchPlaceholder=()=>{searchInput.placeholder=media.matches?'Tìm hội thoại':desktopPlaceholder;};
  syncSearchPlaceholder();
  const controls=document.createElement('div');
  controls.className='inbox-mobile-list-controls';
  controls.innerHTML=`${iconButton('filters','filter','Bộ lọc hội thoại')}`;
  search.before(controls);

  const chatControls=document.createElement('div');
  chatControls.className='inbox-mobile-chat-actions';
  chatControls.innerHTML=iconButton('options','settings','Tùy chọn hội thoại')+iconButton('details','details','Thông tin khách hàng');
  const chatHeader=page.querySelector('.chat-header');
  const back=document.createElement('button');
  back.type='button';
  back.className='inbox-mobile-icon inbox-mobile-chat-back';
  back.setAttribute('aria-label','Về danh sách hội thoại');
  back.dataset.mobileAction='list';
  back.innerHTML=icon('back');
  chatHeader.append(back,chatControls);
  const detailBack=document.createElement('div');
  detailBack.className='inbox-mobile-detail-back';
  detailBack.innerHTML=iconButton('chat','back','Quay về cuộc chat')+'<strong>Thông tin khách hàng</strong>';
  page.querySelector('.chat-settings').prepend(detailBack);

  const dock=document.createElement('nav');
  dock.className='inbox-mobile-dock';
  dock.setAttribute('aria-label','Điều hướng hộp thư');
  dock.innerHTML=[['list','chat','Hội thoại'],['pages','pages','Fanpage'],['analytics','chart','Thống kê'],['settings','settings','Cài đặt']].map(([action,glyph,label])=>`<button type="button" data-mobile-action="${action}">${icon(glyph)}<span>${label}</span></button>`).join('');
  page.append(dock);
  const tools=header.querySelector('[data-mobile-action="tools"]');
  tools.setAttribute('aria-expanded','false');

  let listScroll=0,view='list';
  function render(){
    if(!media.matches)return;
    const pages=(state.pages||[]).filter(item=>item.active!==false);
    const selected=state.inboxSelectedPageIds;
    const choices=selected===null||selected===undefined?pages:pages.filter(item=>selected.includes(item.pageId));
    const stack=header.querySelector('.inbox-mobile-pages');
    const markup=choices.slice(0,3).map(pageAvatar).join('')+(choices.length>3?`<span class="inbox-mobile-page-more">+${choices.length-3}</span>`:'');
    stack.innerHTML=markup||'<span class="inbox-mobile-page-more">Fanpage</span>';
    stack.querySelectorAll('.fanpage-avatar').forEach((avatar,index)=>avatar.style.setProperty('--mobile-page-ring',fanpageColor(choices[index])));
  }
  function show(next,reset=false){
    if(!reset&&(!media.matches||next===view))return;
    if(view==='list')listScroll=list.scrollTop;
    view=next;
    page.dataset.mobileInboxView=view;
    delete page.dataset.mobileChatOptions;
    delete page.dataset.mobileInboxFilters;
    delete page.dataset.mobileInboxTools;
    tools.setAttribute('aria-expanded','false');
    controls.firstElementChild.setAttribute('aria-expanded','false');
    chatControls.firstElementChild.setAttribute('aria-expanded','false');
    picker.open=view==='pages';
    header.querySelector('[data-mobile-title]').textContent=view==='pages'?'Fanpage':'Hội thoại';
    dock.querySelectorAll('button').forEach(button=>{
      if(button.dataset.mobileAction===view)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    if(view==='list')list.scrollTop=listScroll;
    if(view==='pages')list.scrollTop=0;
  }
  page.dataset.mobileInboxView=view;
  dock.querySelector('[data-mobile-action="list"]').setAttribute('aria-current','page');
  controls.firstElementChild.setAttribute('aria-expanded','false');
  chatControls.firstElementChild.setAttribute('aria-expanded','false');
  page.addEventListener('click',event=>{
    if(!media.matches)return;
    const button=event.target.closest('[data-mobile-action]');
    if(!button)return;
    const action=button.dataset.mobileAction;
    if(action==='list'||action==='pages'){
      if(page.classList.contains('broadcast-active')){
        page.querySelector('[data-inbox-tab="conversations"]').click();
        searchInput.blur();
      }
      show(action);
      return;
    }
    if(action==='details'||action==='chat'){show(action);return;}
    if(action==='filters'||action==='options'||action==='tools'){
      const key={filters:'mobileInboxFilters',options:'mobileChatOptions',tools:'mobileInboxTools'}[action];
      const next=!(key in page.dataset);
      if(next)page.dataset[key]='';
      else delete page.dataset[key];
      button.setAttribute('aria-expanded',String(next));
      return;
    }
    if(action==='workspace'){document.querySelector('#mobileMenu')?.click();return;}
    if(action==='connect'){onConnect();return;}
    if(action==='analytics'||action==='settings'){show('list');onNavigate(action==='settings'?'chatbot-settings':'analytics');}
  });
  media.addEventListener('change',()=>{
    syncSearchPlaceholder();
    if(media.matches){render();return;}
    const pageSearch=picker.querySelector('.inbox-mobile-page-search');
    pageSearch.value='';
    pageSearch.dispatchEvent(new Event('input'));
    show('list',true);
  });
  render();
  return {render,showThread(){
    if(!media.matches||view==='chat')return false;
    show('chat');
    return true;
  },reset(){show('list');}};
}
