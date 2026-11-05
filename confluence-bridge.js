/**
 * Fix it v0.3 – temporary, local-only Confluence Cloud adapter.
 * Start manually: ATLASSIAN_EMAIL=... ATLASSIAN_API_TOKEN=... node confluence-bridge.js
 * No dependencies, listening on 127.0.0.1:38411. Never deploy this as-is.
 */
const http = require('node:http');
const { randomBytes, timingSafeEqual } = require('node:crypto');

const PORT = 38411;
const CONNECTION_CODE = randomBytes(20).toString('hex');
const EMAIL = process.env.ATLASSIAN_EMAIL || '';
const TOKEN = process.env.ATLASSIAN_API_TOKEN || '';
function send(res, status, body) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Fix-It-Key',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(body));
}
function pageFromUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) { throw Error('Invalid Confluence URL.'); }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.atlassian\.net$/i.test(url.hostname)) {
    throw Error('Only https://<workspace>.atlassian.net Confluence Cloud URLs are supported.');
  }
  const match = url.pathname.match(/\/pages\/(\d+)(?:\/|$)/) || url.pathname.match(/\/api\/v2\/pages\/(\d+)(?:\/|$)/);
  const pageId = match ? match[1] : url.searchParams.get('pageId');
  if (!pageId || !/^\d+$/.test(pageId)) throw Error('Confluence page ID not found. Use a full /pages/12345/... link.');
  return { endpoint: `${url.origin}/wiki/api/v2/pages/${pageId}?body-format=storage`, sourceUrl: url.origin + url.pathname + url.search };
}
function sameCode(input) {
  if (typeof input !== 'string' || input.length !== CONNECTION_CODE.length) return false;
  return timingSafeEqual(Buffer.from(input, 'utf8'), Buffer.from(CONNECTION_CODE, 'utf8'));
}
http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || req.url !== '/import') return send(res, 404, { error: 'Not found' });
  if (!sameCode(req.headers['x-fix-it-key'])) return send(res, 403, { error: 'Incorrect bridge connection code.' });
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) return send(res, 413, { error: 'Request too large.' });
    chunks.push(chunk);
  }
  try {
    const { url } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const { endpoint, sourceUrl } = pageFromUrl(url);
    const headers = { Accept: 'application/json' };
    if (EMAIL && TOKEN) headers.Authorization = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
    const upstream = await fetch(endpoint, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if ([401, 403].includes(upstream.status)) throw Error('Confluence access denied. Check the credentials and page permissions.');
    if (!upstream.ok) throw Error('Confluence responded with HTTP ' + upstream.status + '.');
    const data = await upstream.json();
    const html = data?.body?.storage?.value;
    if (typeof html !== 'string' || !html.trim()) throw Error('No readable Confluence storage body returned.');
    if (html.length > 800000) throw Error('Confluence page exceeds 800 KB; please export PDF instead.');
    send(res, 200, { title: data.title || 'Confluence guide', html, url: sourceUrl });
  } catch (e) {
    const message = String(e.message || e);
    send(res, 400, { error: message });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('Fix it local Confluence bridge running at http://127.0.0.1:' + PORT);
  console.log('Connection code (enter in Fix it): ' + CONNECTION_CODE);
  if (!EMAIL || !TOKEN) console.log('No Atlassian credentials set. Only pages available anonymously can be imported.');
  console.log('Press Ctrl+C to stop.');
});
