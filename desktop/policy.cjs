const workspaceOrigin = 'https://mediafbtq-6e1bb.web.app';
const workspaceUrl = workspaceOrigin + '/workspace';
const legacyMetaCallback = 'https://bighappy9xx.github.io/marketing-ai-fbtq/index.html';
const metaHosts = new Set(['www.facebook.com', 'facebook.com', 'm.facebook.com']);

function httpsUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

function workspacePage(input) {
  return httpsUrl(input)?.origin === workspaceOrigin;
}

function metaPage(input) {
  return metaHosts.has(httpsUrl(input)?.hostname);
}

function metaEntry(input) {
  const url = httpsUrl(input);
  if (!url || url.hostname !== 'www.facebook.com' || !/^\/v\d+\.\d+\/dialog\/oauth$/.test(url.pathname)) return false;
  const callback = url.searchParams.get('redirect_uri');
  return callback === legacyMetaCallback || callback === workspaceUrl;
}

function metaReturn(input) {
  const url = httpsUrl(input);
  if (!url || url.origin + url.pathname !== legacyMetaCallback) return null;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!/^[0-9a-f]{64}$/i.test(state || '') || !(code || error) || code?.length > 4000 || error?.length > 100) return null;
  const target = new URL(workspaceUrl);
  target.searchParams.set('state', state);
  if (code) target.searchParams.set('code', code);
  if (error) target.searchParams.set('error', error);
  return target.href;
}

const externalHosts = new Set(['business.facebook.com', 'developers.facebook.com', 'ai.google.dev',
  'aistudio.google.com', 'console.firebase.google.com', 'platform.openai.com', 'www.canva.com']);
function externalPage(input) {
  const url = httpsUrl(input);
  return url?.href === 'https://www.facebook.com/login/' || externalHosts.has(url?.hostname);
}

const identifier = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value);
function notificationPayload(value) {
  if (!value || !identifier(value.owner)) return null;
  if (value.kind === 'announcement') return {kind: value.kind, owner: value.owner};
  if (value.kind === 'inbox' && identifier(value.conversationId)) {
    return {kind: value.kind, owner: value.owner, conversationId: value.conversationId, silent: value.silent === true};
  }
  return null;
}

module.exports = {workspaceUrl, workspacePage, metaPage, metaEntry, metaReturn, externalPage, notificationPayload};
