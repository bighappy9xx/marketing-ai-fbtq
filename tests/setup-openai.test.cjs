const {test}=require('node:test'),assert=require('node:assert/strict'),{PassThrough,Writable}=require('node:stream'),{EventEmitter}=require('node:events');
const {validKey,readHiddenKey,checkKey,run,FUNCTIONS}=require('../scripts/setup-openai.cjs');
const fakeKey='sk-proj-'+'testOnlyNotAnActualCredential'.repeat(2);
function terminal(){let text='';const input=new PassThrough();input.isTTY=true;input.setRawMode=()=>{};const output=new Writable({write(chunk,_encoding,next){text+=chunk.toString();next();}});output.isTTY=true;output.columns=80;return{input,output,get text(){return text;}};}
test('installer rejects empty/misplaced keys and covers exactly the OpenAI deployment group',()=>{
 for(const value of ['',undefined,'OPENAI_API_KEY','SK_PROJ_PUBLIC_SECRET_NAME','sk-short','firebase functions:secrets:set key'])assert.equal(validKey(value),false);
 assert.equal(validKey(fakeKey),true);assert.equal(FUNCTIONS.length,9);assert.ok(FUNCTIONS.includes('reviewContentAI'));assert.ok(!FUNCTIONS.includes('autoReplyFacebook'));
});
test('Terminal input is hidden and Ctrl+C never returns a key',async()=>{
 const t=terminal(),pending=readHiddenKey(t.input,t.output);t.input.write(fakeKey+'\r');assert.equal(await pending,fakeKey);assert.ok(t.text.includes('nội dung được ẩn'));assert.ok(!t.text.includes(fakeKey));assert.ok(!t.text.includes('testOnly'));
 const cancelled=terminal(),p=readHiddenKey(cancelled.input,cancelled.output);cancelled.input.write('sk-partial\u0003');await assert.rejects(p,/hủy/);assert.ok(!cancelled.text.includes('partial'));
 await assert.rejects(readHiddenKey(new PassThrough(),t.output),/Terminal/);
});
test('Firebase receives a fixed secret name and key on stdin only; debug logging is disabled',async()=>{
 let invocation,stdin='';
 const spawnImpl=(command,args,options)=>{invocation={command,args,options};const child=new EventEmitter();child.stdin=new Writable({write(chunk,_encoding,next){stdin+=chunk.toString();next();}});child.stdin.once('finish',()=>queueMicrotask(()=>child.emit('exit',0)));return child;};
 const args=['functions:secrets:set','OPENAI_API_KEY','--data-file','-','--non-interactive'];
 await run('firebase',args,{env:{PATH:'/bin',DEBUG:'*',FIREBASE_DEBUG_MODE:'true',OPENAI_API_KEY:fakeKey},secret:fakeKey,spawnImpl});
 assert.equal(stdin,fakeKey);assert.equal(invocation.options.shell,false);assert.equal(invocation.options.stdio[0],'pipe');assert.equal(invocation.options.env.FIREBASE_DEBUG_PATH,'/dev/null');assert.equal(invocation.options.env.DEBUG,undefined);assert.equal(invocation.options.env.OPENAI_API_KEY,undefined);assert.ok(!JSON.stringify(invocation).includes(fakeKey));assert.equal(invocation.args[1],'OPENAI_API_KEY');
});
test('key check makes a single bounded request and never exposes provider errors',async()=>{
 let captured,calls=0;await checkKey(fakeKey,async(url,opts)=>{calls++;captured={url,opts};return{ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'OK'}]}]})};});
 assert.equal(calls,1);assert.equal(captured.opts.headers.Authorization,'Bearer '+fakeKey);assert.equal(JSON.parse(captured.opts.body).max_output_tokens,64);assert.equal(JSON.parse(captured.opts.body).store,false);
 for(const status of [401,403,404,429,500])await assert.rejects(checkKey(fakeKey,async()=>({ok:false,status,json:async()=>({error:{message:fakeKey}})})),error=>!error.message.includes(fakeKey));
 await assert.rejects(checkKey(fakeKey,async()=>({ok:true,json:async()=>({status:'incomplete'})})),/hoàn chỉnh/);
});
