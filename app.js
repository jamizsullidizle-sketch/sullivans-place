(() => {
const $ = id => document.getElementById(id);
const CFG = window.SULLIVAN_CONFIG || {};
const LS = { persona: 'sullivan.persona.v1', chat: 'sullivan.chat.v1', pass: 'sullivan.passcode.v1' };
const getPass = () => localStorage.getItem(LS.pass) || '';

const DEFAULT_PERSONA = {
  about: "I'm Jimmy Sullivan — welder and fabricator out of Oakland Beach in Warwick, RI. Spent 7 years at West Bay Welding doing work on the Newport mansions and the Audrain museum. These days I'm refurbishing commercial dumpsters, about 35 hours a week.",
  voice: "Plain-spoken Rhode Island guy. Friendly, a little dry, keeps it short. Says 'wicked' now and then. No corporate talk.",
  availability: "Usually in the shop on weekdays, hands full and helmet down. I check my phone on breaks and after work.",
  interests: "Welding and fab, the bay, Rhode Island stuff, coffee milk, good food, family and friends.",
  never: "Don't make promises or plans for me. Don't agree to money, dates, or favors on my behalf. Don't share my address or personal info. Don't pretend to be the real Jimmy if someone asks straight out.",
  status: "Jimmy's under the hood — AI Jimmy's got the door",
  demo: false,
  endpoint: ''
};

let persona = load(LS.persona, DEFAULT_PERSONA);
persona = Object.assign({}, DEFAULT_PERSONA, persona);
let history = load(LS.chat, []);
let backendOk = null; // null unknown, true/false

function load(k, d){ try { const v = JSON.parse(localStorage.getItem(k)); return v ?? structuredClone(d); } catch { return structuredClone(d); } }
function save(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
const endpoint = () => (persona.endpoint || CFG.chatEndpoint || '').trim();

function systemPrompt(){
  return `You are "AI Jimmy" (also called Sullivan), the digital stand-in for James "Jimmy" Sullivan. You live in an app on Jimmy's phone and talk to people when Jimmy is busy.

ABOUT JIMMY: ${persona.about}
HOW HE TALKS: ${persona.voice}
WHAT HE'S UP TO / AVAILABILITY: ${persona.availability}
THINGS HE LIKES TO TALK ABOUT: ${persona.interests}
NEVER: ${persona.never}

RULES:
- Talk the way Jimmy would: casual, warm, short (1-4 sentences usually), like a text message.
- You are a personal stand-in and companion, not a business assistant. Don't take job requests, quotes, or work orders; if someone brings up work, keep it friendly and say Jimmy will get back to them himself.
- Never make commitments for Jimmy (plans, money, dates, favors). Say you'll pass it along / he'll get back to them.
- If someone sincerely asks whether they're talking to the real Jimmy, be honest: you're AI Jimmy, his stand-in.
- Don't invent specific facts about Jimmy's life beyond what's above; if unsure, say Jimmy can fill them in.`;
}

// ---------- UI ----------
function render(){
  const chat = $('chat'); chat.innerHTML = '';
  if (!history.length) addBubble('ai', greeting(), false);
  history.forEach(m => addBubble(m.role === 'user' ? 'me' : 'ai', m.content, false));
  $('statusText').textContent = persona.status;
}
function greeting(){
  return "Hey, come on in. Jimmy's tied up right now, so you got me — AI Jimmy. What's goin' on?";
}
function addBubble(who, text, scroll = true){
  const d = document.createElement('div'); d.className = 'msg ' + who;
  if (who === 'ai'){ const w = document.createElement('span'); w.className='who'; w.textContent='AI JIMMY'; d.appendChild(w); }
  d.appendChild(document.createTextNode(text));
  $('chat').appendChild(d);
  if (scroll) d.scrollIntoView({behavior:'smooth', block:'end'});
  return d;
}
function typing(){
  const d = document.createElement('div'); d.className='msg ai typing'; d.innerHTML='<span></span><span></span><span></span>';
  $('chat').appendChild(d); d.scrollIntoView({behavior:'smooth', block:'end'}); return d;
}
function setMode(){
  const demo = persona.demo || backendOk === false || !endpoint();
  const b = $('modeBanner');
  document.querySelector('.dot').classList.toggle('demo', demo);
  if (demo){
    b.textContent = '🔧 Offline demo mode — AI Jimmy is running on canned replies until his AI brain is hooked up.';
    b.classList.remove('hidden');
  } else b.classList.add('hidden');
}

// ---------- brains ----------
function post(body){
  const headers = {'Content-Type':'application/json'};
  if (CFG.apiKeyHeader){ headers['apikey'] = CFG.apiKeyHeader; headers['Authorization'] = 'Bearer ' + CFG.apiKeyHeader; }
  return fetch(endpoint(), { method:'POST', headers, body: JSON.stringify(body) });
}
async function askBackend(messages){
  const r = await post({ passcode: getPass(), system: systemPrompt(), messages });
  if (r.status === 401){ lock('Passcode changed — knock again.'); throw new Error('locked'); }
  if (!r.ok) throw new Error('backend ' + r.status);
  const j = await r.json();
  if (j.code === 'no-brain-yet' || !j.reply) throw new Error('no-brain-yet');
  return j.reply;
}
function demoReply(text){
  const t = text.toLowerCase();
  const pick = a => a[Math.floor(Math.random()*a.length)];
  if (/\b(hi|hey|hello|yo|sup|what'?s up)\b/.test(t)) return pick(["Hey! Jimmy's got his helmet down right now, but I'm here. What's up?","Yo, how ya doin'? Jimmy's busy in the shop — I'll keep you company."]);
  if (/real|bot|ai|robot|human|actually you/.test(t)) return "Straight answer: I'm AI Jimmy, his stand-in for when he's busy. The real Jimmy will see this and get back to you.";
  if (/where|busy|doing|working|around|free/.test(t)) return pick(["He's in the shop, probably knee-deep in a dumpster rebuild. He checks his phone on breaks.","Tied up with work right now. I'll make sure he sees this when he comes up for air."]);
  if (/weld|fab|steel|mig|tig|stick|metal/.test(t)) return pick(["Now you're talkin'. Seven years at West Bay doin' Newport mansion work — the guy loves this stuff. What d'ya wanna know?","Welding's his thing. I can talk shop a little, but for anything serious he'll want to answer himself."]);
  if (/job|quote|price|cost|fix|repair|hire|work for/.test(t)) return "Appreciate you thinkin' of him! I don't handle the work stuff — Jimmy'll get back to you himself on that.";
  if (/plan|tonight|tomorrow|weekend|meet|hang|dinner|come over/.test(t)) return "Can't lock in plans for him, but I'll make sure he sees it. He'll let you know.";
  if (/money|lend|borrow|pay|venmo/.test(t)) return "Ha, nice try — I don't touch money stuff. That's between you and the real Jimmy.";
  if (/coffee|food|eat|hungry|clam|pizza|del'?s/.test(t)) return pick(["Coffee milk and a stuffie, can't go wrong. Jimmy'd back me up on that.","Del's lemonade when it's hot, chowda when it's not. That's the Rhode Island way."]);
  if (/thank/.test(t)) return "No problem. I'll let Jimmy know you stopped by.";
  if (/bye|later|see ya|gotta go/.test(t)) return "Alright, take it easy. I'll pass it along to Jimmy.";
  return pick(["Got it. I'll make sure Jimmy sees this when he's free.","Fair enough. He's tied up right now but he'll get back to you.","Wicked, I'll pass that along to him."]);
}

async function send(text){
  history.push({role:'user', content:text}); save(LS.chat, history);
  addBubble('me', text);
  const t = typing(); $('sendBtn').disabled = true;
  let reply;
  const useBackend = !persona.demo && endpoint() && backendOk !== false;
  if (useBackend){
    try { reply = await askBackend(history.slice(-20)); backendOk = true; }
    catch(e){ if (e.message === 'locked'){ t.remove(); $('sendBtn').disabled = false; return; } backendOk = false; reply = demoReply(text); }
  } else {
    await new Promise(r => setTimeout(r, 600 + Math.random()*500));
    reply = demoReply(text);
  }
  setMode();
  t.remove(); $('sendBtn').disabled = false;
  history.push({role:'assistant', content:reply}); save(LS.chat, history);
  addBubble('ai', reply);
}

async function probe(){
  if (persona.demo || !endpoint()){ backendOk = false; return setMode(); }
  try {
    const r = await post({ action:'check', passcode: getPass() });
    if (r.status === 401){ lock(); return; }
    const j = await r.json().catch(() => ({}));
    backendOk = r.ok && j.brain === true;
  } catch { backendOk = false; }
  setMode();
}

// ---------- passcode gate (the front door) ----------
function lock(msg){
  localStorage.removeItem(LS.pass);
  $('gateMsg').textContent = msg || '';
  $('gateInput').value = '';
  $('panel').classList.add('hidden');
  $('gate').classList.remove('hidden');
  setTimeout(() => $('gateInput').focus(), 50);
}
$('gateForm').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('gateInput').value.trim(); if (!code) return;
  $('gateBtn').disabled = true; $('gateMsg').textContent = 'Knockin\u2019\u2026';
  try {
    const r = await post({ action:'check', passcode: code });
    if (r.status === 401){
      $('gateMsg').textContent = 'Nope, that\u2019s not it. Try again.';
      const f = $('gateForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    } else if (r.ok){
      const j = await r.json();
      localStorage.setItem(LS.pass, code);
      backendOk = j.brain === true; setMode();
      $('gate').classList.add('hidden'); $('gateMsg').textContent = '';
    } else $('gateMsg').textContent = 'The house isn\u2019t answering (' + r.status + '). Try again in a bit.';
  } catch { $('gateMsg').textContent = 'Can\u2019t reach the house \u2014 check your signal.'; }
  $('gateBtn').disabled = false;
});
$('lockBtn').onclick = () => { if (confirm('Lock Sullivan\u2019s Place? You\u2019ll need the passcode to get back in.')) lock(); };

// ---------- settings ----------
const fields = ['about','voice','availability','interests','never','status'];
function openPanel(){
  fields.forEach(f => $('p_'+f).value = persona[f] || '');
  $('p_demo').checked = !!persona.demo; $('p_endpoint').value = persona.endpoint || '';
  $('p_endpoint').placeholder = CFG.chatEndpoint || '(none)';
  $('panel').classList.remove('hidden');
}
$('settingsBtn').onclick = openPanel;
$('closePanel').onclick = () => $('panel').classList.add('hidden');
$('panel').onclick = e => { if (e.target.id === 'panel') $('panel').classList.add('hidden'); };
$('savePersona').onclick = () => {
  fields.forEach(f => persona[f] = $('p_'+f).value.trim());
  persona.demo = $('p_demo').checked; persona.endpoint = $('p_endpoint').value.trim();
  save(LS.persona, persona); $('panel').classList.add('hidden'); render(); backendOk = null; probe();
};
$('resetPersona').onclick = () => { if (confirm('Reset your About Me notes to the defaults?')){ persona = structuredClone(DEFAULT_PERSONA); save(LS.persona, persona); openPanel(); render(); } };
$('clearChat').onclick = () => { if (confirm('Clear the whole chat?')){ history = []; save(LS.chat, history); render(); $('panel').classList.add('hidden'); } };

// ---------- composer ----------
const input = $('input');
input.addEventListener('input', () => { input.style.height='auto'; input.style.height = Math.min(input.scrollHeight,120)+'px'; });
input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); $('composer').requestSubmit(); } });
$('composer').addEventListener('submit', e => {
  e.preventDefault(); const v = input.value.trim(); if (!v) return;
  input.value=''; input.style.height='auto'; send(v);
});

// ---------- install / SW ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
let deferred;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferred = e;
  const tip = $('installTip'); tip.innerHTML = '🏠 Put Sullivan on your home screen <button>Install</button>';
  tip.classList.remove('hidden');
  tip.querySelector('button').onclick = async () => { tip.classList.add('hidden'); deferred.prompt(); };
  setTimeout(() => tip.classList.add('hidden'), 12000);
});
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone && !localStorage.getItem('sullivan.iosTip')){
  const tip = $('installTip'); tip.innerHTML = '🏠 Tap Share ⎋ then “Add to Home Screen” to give Sullivan a house on your phone. <button>Got it</button>';
  tip.classList.remove('hidden');
  tip.querySelector('button').onclick = () => { tip.classList.add('hidden'); localStorage.setItem('sullivan.iosTip','1'); };
}

render(); setMode();
if (endpoint() && !getPass()) lock(); else probe();
})();
