const defaultAccent = '#3978F6';
const defaults = {mode:'light', accent:defaultAccent, tint:55, layout:'bento'};
const modes = ['light','dark','system'];

function normalizeAppearance(saved = {}) {
  return {
    mode: modes.includes(saved.mode) ? saved.mode : defaults.mode,
    layout: saved.layout==='glass'?'glass':defaults.layout,
    accent: /^#[\da-f]{6}$/i.test(saved.accent) ? saved.accent.toUpperCase() : defaults.accent,
    tint: Number.isFinite(saved.tint) ? Math.min(100, Math.max(0, Math.round(saved.tint))) : defaults.tint
  };
}

const rgb = hex => hex.slice(1).match(/../g).map(value => parseInt(value,16));
function luminance(channels) {
  return channels.map(value => {
    const v = value/255;
    return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
  }).reduce((sum,value,i) => sum + value*[.2126,.7152,.0722][i],0);
}

function accessibleAccent(channels, dark, limit = dark ? .57 : .115) {
  const target = dark ? 255 : 0;
  for (let amount=0; amount<=100; amount+=2) {
    const color=channels.map(value=>Math.round(value+(target-value)*amount/100));
    if (dark ? luminance(color)>=limit : luminance(color)<=limit) return color.join(' ');
  }
  return dark ? '255 255 255' : '0 0 0';
}

export function initWorkspaceAppearance({document, storage, system}) {
  const keyFor = uid => 'fbtq_appearance_v1_'+(uid||'guest');
  let key=keyFor('');
  let preferences={...defaults};
  const pick=document.querySelector('#themeCustomAccent');
  const tint=document.querySelector('#themeGlassTint');
  const accentButtons=[...document.querySelectorAll('[data-theme-accent]')];
  const modeButtons=[...document.querySelectorAll('[data-theme-choice]')];
  const layoutButtons=[...document.querySelectorAll('[data-workspace-layout]')];
  const toggle=document.querySelector('#themeToggle');

  function render(){
    const dark=preferences.mode==='dark'||preferences.mode==='system'&&system.matches;
    const channels=rgb(preferences.accent);
    const {body}=document;
    body.classList.toggle('dark',dark);
    body.dataset.workspaceLayout=preferences.layout;
    for(const button of layoutButtons){
      button.setAttribute('aria-pressed',String(button.dataset.workspaceLayout===preferences.layout));
    }
    body.style.setProperty('--glass-accent',channels.join(' '));
    body.style.setProperty('--glass-accent-fill',accessibleAccent(channels,false));
    body.style.setProperty('--glass-accent-ink',accessibleAccent(channels,dark));
    const loginBlue=preferences.accent===defaultAccent;
    body.style.setProperty('--nav-gradient-light',accessibleAccent(loginBlue?[67,142,255]:channels,false,.165));
    body.style.setProperty('--nav-gradient-deep',loginBlue?'33 96 232':accessibleAccent(channels,false));
    body.style.setProperty('--glass-opacity',String(.78+preferences.tint*.0022));
    body.style.setProperty('--glass-tint',String(.035+preferences.tint*.00155));
    pick.value=preferences.accent;
    tint.value=preferences.tint;
    document.querySelector('#themeAccentValue').textContent=preferences.accent;
    document.querySelector('#themeTintValue').textContent=preferences.tint+'%';
    for(const button of modeButtons){
      const selected=button.dataset.themeChoice===preferences.mode;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
    }
    for(const button of accentButtons)button.setAttribute('aria-pressed',String(button.dataset.themeAccent===preferences.accent));
    toggle.setAttribute('aria-pressed',String(dark));
    toggle.setAttribute('aria-label',dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#131923':'#f1f5fc');
  }

  function set(change,persist=true){
    preferences=normalizeAppearance({...preferences,...change});
    render();
    if(persist)try{storage.setItem(key,JSON.stringify(preferences));}catch{}
  }

  for(const button of modeButtons)button.onclick=()=>set({mode:button.dataset.themeChoice});
  for(const button of layoutButtons)button.onclick=()=>set({layout:button.dataset.workspaceLayout});
  for(const button of accentButtons)button.onclick=()=>set({accent:button.dataset.themeAccent});
  toggle.onclick=()=>set({mode:document.body.classList.contains('dark')?'light':'dark'});
  for(const [input,name,value] of [[pick,'accent',()=>pick.value],[tint,'tint',()=>Number(tint.value)]]){
    input.addEventListener('input',()=>set({[name]:value()},false));
    input.addEventListener('change',()=>set({[name]:value()}));
  }
  document.querySelector('#resetAppearance').onclick=()=>set(defaults);
  system.addEventListener('change',()=>{if(preferences.mode==='system')render();});
  render();

  return {useAccount(uid,legacyMode){
    key=keyFor(uid);
    let saved;
    try{saved=JSON.parse(storage.getItem(key)||'null');}catch{}
    preferences=normalizeAppearance(saved||{mode:legacyMode});
    render();
  }};
}
