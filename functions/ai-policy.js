// Server-owned choices: clients cannot select an arbitrary model or token budget.
const tasks={
 content:{env:'CONTENT_OPENAI_MODEL',maxTokens:1000,effort:'none'},
 assistant:{env:'ASSISTANT_OPENAI_MODEL',maxTokens:1000,effort:'none'},
 reply:{env:'REPLY_OPENAI_MODEL',maxTokens:300,effort:'none'},
 review:{env:'CONTENT_REVIEW_OPENAI_MODEL',maxTokens:5000,effort:'low'},
 highlights:{env:'STUDIO_HIGHLIGHTS_OPENAI_MODEL',maxTokens:6000,effort:'low'},
 check:{env:'OPENAI_MODEL',maxTokens:64,effort:'none'}
};
function textPolicy(task='content'){
 const p=tasks[task]||tasks.content;
 return {model:process.env[p.env]||process.env.OPENAI_MODEL||'gpt-6-luna',maxTokens:p.maxTokens,effort:p.effort};
}
function publicPolicy(){return Object.fromEntries(Object.keys(tasks).map(task=>[task,textPolicy(task)]));}
function requireAIAccount(auth,HttpsError){if(!auth?.uid||auth.profile?.approved!==true||!['employee','department_manager','branch_manager','director','accountant'].includes(auth.profile?.role))throw new HttpsError('permission-denied','Tài khoản chưa được duyệt hoặc chưa được cấp quyền AI.');}
module.exports={textPolicy,publicPolicy,requireAIAccount};
