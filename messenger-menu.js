export function initMessengerMenus({page,navigation,cards}){
 const panels=[],buttons=[];let current=-1;
 function close(focus=false){const index=current;current=-1;panels.forEach(p=>p.hidden=true);buttons.forEach(b=>b.setAttribute('aria-expanded','false'));if(focus&&index>=0)buttons[index].focus();}
 function position(){if(current<0)return;const panel=panels[current],rect=buttons[current].getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-panel.offsetWidth-8,rect.left))+'px';panel.style.top=Math.max(8,Math.min(innerHeight-panel.offsetHeight-8,navigation.getBoundingClientRect().bottom+10))+'px';}
 for(const [i,card]of cards.entries()){
  const title=card.querySelector('h2').textContent,button=document.createElement('button'),panel=document.createElement('section');button.type='button';button.dataset.inboxMenu=String(i);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','messengerMenu'+i);button.innerHTML=`<svg class="nav-svg" aria-hidden="true"><use href="icons.svg#${i?'message-circle':'sparkles'}"></use></svg><span>${title}</span><svg class="messenger-menu-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;navigation.insertBefore(button,navigation.querySelector('[data-inbox-tab=bulk]'));
  panel.id='messengerMenu'+i;panel.className='messenger-menu-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='messenger-menu-close';dismiss.setAttribute('aria-label','Đóng '+title);dismiss.textContent='×';dismiss.onclick=()=>close(true);panel.append(dismiss,card);document.body.append(panel);panels.push(panel);buttons.push(button);
  button.onclick=()=>{if(current===i)return close(true);close();current=i;panel.hidden=false;button.setAttribute('aria-expanded','true');position();dismiss.focus();};
  panel.addEventListener('click',e=>{if(e.target.closest('.glass-settings-card button'))close();});
 }
 navigation.addEventListener('click',e=>{if(e.target.closest('[data-inbox-tab]'))close();});
 document.addEventListener('pointerdown',e=>{if(current>=0&&!panels[current].contains(e.target)&&!buttons[current].contains(e.target))close();});document.addEventListener('keydown',e=>{if(current>=0&&e.key==='Escape'){e.preventDefault();close(true);}});
 window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
 new MutationObserver(()=>{if(!page.classList.contains('active'))close();}).observe(page,{attributes:true,attributeFilter:['class']});
 return {close};
}
