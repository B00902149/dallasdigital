/* ============================================================
   DallasTech Portfolio — main.js
   Adrian Dallas · adriandallas.dev
   ============================================================ */

'use strict';

/* ── CUSTOM CURSOR ────────────────────────────────────────── */
const cur  = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cur.style.transform = `translate(${mx - 6}px, ${my - 6}px)`;
});

function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
  requestAnimationFrame(animRing);
}
animRing();

/* ── SCROLL REVEAL ────────────────────────────────────────── */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ── AGENT SYSTEM PROMPTS ─────────────────────────────────── */
const SYS = {
  intake: `You are a Client Intake Agent for Adrian Dallas (DallasTech), a UK-based freelance developer specialising in mobile apps, web apps, and AI integration. Run structured discovery on new client leads. Ask focused questions 1-2 at a time to extract: project type, key features, target users, budget (GBP), timeline, existing tech, AI interest, and pain points. When you have enough info, output a clean INTAKE SUMMARY.`,

  proposal: `You are a Proposal Generator for Adrian Dallas (DallasTech), UK freelance developer. Generate professional, client-ready proposals. Include: project overview, deliverables, technical approach, AI integration (if applicable), week-by-week timeline, pricing in GBP (Standard vs Premium tiers), payment terms (50% upfront), and next steps. Ask for details if needed.`,

  scope: `You are a Project Scope Builder for Adrian Dallas (DallasTech). Break projects into phases, milestones, tasks with hour estimates, recommended tech stack, AI integration points, risk register, and total cost calculation in GBP. Be thorough and technically precise.`,

  invoice: `You are an Invoice & Contract Agent for Adrian Dallas (DallasTech), UK freelance developer. Draft professional UK-compliant invoices (including Late Payment Act 1998 reference) and freelance contracts (IP transfer on final payment, kill fees, revision limits, governing law: England & Wales). Ask what's needed and gather details.`
};

/* ── AGENT GREETING MESSAGES ──────────────────────────────── */
const GREET = {
  intake:   `👋 <b>Client Intake Agent</b> — Tell me about your new lead. Paste their enquiry or describe the project and I'll run a full structured discovery.`,
  proposal: `📋 <b>Proposal Generator</b> — Give me the project details (type, features, budget, timeline) and I'll produce a professional, client-ready proposal.`,
  scope:    `🗺️ <b>Scope Builder</b> — Describe your project and I'll break it into phases, milestones, hour estimates, and a risk register.`,
  invoice:  `💳 <b>Invoice & Contract Agent</b> — Need an invoice, a freelance contract, or both? Tell me the project details and I'll draft a UK-compliant document.`
};

/* ── CONVERSATION HISTORIES ───────────────────────────────── */
const hists = { intake: [], proposal: [], scope: [], invoice: [] };

/* ── INIT GREETINGS ON LOAD ───────────────────────────────── */
window.addEventListener('load', () => {
  ['intake', 'proposal', 'scope', 'invoice'].forEach(a => amsg(a, 'ai', GREET[a]));
});

/* ── TAB SWITCHING ────────────────────────────────────────── */
function switchTab(agent) {
  const agents = ['intake', 'proposal', 'scope', 'invoice'];
  document.querySelectorAll('.agent-tab').forEach((tab, i) => {
    tab.classList.toggle('active', agents[i] === agent);
  });
  document.querySelectorAll('.agent-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + agent).classList.add('active');
}

/* ── RENDER A CHAT MESSAGE ────────────────────────────────── */
function amsg(agent, role, text) {
  const win = document.getElementById('win-' + agent);

  const d  = document.createElement('div');
  d.className = 'msg' + (role === 'user' ? ' user' : '');

  const av = document.createElement('div');
  av.className = 'av ' + (role === 'ai' ? 'ai' : 'usr');
  av.textContent = role === 'ai' ? '🤖' : '👤';

  const b = document.createElement('div');
  b.className = 'bbl';
  b.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');

  d.appendChild(av);
  d.appendChild(b);
  win.appendChild(d);
  win.scrollTop = win.scrollHeight;
}

/* ── TYPING INDICATOR ─────────────────────────────────────── */
function atyping(agent) {
  const win = document.getElementById('win-' + agent);
  const d   = document.createElement('div');
  d.className = 'msg';
  d.id = 'ty-' + agent;

  const av = document.createElement('div');
  av.className = 'av ai';
  av.textContent = '🤖';

  const b = document.createElement('div');
  b.className = 'bbl';
  b.innerHTML = '<div class="typing-ind"><span></span><span></span><span></span></div>';

  d.appendChild(av);
  d.appendChild(b);
  win.appendChild(d);
  win.scrollTop = win.scrollHeight;
}

function rtyping(agent) {
  const el = document.getElementById('ty-' + agent);
  if (el) el.remove();
}

/* ── SEND MESSAGE TO CLAUDE API ───────────────────────────── */
async function go(agent) {
  const inp = document.getElementById('inp-' + agent);
  const txt = inp.value.trim();
  if (!txt) return;

  inp.value = '';
  inp.style.height = 'auto';
  document.getElementById('btn-' + agent).disabled = true;

  amsg(agent, 'user', txt);
  hists[agent].push({ role: 'user', content: txt });
  atyping(agent);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYS[agent],
        messages: hists[agent]
      })
    });

    const data  = await res.json();
    const reply = data.content?.[0]?.text || 'Sorry, unable to generate a response.';

    rtyping(agent);
    hists[agent].push({ role: 'assistant', content: reply });
    amsg(agent, 'ai', reply);

  } catch (err) {
    rtyping(agent);
    amsg(agent, 'ai', `⚠️ API error: ${err.message}`);
  }

  document.getElementById('btn-' + agent).disabled = false;
  document.getElementById('inp-' + agent).focus();
}

/* ── QUICK-CHIP SEND ──────────────────────────────────────── */
function qsend(agent, txt) {
  switchTab(agent);
  document.getElementById('inp-' + agent).value = txt;
  go(agent);
}

/* ── TEXTAREA HELPERS ─────────────────────────────────────── */
function ak(e, agent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    go(agent);
  }
}

function ar(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 80) + 'px';
}

/* ── CONTACT FORM ─────────────────────────────────────────── */
function submitForm() {
  const name  = document.getElementById('f-name').value.trim();
  const email = document.getElementById('f-email').value.trim();
  const type  = document.getElementById('f-type').value;

  if (!name || !email || !type) {
    alert('Please fill in your name, email, and project type.');
    return;
  }

  document.getElementById('form-content').style.display = 'none';
  document.getElementById('form-success').style.display  = 'block';
}