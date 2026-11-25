const {test} = require('node:test');
const assert = require('node:assert/strict');
const {validateExpressVpnUrl, requestExpressVpnConnection} = require('./express-vpn.cjs');

test('ExpressVPN configuration accepts only a local, authenticated MCP URL', () => {
  const valid = 'http://127.0.0.1:20090/mcp?token=example';
  assert.equal(validateExpressVpnUrl(valid)?.href, valid);
  for (const invalid of [
    'https://127.0.0.1:20090/mcp?token=example',
    'http://example.com:20090/mcp?token=example',
    'http://127.0.0.1:20090/other?token=example',
    'http://127.0.0.1:20090/mcp?token=a&token=b',
    'http://127.0.0.1:20090/mcp?token=',
    'http://127.0.0.1:20090/mcp?token=example#fragment'
  ]) assert.equal(validateExpressVpnUrl(invalid), null);
});

test('the local MCP session requests only the configured ExpressVPN connection', async context => {
  let called = false;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'http://127.0.0.1:20090/mcp?token=example');
    assert.equal(options.redirect, 'error');
    if (options.method === 'GET') return new Response(null, {status: 405});
    const message = JSON.parse(options.body);
    if (message.id === undefined) return new Response(null, {status: 202});
    let result;
    if (message.method === 'initialize') {
      result = {protocolVersion: message.params.protocolVersion, capabilities: {tools: {}},
        serverInfo: {name: 'expressvpn-test', version: '1'}};
    } else {
      assert.equal(message.method, 'tools/call');
      assert.deepEqual(message.params, {name: 'expressvpn_connect', arguments: {}});
      result = {content: [{type: 'text', text: 'Connection requested'}]};
      called = true;
    }
    return Response.json({jsonrpc: '2.0', id: message.id, result});
  });
  const endpoint = validateExpressVpnUrl('http://127.0.0.1:20090/mcp?token=example');
  assert.equal(await requestExpressVpnConnection(endpoint), 'requested');
  assert.equal(called, true);
});
