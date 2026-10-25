# Sullivan's Place — AI Jimmy's house (PWA)
A home-screen web app where "AI Jimmy" — Jimmy Sullivan's stand-in for when he's busy — lives.

- Front end (static, GitHub Pages): index.html, styles.css, app.js, config.js, manifest.json, sw.js, icons/
- Passcode gate: the app asks for a passcode at the front door; it's verified **server-side** by the Supabase Edge Function. Nothing secret is in this repo.
- AI brain: `supabase/functions/sullivan-chat/index.ts`. Add ONE Supabase secret — `XAI_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` (optional `SULLIVAN_MODEL`) — and AI Jimmy wakes up. Until then the function answers `no-brain-yet` and the app runs in clearly-labeled offline demo mode.
- Persona notes and chat history live only on the phone (localStorage).
- Local dev: `SULLIVAN_PASSCODE=... node server.js` then set the endpoint to `/api/chat` in settings.
