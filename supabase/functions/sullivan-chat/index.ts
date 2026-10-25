// Supabase Edge Function: AI Jimmy proxy, gated by Jimmy's passcode.
// Passcode check: Supabase secret SULLIVAN_PASSCODE if set, else salted PBKDF2 hash stored in
// sullivan_private.passcode (read via service-role-only RPC public.sullivan_passcode_params()).
// AI brain: set ONE secret XAI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY (optional SULLIVAN_MODEL).
const ALLOWED_ORIGINS = ['https://jamizsullidizle-sketch.github.io', 'http://localhost:8080'];
const env = (k: string) => Deno.env.get(k);

function corsFor(req: Request) {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function pickBrain() {
  const model = env('SULLIVAN_MODEL');
  if (env('XAI_API_KEY')) return { name: 'xai', key: env('XAI_API_KEY')!, model: model || 'grok-3-mini', url: 'https://api.x.ai/v1/chat/completions' };
  if (env('OPENAI_API_KEY')) return { name: 'openai', key: env('OPENAI_API_KEY')!, model: model || 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions' };
  if (env('ANTHROPIC_API_KEY')) return { name: 'anthropic', key: env('ANTHROPIC_API_KEY')!, model: model || 'claude-3-5-haiku-latest', url: 'https://api.anthropic.com/v1/messages' };
  return null;
}

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map(h => parseInt(h, 16)));
function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false; // lengths are fixed (32-byte digests), not secret
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function pbkdf2(pass: string, salt: Uint8Array, iterations: number) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, k, 256));
}
let stored: { salt: string; hash: string; iterations: number } | null = null;
async function loadStored() {
  if (stored) return stored;
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/rpc/sullivan_passcode_params`, { method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: '{}' });
  if (!r.ok) return null;
  const j = await r.json();
  if (j && j.hash) stored = j;
  return stored;
}
async function passcodeOk(given: unknown): Promise<boolean> {
  if (typeof given !== 'string' || !given || given.length > 200) return false;
  const secret = env('SULLIVAN_PASSCODE');
  if (secret) {
    const a = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(given)));
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(secret)));
    return timingSafeEqual(a, b);
  }
  const s = await loadStored();
  if (!s) return false; // fail closed
  return timingSafeEqual(await pbkdf2(given, unhex(s.salt), s.iterations), unhex(s.hash));
}

async function think(p: NonNullable<ReturnType<typeof pickBrain>>, system: unknown, messages: unknown) {
  const msgs = (Array.isArray(messages) ? messages : []).filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-20).map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const sys = String(system || '').slice(0, 8000);
  if (p.name === 'anthropic') {
    const r = await fetch(p.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: p.model, max_tokens: 400, system: sys, messages: msgs }) });
    if (!r.ok) throw new Error('anthropic ' + r.status);
    return (await r.json()).content?.map((c: any) => c.text).join('') ?? '';
  }
  const r = await fetch(p.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + p.key },
    body: JSON.stringify({ model: p.model, max_tokens: 400, temperature: 0.8, messages: [{ role: 'system', content: sys }, ...msgs] }) });
  if (!r.ok) throw new Error(p.name + ' ' + r.status);
  return (await r.json()).choices?.[0]?.message?.content ?? '';
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!(await passcodeOk(body?.passcode))) {
    await new Promise(r => setTimeout(r, 500)); // slow down guessing
    return json({ error: 'wrong passcode' }, 401);
  }
  const brain = pickBrain();
  if (body.action === 'check') return json({ ok: true, brain: !!brain, code: brain ? 'ready' : 'no-brain-yet' });
  if (!brain) return json({ ok: true, brain: false, code: 'no-brain-yet', reply: null });
  try { return json({ ok: true, brain: true, reply: await think(brain, body.system, body.messages) }); }
  catch (e) { return json({ error: String((e as Error).message) }, 502); }
});
