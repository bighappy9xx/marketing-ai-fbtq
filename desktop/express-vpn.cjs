const {Client} = require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

function validateExpressVpnUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) return null;
  try {
    const endpoint = new URL(input.trim());
    if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' ||
        !endpoint.port || endpoint.pathname !== '/mcp' || endpoint.username ||
        endpoint.password || endpoint.hash) return null;
    const entries = [...endpoint.searchParams];
    if (entries.length !== 1 || entries[0][0] !== 'token' || !entries[0][1].trim()) return null;
    return endpoint;
  } catch {
    return null;
  }
}

async function requestExpressVpnConnection(endpoint) {
  const transport = new StreamableHTTPClientTransport(endpoint, {
    fetch: (url, options) => fetch(url, {...options, redirect: 'error'})
  });
  const client = new Client({name: 'fbtq-workspace', version: '1'});
  try {
    await client.connect(transport, {timeout: 5000});
    const result = await client.callTool({name: 'expressvpn_connect', arguments: {}}, undefined, {timeout: 25000});
    return result.isError ? 'failed' : 'requested';
  } catch {
    return 'failed';
  } finally {
    await transport.close().catch(() => {});
  }
}

module.exports = {validateExpressVpnUrl, requestExpressVpnConnection};
