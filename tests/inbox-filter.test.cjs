const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const core=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'../inbox-filter-core.js')).toString('base64'));
 const {filterInboxThreads:filter,validInboxDates,inboxAIState,expandedInboxURL}=core;
 const rows=[
  {id:'m1',senderName:'Đặng Ánh',channel:'Messenger',pageId:'p1',message:'Gọi 0901 234 567',receivedAt:'2026-11-17T00:00:00+07:00',aiProcessing:true,direction:'incoming',unread:false,assignedTeamId:'sales'},
  {id:'m2',channel:'Messenger',pageId:'p2',receivedAt:'2026-11-17T23:59:59+07:00',humanPaused:true,assignedToUid:'u1',phone:'0912223333',needsReply:true,unread:true},
  {id:'m3',channel:'Messenger',pageId:'p1',receivedAt:'2026-11-18T00:00:00+07:00',aiStatus:'off',lastIncomingAtMs:4,lastOutgoingAtMs:5},
  {id:'c1',channel:'comment',source:'livestream',pageId:'p1',receivedAt:{seconds:1794848400},privateReplied:false,orderId:'order-1',rating:5},
  {id:'c2',channel:'comment',source:'post',privateReplied:true,receivedAt:'2026-11-15',assignedTo:{uid:'u2'},assignedTeamId:'support'},
  {id:'r1',channel:'review',rating:2,receivedAt:'2026-11-14'},
 ];
 const ids=f=>filter(rows,f,{uid:'u1'}).map(t=>t.id).sort();
 assert.deepEqual(ids({query:'dang anh'}),['m1']);
 assert.deepEqual(ids({kind:'comment'}),['c1','c2']);
 assert.deepEqual(ids({comment:'no_private'}),['c1']);assert.equal(filter([{channel:'comment'}],{comment:'no_private'}).length,0);
 assert.deepEqual(ids({comment:'ordered'}),['c1']);
 assert.deepEqual(ids({comment:'livestream'}),['c1']);
 assert.deepEqual(ids({comment:'not_livestream'}),['c2']);
 assert.deepEqual(ids({ai:'processing'}),['m1']);
 assert.deepEqual(ids({ai:'forwarded'}),['m2']);
 assert.deepEqual(ids({ai:'off'}),['m3']);
 assert.equal(inboxAIState({model:'gemini',pageId:'p'},[{pageId:'p',mode:'ai'}]),'unknown');
 assert.equal(inboxAIState({pageId:'p'},[{pageId:'p',mode:'off'}]),'off');
 assert.deepEqual(ids({phone:'yes'}),['m1','m2']);
 assert.deepEqual(ids({phone:'yes',assignee:'me'}),['m2']);
 assert.deepEqual(ids({phone:'no',kind:'message'}),['m3']);
 assert.deepEqual(ids({rating:'5'}),['c1']);
 assert.deepEqual(ids({rating:'rated'}),['c1','r1']);
 assert.deepEqual(ids({reply:'read_unanswered'}),['m1']);
 assert.deepEqual(filter(rows,{reply:'oldest'}).map(t=>t.id),['m1','m2']);
 assert.deepEqual(ids({source:'post',assignee:'u2',team:'support'}),['c2']);
 assert.deepEqual(ids({page:'p1',kind:'message',from:'2026-11-17',to:'2026-11-17'}),['m1']);
 assert.deepEqual(ids({kind:'message',from:'2026-11-17',to:'2026-11-17'}),['m1','m2']);
 assert.equal(validInboxDates('2026-02-30',''),false);
 assert.equal(validInboxDates('2026-11-18','2026-11-17'),false);
 assert.deepEqual(ids({from:'bad'}),[]);
 const before=JSON.stringify(rows);filter(rows,{});assert.equal(JSON.stringify(rows),before);
 assert.equal(expandedInboxURL('https://example.test/app/?code=secret&state=token#settings'),'https://example.test/app/?inbox=expanded#inbox');
 console.log('PASS inbox filter combinations, channel/AI metadata, phone, dates, reply order, assignment, search and safe expanded URL.');
})().catch(e=>{console.error(e);process.exitCode=1;});
