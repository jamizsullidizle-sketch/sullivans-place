// Local dev server: serves the PWA + /api/chat proxy. Run: node server.js  (PORT=8080)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { pickProvider, chat } from './lib/providers.mjs';
import crypto from 'node:crypto';
const passOk = g => { const s = process.env.SULLIVAN_PASSCODE; if (!s || typeof g !== 'string') return false;
  const h = x => crypto.createHash('sha256').update(x).digest(); return crypto.timingSafeEqual(h(g), h(s)); };
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const provider = pickProvider(process.env);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/chat') {
    res.setHeader('content-type', 'application/json');
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('{}'); }
    let body = ''; for await (const c of req) { body += c; if (body.length > 200000) break; }
    let b; try { b = JSON.parse(body); } catch { res.statusCode = 400; return res.end('{}'); }
    if (!passOk(b.passcode)) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'wrong passcode' })); }
    if (b.action === 'check') return res.end(JSON.stringify({ ok: true, brain: !!provider, code: provider ? 'ready' : 'no-brain-yet' }));
    if (!provider) return res.end(JSON.stringify({ ok: true, brain: false, code: 'no-brain-yet', reply: null }));
    try { res.end(JSON.stringify({ ok: true, brain: true, reply: await chat(provider, b.system, b.messages) })); }
    catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }
  let f = path.normalize(path.join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!f.startsWith(root) || f.includes(`${path.sep}lib${path.sep}`) || f.endsWith('server.js')) { res.statusCode = 404; return res.end(); }
  fs.readFile(f, (err, data) => { if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(data); });
}).listen(process.env.PORT || 8080, () => console.log(`Sullivan's Place on :${process.env.PORT || 8080} — AI: ${provider ? provider.name : 'none (demo mode)'}`));
