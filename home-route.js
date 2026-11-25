// Preserve links issued before the workspace moved to its own document.
const {search,hash}=location;
const params=new URLSearchParams(search);
const workspaceLinks=new Set(['#assistant','#creative-studio','#inbox','#analytics','#automation','#content-review','#tasks','#global-resources']);
if(['invite','auth','inbox','code','state','error'].some(key=>params.has(key))||workspaceLinks.has(hash)){
  location.replace('./workspace.html'+search+hash);
}
