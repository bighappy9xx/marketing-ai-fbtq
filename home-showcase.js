const tabs=[...document.querySelectorAll('[data-tool-tab]')];
const panels=tabs.map(tab=>document.getElementById(tab.hash.slice(1)));
const tablist=document.querySelector('.tool-tabs');

function showTool(index){
  tabs.forEach((tab,i)=>{
    const selected=i===index;
    tab.setAttribute('aria-selected',String(selected));
    tab.tabIndex=selected?0:-1;
    panels[i].hidden=!selected;
  });
}

if(tablist&&panels.length&&panels.every(Boolean)){
  tablist.setAttribute('role','tablist');
  tabs.forEach((tab,i)=>{
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-controls',panels[i].id);
    panels[i].setAttribute('role','tabpanel');
    panels[i].setAttribute('aria-labelledby',tab.id);
    tab.addEventListener('click',event=>{event.preventDefault();showTool(i);});
  });
  tablist.addEventListener('keydown',event=>{
    const selected=tabs.indexOf(event.target);
    if(selected<0)return;
    if(event.key===' '){
      event.preventDefault();
      showTool(selected);
      return;
    }
    const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:step?(selected+step+tabs.length)%tabs.length:-1;
    if(next<0)return;
    event.preventDefault();
    showTool(next);
    tabs[next].focus();
  });
  showTool(Math.max(0,tabs.findIndex(tab=>tab.hash===location.hash)));
}

if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(!isIntersecting)continue;
      target.classList.add('in-view');
      observer.unobserve(target);
    }
  },{threshold:.12});
  document.querySelectorAll('[data-reveal]').forEach(element=>observer.observe(element));
}

const tiltInput=window.matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
document.querySelectorAll('.preview-window,.tool-preview').forEach(card=>{
  const area=card.parentElement;
  let frame=0;

  function reset(){
    cancelAnimationFrame(frame);
    frame=0;
    delete card.dataset.tilting;
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
    card.style.removeProperty('--light-x');
    card.style.removeProperty('--light-y');
  }

  area.addEventListener('pointermove',event=>{
    if(!tiltInput.matches||event.pointerType!=='mouse')return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const {left,top,width,height}=area.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-left)/width));
      const y=Math.max(0,Math.min(1,(event.clientY-top)/height));
      card.dataset.tilting='';
      card.style.setProperty('--tilt-x',`${(0.5-y)*10}deg`);
      card.style.setProperty('--tilt-y',`${(x-0.5)*12}deg`);
      card.style.setProperty('--light-x',`${Math.round(x*100)}%`);
      card.style.setProperty('--light-y',`${Math.round(y*100)}%`);
    });
  });
  area.addEventListener('pointerleave',reset);
  area.addEventListener('pointercancel',reset);
  tiltInput.addEventListener('change',reset);
});
