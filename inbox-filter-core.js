const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().trim();
export const defaultInboxFilters=()=>({query:'',kind:'all',comment:'all',ai:'all',rating:'all',phone:'all',reply:'all',from:'',to:'',source:'all',page:'all',assignee:'all',team:'all',color:'all',unread:'all',ordered:'all',starred:'all'});
export function inboxTimestamp(thread){
 const time=thread.receivedAt||thread.updatedAt||thread.createdAt;
 if(time?.toMillis)return time.toMillis();if(Number.isFinite(time?.seconds))return time.seconds*1000;
 if(Number.isFinite(thread.lastIncomingAtMs))return thread.lastIncomingAtMs;
 if(Number.isFinite(time))return time;const parsed=Date.parse(time);return Number.isFinite(parsed)?parsed:0;
}
export function inboxKind(t){const value=normalized(t.channel||t.type||t.messageType||'messenger');return /comment|binh luan/.test(value)?'comment':/review|rating|danh gia/.test(value)?'review':'message';}
export function inboxSource(t){return String(t.sourceType||t.source||t.channel||'Messenger').trim();}
export function inboxAssignee(t){return String(t.assignedToUid||t.assigneeUid||t.assignedTo?.uid||(typeof t.assignedTo==='string'?t.assignedTo:'')||'');}
export function inboxTeam(t){return String(t.assignedTeamId||t.assignedTeam||t.assignedGroupId||t.teamId||'');}
export function inboxHasPhone(t){const explicit=t.phone||t.detectedPhone||t.phoneNumber||t.customerPhone||t.customer?.phone;if(explicit&&String(explicit).replace(/\D/g,'').length>=8)return true;return /(?:^|[^\d])(?:\+84|0)(?:[\s().-]?\d){8,10}(?!\d)/.test(String(t.message||''));}
export function inboxNeedsReply(t){if(typeof t.needsReply==='boolean')return t.needsReply;if(t.lastOutgoingAtMs&&t.lastIncomingAtMs)return t.lastIncomingAtMs>t.lastOutgoingAtMs;return t.direction==='incoming';}
export function inboxAIState(t,pages=[]){
 if(t.humanPaused||t.forwardedToHuman||inboxAssignee(t))return 'forwarded';
 if(t.aiProcessing===true||['processing','pending'].includes(t.aiStatus)||t.botStatus==='processing')return 'processing';
 const mode=t.botMode||pages.find(p=>p.pageId===t.pageId)?.mode;
 if(mode==='off'||t.aiEnabled===false||t.aiStatus==='off')return 'off';return 'unknown';
}
function day(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const ms=Date.parse(value+'T00:00:00+07:00');return Number.isFinite(ms)&&new Date(ms+7*3600000).toISOString().slice(0,10)===value?ms:null;}
export function validInboxDates(from,to){return (!from||day(from)!==null)&&(!to||day(to)!==null)&&(!from||!to||from<=to);}
export function filterInboxThreads(threads,filters,{uid='',pages=[]}={}){
 const f={...defaultInboxFilters(),...filters},query=normalized(f.query),from=day(f.from),to=day(f.to);
 if(!validInboxDates(f.from,f.to))return [];
 return threads.filter(t=>{
  if(query&&!normalized([t.senderName,t.senderId,t.pageName,t.message,t.messageSearchText,t.phone,t.detectedPhone,t.customerPhone].join(' ')).includes(query))return false;
  if(f.color!=='all'&&(f.color==='none'?!!t.tagColor:t.tagColor!==f.color))return false;
  if(f.unread!=='all'&&(f.unread==='yes'?t.unread!==true:t.unread!==false))return false;
  if(f.ordered!=='all'&&!!(t.orderCreated||t.orderId||t.orderIds?.length)!==(f.ordered==='yes'))return false;
  if(f.starred!=='all'&&(t.starred===true)!==(f.starred==='yes'))return false;
  if(f.kind!=='all'&&inboxKind(t)!==f.kind)return false;
  if(f.comment!=='all'){
   if(inboxKind(t)!=='comment')return false;
   const live=t.isLivestream===true||/live/.test(normalized(inboxSource(t)));
   if(f.comment==='no_private'&&!(t.privateReplied===false||t.hasPrivateReply===false))return false;
   if(f.comment==='ordered'&&!t.orderId&&!t.orderCreated&&!t.orderIds?.length)return false;
   if(f.comment==='livestream'&&!live||f.comment==='not_livestream'&&live)return false;
  }
  if(f.ai!=='all'&&(inboxKind(t)!=='message'||inboxAIState(t,pages)!==f.ai))return false;
  const rating=Number(t.rating??t.reviewRating??t.customerRating),hasRating=rating>=1&&rating<=5;
  if(f.rating==='rated'&&!hasRating||f.rating==='unrated'&&hasRating)return false;
  if(/^\d$/.test(f.rating)&&rating!==Number(f.rating))return false;
  if(f.phone==='yes'&&!inboxHasPhone(t)||f.phone==='no'&&inboxHasPhone(t))return false;
  if(['unanswered','oldest','read_unanswered'].includes(f.reply)&&!inboxNeedsReply(t))return false;
  if(f.reply==='read_unanswered'&&t.unread!==false)return false;
  const stamp=inboxTimestamp(t);if(from!==null&&stamp<from||to!==null&&stamp>=to+86400000)return false;
  if(f.source!=='all'&&inboxSource(t)!==f.source||f.page!=='all'&&t.pageId!==f.page)return false;
  const assignee=inboxAssignee(t),target=f.assignee==='me'?uid:f.assignee;
  if(f.assignee==='unassigned'?!!assignee:f.assignee!=='all'&&assignee!==target)return false;
  if(f.team!=='all'&&inboxTeam(t)!==f.team)return false;
  return true;
 }).slice().sort((a,b)=>f.reply==='oldest'?inboxTimestamp(a)-inboxTimestamp(b):inboxTimestamp(b)-inboxTimestamp(a));
}
export function expandedInboxURL(href){const url=new URL(href);url.search='';url.searchParams.set('inbox','expanded');url.hash='inbox';return url.href;}

export function enrichInboxThreads(threads,messages){const history=new Map();for(const m of messages||[]){if(!m.conversationId)continue;let row=history.get(m.conversationId);if(!row)history.set(m.conversationId,row={text:[],phone:''});row.text.push(m.message||'');if(m.direction==='incoming'){const phone=String(m.message||'').match(/(?:^|[^\d])((?:\+84|0)(?:[\s().-]?\d){8,10})(?!\d)/);if(phone)row.phone=phone[1];}}return threads.map(t=>{const h=history.get(t.conversationId||t.id);return h?{...t,messageSearchText:h.text.join(' '),detectedPhone:h.phone}:t;});}
