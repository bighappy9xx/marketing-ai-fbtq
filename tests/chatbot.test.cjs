const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module');
const core=require('../functions/chatbot-core');
test('standard window, future timestamps, opt out, handoff and keyword priority',()=>{
 const now=100000000;assert.equal(core.eligible({lastIncomingAtMs:now-86399999},now),true);assert.equal(core.eligible({lastIncomingAtMs:now-86400000},now),false);assert.equal(core.eligible({lastIncomingAtMs:now+1},now),false);assert.equal(core.eligible({lastIncomingAtMs:now,optedOut:true},now),false);assert.equal(core.eligible({lastIncomingAtMs:now,humanPaused:true},now),false);assert.ok(core.isOptOut('HỦY ĐĂNG KÝ'));assert.equal(core.isOptOut('tôi muốn báo giá'),false);
 const config=core.settings({mode:'hybrid',scripts:[{title:'Giá',keywords:'giá, bao gia',text:'Liên hệ nhân viên'}]});assert.equal(core.pickScript('Báo giá giúp tôi',config.scripts).text,'Liên hệ nhân viên');assert.equal(core.pickScript('xin chào',config.scripts),undefined);assert.throws(()=>core.settings({mode:'invalid'}));
});
test('server checks owner, window, once-only sending, and refuses an expired OAuth session',async()=>{
 const records=new Map(),now=Date.now(),uid='user',pageId='123456',recipient='111';let sends=0,lastSentText;
 const page={pageId,ownerUid:uid,pageName:'Test',active:true,mode:'script',scripts:[{keywords:['gia'],text:'Nhân viên sẽ tư vấn'}]};records.set(`workspaces/fbtq/pages/${pageId}`,page);records.set(`workspaces/fbtq/inbox/${core.key(pageId,recipient)}`,{lastIncomingAtMs:now});
 const ref=path=>({id:path.split('/').at(-1),get:async()=>({exists:records.has(path),data:()=>records.get(path)}),create:async data=>{if(records.has(path))throw Error('exists');records.set(path,data);},set:async data=>records.set(path,{...records.get(path),...data}),update:async data=>records.set(path,{...records.get(path),...data}),delete:async()=>records.delete(path)});
 const db={doc:ref,collection:path=>({doc:id=>ref(path+'/'+id)}),runTransaction:async fn=>fn({get:r=>r.get(),update:(r,d)=>r.update(d),set:(r,d)=>r.set(d)})};
 const load=Module._load;Module._load=function(id,...args){if(id==='firebase-functions/v2/scheduler')return {onSchedule:(_,fn)=>fn};if(id==='firebase-functions/v2/firestore')return {onDocumentCreated:(_,fn)=>fn,onDocumentUpdated:(_,fn)=>fn};return load.call(this,id,...args);};
 let api;try{api=require('../functions/chatbot').registerChatbot({db,onCall:(_,fn)=>fn,HttpsError:class extends Error{constructor(c,m){super(m);this.code=c;}},FieldValue:{serverTimestamp:()=>now},requireSignedIn:async r=>({uid:r.auth.uid,profile:{approved:r.approved!==false,role:'employee'}}),encryptToken:()=>({}),decryptToken:()=>'',graphUrl:p=>'https://graph.test/'+p,META_TOKEN_ENCRYPTION_KEY:{value:()=>''},META_APP_SECRET:{value:()=>''}});}finally{Module._load=load;}
 const previous=global.fetch;global.fetch=async(_,options)=>{sends++;if(typeof options?.body==='string')lastSentText=JSON.parse(options.body).message?.text;return {ok:true,json:async()=>({message_id:'sent'})};};
 const request=(extra={})=>({auth:{uid},data:{pageId,recipientId:recipient,message:'Xin chào',requestId:'1234567890abcdef',...extra}});
 try{await api.setMessengerPageColor(request({color:'#1a2b3c'}));assert.equal(records.get(`workspaces/fbtq/pages/${pageId}`).inboxColor,'#1A2B3C');await assert.rejects(api.setMessengerPageColor(request({color:'url(evil)'})),/Màu/);await assert.rejects(api.setMessengerPageColor({...request({color:'#ffffff'}),auth:{uid:'other'}}),/không thuộc/);await api.setMessengerPageColor(request({color:''}));assert.equal(records.get(`workspaces/fbtq/pages/${pageId}`).inboxColor,'');await assert.rejects(api.getChatbotSetup({...request(),approved:false}),e=>e.code==='permission-denied');await assert.rejects(api.sendChatbotMessage({...request(),auth:{uid:'other'}}),/không thuộc/);assert.equal(sends,0);await api.sendChatbotMessage(request());assert.equal(sends,1);await assert.rejects(api.sendChatbotMessage(request()),/đã xử lý/);assert.equal(sends,1);records.set(`workspaces/fbtq/inbox/${core.key(pageId,recipient)}`,{lastIncomingAtMs:now-90000000});await assert.rejects(api.sendChatbotMessage(request({requestId:'different123456789'})),/24 giờ/);assert.equal(sends,1);records.set(`workspaces/fbtq/inbox/${core.key(pageId,recipient)}`,{lastIncomingAtMs:Date.now(),lastIncomingMessageId:'incoming-1'});const incoming={data:{data:()=>({direction:'incoming',pageId,senderId:recipient,conversationId:core.key(pageId,recipient),message:'giá'})},params:{messageId:'incoming-1'}};await api.autoReplyFacebook(incoming);assert.equal(sends,2);await api.autoReplyFacebook(incoming);assert.equal(sends,2);
 const imported={...incoming,params:{messageId:'history-import'},data:{data:()=>({...incoming.data.data(),historical:true,source:'meta_history'})}};await api.autoReplyFacebook(imported);assert.equal(sends,2);assert.equal(records.has('chatbotJobs/auto_history-import'),false);
 const threadId=core.key(pageId,recipient);records.set(`workspaces/fbtq/inbox/${threadId}`,{ownerUid:uid,pageId,lastIncomingAtMs:Date.now(),lastIncomingMessageId:'incoming-image'});await api.setMessengerThreadColor(request({threadId,color:'green'}));assert.equal(records.get(`workspaces/fbtq/inbox/${threadId}`).tagColor,'green');await assert.rejects(api.setMessengerThreadColor(request({threadId,color:'url(evil)'})),/Màu/);await assert.rejects(api.setMessengerThreadColor({...request({threadId,color:'red'}),auth:{uid:'other'}}),/không thuộc/);
 const jpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,1,2,3,255,217]).toString('base64');records.get(`workspaces/fbtq/pages/${pageId}`).scripts=[{keywords:['gia'],text:'Nội dung và hình ảnh',image:jpeg,imagePreview:jpeg}];await api.autoReplyFacebook({...incoming,params:{messageId:'incoming-image'}});assert.equal(sends,4);const validated=core.settings({mode:'script',scripts:[{title:'Ảnh và chữ',keywords:'giá',text:'Nội dung',image:jpeg,imagePreview:jpeg}]});assert.equal(validated.scripts[0].image,jpeg);assert.throws(()=>core.settings({mode:'script',scripts:[{image:'javascript:alert(1)'}]}));
 const legacy=records.get(`workspaces/fbtq/pages/${pageId}`).scripts;
 const faqs=[{question:'Cửa hàng mở cửa lúc mấy giờ?',answer:'Từ 8 giờ đến 17 giờ.',enabled:true},{question:'Có chỗ đỗ xe không?',answer:'Có chỗ đỗ xe.',enabled:false}];
 await api.savePageChatbot(request({mode:'off',model:'openai',faqs,faqRevision:0}));
 const faqConfig=await api.getPageChatbot(request({includeFaqs:true}));
 assert.deepEqual(faqConfig.faqs,faqs);assert.equal(faqConfig.faqRevision,1);
 assert.equal((await api.getPageChatbot(request())).faqs,undefined);
 await assert.rejects(api.getPageChatbot({...request({includeFaqs:true}),auth:{uid:'other'}}),e=>e.code==='permission-denied');
 await assert.rejects(api.savePageChatbot(request({mode:'off',faqs:[],faqRevision:0})),e=>e.code==='aborted');
 await api.savePageChatbot(request({mode:'off',instructions:'Cập nhật riêng lời chào'}));
 assert.deepEqual((await api.getPageChatbot(request({includeFaqs:true}))).faqs,faqs);
 const {relevantFaqs,replyInstructions}=require('../functions/chatbot-faq');
 const hidden={question:faqs[0].question,answer:'Không dùng',enabled:false};
 const matching=relevantFaqs([...faqs,hidden],'Cho mình hỏi cửa hàng mở cửa mấy giờ vậy?');
 assert.equal(matching.length,1);assert.match(replyInstructions(page,matching),/8 giờ đến 17 giờ/);
 assert.deepEqual(relevantFaqs(faqs,'Cảm ơn bạn'),[]);
 assert.deepEqual((await api.getPageChatbot(request({includeFaqReplies:true}))).faqReplies,[{title:faqs[0].question,text:faqs[0].answer}]);
 assert.deepEqual(records.get(`workspaces/fbtq/pages/${pageId}`).scripts,legacy);
 await api.savePageChatbot(request({mode:'script'}));
 const deliver=async(id,message)=>{
   Object.assign(records.get(`workspaces/fbtq/inbox/${threadId}`),{lastIncomingMessageId:id,direction:'incoming'});
   await api.autoReplyFacebook({params:{messageId:id},data:{data:()=>({...incoming.data.data(),message})}});
 };
 await deliver('faq-match','  CUA HANG MO CUA LUC MAY GIO !! ');
 assert.equal(sends,5);assert.equal(lastSentText,faqs[0].answer);
 await deliver('faq-disabled',faqs[1].question);assert.equal(sends,5);
 await deliver('faq-unrelated','Cảm ơn bạn');assert.equal(sends,5);
 Object.assign(records.get(`workspaces/fbtq/inbox/${threadId}`),{lastIncomingMessageId:'promoted',direction:'incoming'});
 const promotion={params:{messageId:'promoted'},data:{
   before:{data:()=>({source:'meta_history',historical:true})},
   after:{data:()=>({...incoming.data.data(),source:'meta_webhook',historical:false,message:faqs[0].question})}
 }};
 await api.autoReplyFacebookPromoted(promotion);assert.equal(sends,6);
 await api.autoReplyFacebookPromoted(promotion);assert.equal(sends,6);


 await assert.rejects(api.finishFacebookLogin({auth:{uid},data:{state:'a'.repeat(64),code:'x'}}),/hết hạn/);}finally{global.fetch=previous;}
});
