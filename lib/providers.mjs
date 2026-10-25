// Shared, pluggable LLM call. Picks whichever key is present.
// Supported env vars: XAI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY (+ optional SULLIVAN_MODEL)
export function pickProvider(env) {
  if (env.XAI_API_KEY) return { name: 'xai', key: env.XAI_API_KEY, model: env.SULLIVAN_MODEL || 'grok-3-mini', url: 'https://api.x.ai/v1/chat/completions' };
  if (env.OPENAI_API_KEY) return { name: 'openai', key: env.OPENAI_API_KEY, model: env.SULLIVAN_MODEL || 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions' };
  if (env.ANTHROPIC_API_KEY) return { name: 'anthropic', key: env.ANTHROPIC_API_KEY, model: env.SULLIVAN_MODEL || 'claude-3-5-haiku-latest', url: 'https://api.anthropic.com/v1/messages' };
  return null;
}
export async function chat(p, system, messages) {
  const msgs = (messages || []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  system = String(system || '').slice(0, 8000);
  if (p.name === 'anthropic') {
    const r = await fetch(p.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: p.model, max_tokens: 400, system, messages: msgs }) });
    if (!r.ok) throw new Error('anthropic ' + r.status);
    const j = await r.json(); return j.content?.map(c => c.text).join('') || '';
  }
  const r = await fetch(p.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + p.key },
    body: JSON.stringify({ model: p.model, max_tokens: 400, temperature: 0.8, messages: [{ role: 'system', content: system }, ...msgs] }) });
  if (!r.ok) throw new Error(p.name + ' ' + r.status);
  const j = await r.json(); return j.choices?.[0]?.message?.content || '';
}
