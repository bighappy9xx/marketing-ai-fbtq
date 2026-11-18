const SCOPES=['pages_show_list','pages_messaging','pages_manage_metadata','pages_read_engagement'];
function metaConfig(env=process.env){
 const appId=env.META_APP_ID||'',redirectUri=env.META_REDIRECT_URI||'',webhookUrl=env.META_WEBHOOK_URL||'',loginConfigId=env.META_LOGIN_CONFIG_ID||'',graphVersion=env.META_GRAPH_VERSION||'v26.0';
 const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}};
 const missing=[];if(!/^\d{5,30}$/.test(appId))missing.push('META_APP_ID');if(!https(redirectUri))missing.push('META_REDIRECT_URI');if(!https(webhookUrl))missing.push('META_WEBHOOK_URL');if(!/^v\d+\.\d+$/.test(graphVersion))missing.push('META_GRAPH_VERSION');if(loginConfigId&&!/^\d{5,30}$/.test(loginConfigId))missing.push('META_LOGIN_CONFIG_ID');
 return {appId,redirectUri,webhookUrl,loginConfigId,graphVersion,scopes:SCOPES,configured:missing.length===0,missing,availableModels:['openai',...(env.META_CHATBOT_GEMINI_ENABLED==='true'?['gemini']:[])]};
}
function loginUrl(config,nonce){
 if(!config.configured)throw Error('Cấu hình Messenger còn thiếu: '+config.missing.join(', '));
 const url=new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
 const params={client_id:config.appId,redirect_uri:config.redirectUri,state:nonce,response_type:'code'};
 if(config.loginConfigId)params.config_id=config.loginConfigId;else params.scope=SCOPES.join(',');
 url.search=new URLSearchParams(params).toString();return url.href;
}
module.exports={metaConfig,loginUrl,SCOPES};
