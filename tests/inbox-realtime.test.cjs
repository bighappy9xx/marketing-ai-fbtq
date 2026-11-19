const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Messenger avatars and timestamps render without unsafe image URLs',async()=>{
 const mod=await import('data:text/javascript;base64,'+fs.readFileSync(require.resolve('../inbox-realtime.js')).toString('base64'));
 assert.ok(mod.messengerAvatar({senderName:'<Khách>',senderPhotoUrl:'javascript:alert(1)'}).includes('&lt;'));
 assert.ok(!mod.messengerAvatar({senderPhotoUrl:'javascript:alert(1)'}).includes('<img'));
 assert.equal(mod.chatTime({seconds:12}),12000);
});
