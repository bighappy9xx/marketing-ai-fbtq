const {test} = require('node:test');
const assert = require('node:assert/strict');
const {workspaceUrl, workspacePage, metaEntry, metaReturn, externalPage, notificationPayload} = require('./policy.cjs');

test('desktop bridge trusts the exact HTTPS workspace origin', () => {
  assert.equal(workspacePage(workspaceUrl + '#inbox'), true);
  for (const url of [
    'http://mediafbtq-6e1bb.web.app/workspace',
    'https://mediafbtq-6e1bb.web.app.example.org',
    'https://mediafbtq-6e1bb.web.app@evil.example',
    'file:///tmp/workspace.html'
  ]) assert.equal(workspacePage(url), false);
  assert.equal(externalPage('https://developers.facebook.com/docs/'), true);
  assert.equal(externalPage('javascript:void(0)'), false);
});

test('the configured Meta callback returns to the workspace origin with the login state', () => {
  const legacy = 'https://bighappy9xx.github.io/marketing-ai-fbtq/index.html';
  const authorization = 'https://www.facebook.com/v26.0/dialog/oauth?redirect_uri=';
  assert.equal(metaEntry(authorization + encodeURIComponent(legacy)), true);
  assert.equal(metaEntry(authorization + encodeURIComponent(legacy + '/different')), false);
  const state = 'a'.repeat(64);
  const params = '?state=' + state + '&code=good%2Bcode&unused=123';
  assert.equal(metaReturn(legacy + params), workspaceUrl + '?state=' + state + '&code=good%2Bcode');
  assert.equal(metaReturn(legacy + '?state=' + state + '&error=access_denied'), workspaceUrl + '?state=' + state + '&error=access_denied');
  assert.equal(metaReturn(legacy + '?state=bad&code=123'), null);
  assert.equal(metaReturn('https://other.example/index.html' + params), null);
});

test('notification requests can open only supported actions for the intended session', () => {
  const valid = {kind: 'inbox', owner: 'user123', conversationId: 'thread-123', silent: true};
  assert.deepEqual(notificationPayload({...valid, url: 'file:///tmp/private'}), valid);
  assert.deepEqual(notificationPayload({kind: 'announcement', owner: 'user123'}), {kind: 'announcement', owner: 'user123'});
  for (const invalid of [{...valid, owner: ''}, {...valid, conversationId: '../other'}, {...valid, kind: 'url'}]) {
    assert.equal(notificationPayload(invalid), null);
  }
});
