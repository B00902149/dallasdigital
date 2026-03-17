/* ============================================================
   DallasTech Portfolio — Main.js
   Adrian Dallas · adriandallas.dev
   ============================================================ */

'use strict';

/* ── API base URL ─────────────────────────────────────────────
   Locally:  relative URLs work fine (same origin via Node)
   Deployed: set VITE_API_URL or just hardcode your Railway URL
   here once you have it, e.g. 'https://dallastech.up.railway.app'
   ────────────────────────────────────────────────────────── */
const API_BASE = window.DALLASTECH_API_URL || 'https://dallasdigital-production.up.railway.app';

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

/* ── MOBILE NAV ───────────────────────────────────────────── */
const hamburger   = document.getElementById('navHamburger');
const mobileMenu  = document.getElementById('mobileMenu');
const menuClose   = document.getElementById('mobileMenuClose');

function openMobileMenu() {
  mobileMenu.classList.add('open');
  hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

hamburger?.addEventListener('click', openMobileMenu);
menuClose?.addEventListener('click', closeMobileMenu);
// Close on background tap
mobileMenu?.addEventListener('click', e => {
  if (e.target === mobileMenu) closeMobileMenu();
});

/* ══════════════════════════════════════════════════════════════
   PROJECT SHOWCASE
   ══════════════════════════════════════════════════════════════ */

/* ── Project tab switching ── */
(function initProjTabs() {
  const btns   = document.querySelectorAll('.proj-tab-btn');
  const panels = document.querySelectorAll('.proj-panel');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.proj;

      btns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById('proj-' + target);
      if (panel) panel.classList.add('active');

      // Pause/resume carousel auto-advance based on active tab
      if (target === 'app') {
        startCarouselAuto();
      } else {
        stopCarouselAuto();
      }
    });
  });
})();



/* ── Phone carousel ── */
let carCurrent  = 0;
let carAutoTimer = null;
const TOTAL_SCREENS = 8;
const FRAME_WIDTH   = 220;

const phoneTrack = document.querySelector('.phone-track');
const carDots    = document.querySelectorAll('.car-dot');
const carLeft    = document.querySelector('.car-left');
const carRight   = document.querySelector('.car-right');

function carGoTo(index) {
  carCurrent = ((index % TOTAL_SCREENS) + TOTAL_SCREENS) % TOTAL_SCREENS;
  if (phoneTrack) {
    phoneTrack.style.transform = `translateX(-${carCurrent * FRAME_WIDTH}px)`;
  }
  carDots.forEach((d, i) => d.classList.toggle('active', i === carCurrent));
}

function startCarouselAuto() {
  stopCarouselAuto();
  carAutoTimer = setInterval(() => carGoTo(carCurrent + 1), 4000);
}

function stopCarouselAuto() {
  if (carAutoTimer) { clearInterval(carAutoTimer); carAutoTimer = null; }
}

if (carLeft)  carLeft.addEventListener('click',  () => { carGoTo(carCurrent - 1); startCarouselAuto(); });
if (carRight) carRight.addEventListener('click', () => { carGoTo(carCurrent + 1); startCarouselAuto(); });

carDots.forEach(dot => {
  dot.addEventListener('click', () => {
    carGoTo(parseInt(dot.dataset.i, 10));
    startCarouselAuto();
  });
});

// Touch/swipe support for carousel
if (phoneTrack) {
  let touchStartX = 0;
  phoneTrack.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  phoneTrack.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      carGoTo(diff > 0 ? carCurrent + 1 : carCurrent - 1);
      startCarouselAuto();
    }
  });
}

// Start auto-advance on load (app tab is active by default)
startCarouselAuto();

/* ══════════════════════════════════════════════════════════════
   AI DEMO — BUSINESS CHATBOT SHOWCASE
   ══════════════════════════════════════════════════════════════ */

const DEMO_BUSINESSES = {
  restaurant: {
    name: "Rosa's Kitchen",
    badge: 'Italian Restaurant',
    icon: '🍽️',
    suggestions: ['What are your opening hours?', 'Do you take bookings?', 'What are your most popular dishes?', 'Do you have vegetarian options?'],
    system: `You are a friendly AI assistant for Rosa's Kitchen, a cosy Italian restaurant in London. You handle reservations, answer menu questions, and help guests plan their visit. Opening hours: Mon–Sat 12–10pm, Sun 12–8pm. Popular dishes: Truffle Tagliatelle, Osso Buco, Tiramisu. You accept bookings via phone or this chat. Keep replies warm, concise, and under 80 words.`
  },
  gym: {
    name: 'Peak Fitness',
    badge: 'Local Gym',
    icon: '🏋️',
    suggestions: ['What memberships do you offer?', 'Do you have personal trainers?', 'What classes are on this week?', 'How do I cancel my membership?'],
    system: `You are a helpful AI assistant for Peak Fitness, a modern gym in Manchester. Memberships: Basic £25/mo, Premium £45/mo (includes classes). Facilities: pool, sauna, free weights, cardio zone. Trial day passes £10. Be motivating and supportive. Keep replies concise and under 80 words.`
  },
  ecom: {
    name: 'Noor Studio',
    badge: 'Online Fashion',
    icon: '🛍️',
    suggestions: ["What are your delivery times?", 'Can I return an item?', 'Do you have this in a size 12?', 'What payment methods do you accept?'],
    system: `You are a friendly AI customer service assistant for Noor Studio, a UK-based women's fashion boutique. Returns: 30-day free returns policy. Delivery: 2–3 days standard, next-day available. Payment: all major cards, PayPal, Klarna. Current promotion: 20% off summer collection with code SUMMER20. Keep replies helpful, stylish, and under 80 words.`
  },
  salon: {
    name: 'Luxe Hair & Beauty',
    badge: 'Hair Salon',
    icon: '✂️',
    suggestions: ['What services do you offer?', 'How much is a cut and colour?', 'Can I book an appointment?', 'Do you do bridal packages?'],
    system: `You are a warm AI assistant for Luxe Hair & Beauty, a premium salon in Birmingham. Pricing: Cut & Blow dry from £45, Full colour from £85, Balayage from £120, Bridal packages from £200. Open Tue–Sat 9am–7pm. You can book appointments directly in this chat. Keep replies friendly and under 80 words.`
  },
  coach: {
    name: 'GrowthEdge',
    badge: 'Business Coaching',
    icon: '📈',
    suggestions: ['What programmes do you offer?', 'How is the first session structured?', 'What results do your clients get?', 'How much does it cost?'],
    system: `You are an AI assistant for GrowthEdge, a business coaching company helping entrepreneurs scale from £100k to £1M+. Programmes: 90-day intensive £2,500, 6-month mastermind £6,000. You book discovery calls and answer questions about the coaching approach. Be confident and results-focused. Keep replies under 80 words.`
  }
};

let demoHistory = [];
let demoBusy    = false;
let currentBiz  = 'restaurant';

/* ── DOM refs ── */
const demoMessages    = document.getElementById('demoMessages');
const demoSuggestions = document.getElementById('demoSuggestions');
const demoInput       = document.getElementById('demoInput');
const demoSend        = document.getElementById('demoSend');
const demoAv          = document.getElementById('demoAv');
const demoName        = document.getElementById('demoName');
const demoBadge       = document.getElementById('demoBadge');

/* ── Render message ── */
function demoAddMsg(role, text) {
  const row = document.createElement('div');
  row.className = 'demo-msg-row' + (role === 'user' ? ' demo-user' : '');

  if (role === 'ai') {
    const av = document.createElement('div');
    av.className = 'demo-mini-av';
    av.textContent = DEMO_BUSINESSES[currentBiz].icon;
    row.appendChild(av);
  }

  const b = document.createElement('div');
  b.className = 'demo-bubble ' + role;
  b.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  row.appendChild(b);

  demoMessages.appendChild(row);
  demoMessages.scrollTop = demoMessages.scrollHeight;
}

/* ── Typing indicator ── */
function demoShowTyping() {
  const row = document.createElement('div');
  row.className = 'demo-msg-row';
  row.id = 'demo-typing';
  const av = document.createElement('div');
  av.className = 'demo-mini-av';
  av.textContent = DEMO_BUSINESSES[currentBiz].icon;
  const b = document.createElement('div');
  b.className = 'demo-bubble ai';
  b.innerHTML = '<div class="demo-typing-dots"><span></span><span></span><span></span></div>';
  row.appendChild(av);
  row.appendChild(b);
  demoMessages.appendChild(row);
  demoMessages.scrollTop = demoMessages.scrollHeight;
}

function demoRemoveTyping() {
  const el = document.getElementById('demo-typing');
  if (el) el.remove();
}

/* ── Render suggestion chips ── */
function demoRenderSuggestions(sugs) {
  demoSuggestions.innerHTML = '';
  sugs.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'demo-sug';
    btn.textContent = s;
    btn.addEventListener('click', () => { demoInput.value = s; demoSendMsg(); });
    demoSuggestions.appendChild(btn);
  });
}

/* ── Load a business ── */
function demoLoadBiz(bizKey, focus = false) {
  currentBiz = bizKey;
  const biz = DEMO_BUSINESSES[bizKey];
  demoHistory = [];
  demoMessages.innerHTML = '';
  demoSuggestions.innerHTML = '';

  demoAv.textContent    = biz.icon;
  demoName.textContent  = biz.name;
  demoBadge.textContent = biz.badge;

  const greeting = `Hi! I'm the AI assistant for ${biz.name}. How can I help you today?`;
  demoAddMsg('ai', greeting);
  demoHistory.push({ role: 'assistant', content: greeting });
  demoRenderSuggestions(biz.suggestions);
  if (focus) demoInput.focus();
}

/* ── Fetch contextual follow-up suggestions ── */
async function demoFetchSuggestions(conversationSoFar) {
  const sugSystem = `You generate exactly 3 short follow-up questions a customer might ask next in a conversation with a business AI assistant. Return ONLY a JSON array of 3 strings, no preamble, no markdown, no explanation. Example: ["Question one?","Question two?","Question three?"]`;

  const lastExchange = conversationSoFar.slice(-4);

  try {
    const res = await fetch(`${API_BASE}/api/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 120,
        system: sugSystem,
        messages: [
          {
            role: 'user',
            content: 'Conversation so far:\n' + lastExchange.map(m => m.role + ': ' + m.content).join('\n') + '\n\nGenerate 3 natural follow-up questions the customer might ask next.'
          }
        ]
      })
    });
    const data = await res.json();
    const raw  = (data.content?.[0]?.text || '').trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 3);
  } catch (_) {}

  // Fallback to static suggestions if parse fails
  return DEMO_BUSINESSES[currentBiz].suggestions.slice(0, 3);
}

/* ── Send message via Groq proxy ── */
async function demoSendMsg() {
  const txt = demoInput.value.trim();
  if (!txt || demoBusy) return;

  demoInput.value = '';
  demoBusy = true;
  demoSend.disabled = true;
  demoSuggestions.innerHTML = '';

  demoAddMsg('user', txt);
  demoHistory.push({ role: 'user', content: txt });
  demoShowTyping();

  try {
    // Main reply + follow-up suggestions fetched in parallel
    const [replyRes, suggestions] = await Promise.all([
      fetch(`${API_BASE}/api/claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 300,
          system: DEMO_BUSINESSES[currentBiz].system,
          messages: demoHistory
        })
      }),
      demoFetchSuggestions(demoHistory)
    ]);

    const data  = await replyRes.json();
    const reply = data.content?.[0]?.text || 'Sorry, something went wrong. Please try again.';

    demoRemoveTyping();
    demoHistory.push({ role: 'assistant', content: reply });
    demoAddMsg('ai', reply);
    demoRenderSuggestions(suggestions);

  } catch (err) {
    demoRemoveTyping();
    demoAddMsg('ai', '⚠️ Connection error. Please try again.');
    demoRenderSuggestions(DEMO_BUSINESSES[currentBiz].suggestions.slice(0, 3));
  }

  demoBusy = false;
  demoSend.disabled = false;
  demoInput.focus();
}

/* ── Business picker buttons ── */
document.querySelectorAll('.biz-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.biz-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    demoLoadBiz(btn.dataset.biz, true);
  });
});

/* ── Send button & enter key ── */
demoSend.addEventListener('click', demoSendMsg);
demoInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); demoSendMsg(); }
});

/* ── Init on DOM ready ── */
document.addEventListener('DOMContentLoaded', () => demoLoadBiz('restaurant', false));

/* ══════════════════════════════════════════════════════════════
   CONTACT FORM — EmailJS confirmation + AI quote workflow
   ══════════════════════════════════════════════════════════════

   SETUP:
   1. Sign up free at emailjs.com
   2. Add an Email Service (Gmail, Outlook, etc.)
   3. Create a confirmation template with variables:
        {{to_email}}, {{to_name}}, {{subject}}, {{html_body}}
   4. Fill in your IDs below — leave as YOUR_* until ready,
      the form will still work without it (quote still generates)
   ============================================================ */

const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_CONFIRMATION_TEMPLATE_ID';

const EMAILJS_CONFIGURED = !EMAILJS_PUBLIC_KEY.startsWith('YOUR_')
                        && !EMAILJS_SERVICE_ID.startsWith('YOUR_')
                        && !EMAILJS_TEMPLATE_ID.startsWith('YOUR_');

if (EMAILJS_CONFIGURED) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

async function submitForm() {
  const name     = document.getElementById('f-name').value.trim();
  const email    = document.getElementById('f-email').value.trim();
  const bizname  = document.getElementById('f-bizname').value.trim();
  const industry = document.getElementById('f-industry').value;
  const type     = document.getElementById('f-type').value;
  const budget   = document.getElementById('f-budget').value;
  const timeline = document.getElementById('f-timeline').value;
  const website  = document.getElementById('f-website').value.trim();
  const socials  = document.getElementById('f-socials').value.trim();
  const branding = document.getElementById('f-branding').value;
  const desc     = document.getElementById('f-desc').value.trim();
  const btn      = document.getElementById('form-submit-btn');

  // Collect platform checkboxes
  const platforms = ['f-plat-web','f-plat-ios','f-plat-android','f-plat-both','f-plat-notsure']
    .filter(id => document.getElementById(id)?.checked)
    .map(id => document.getElementById(id).value)
    .join(', ');

  // ── Validation ──
  if (!name)  { formShakeField('f-name');  return; }
  if (!email || !email.includes('@')) { formShakeField('f-email'); return; }
  if (!type)  { formShakeField('f-type'); return; }

  // ── Loading state ──
  btn.disabled      = true;
  btn.textContent   = 'Sending...';
  btn.style.opacity = '0.7';

  const payload = {
    name,
    email,
    biz_name:     bizname   || 'Not provided',
    industry:     industry  || 'Not specified',
    project_type: type,
    platforms:    platforms || 'Not specified',
    budget:       budget    || 'Not specified',
    timeline:     timeline  || 'Not specified',
    website:      website   || 'None provided',
    socials:      socials   || 'None provided',
    branding:     branding  || 'Not specified',
    message:      desc      || 'No description provided.',
  };

  try {
    // ── Always: send to server for AI quote generation ────────
    const quoteRes = await fetch(`${API_BASE}/api/quote-request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    if (!quoteRes.ok) {
      const err = await quoteRes.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${quoteRes.status}`);
    }

    // ── Optionally: send EmailJS confirmation to customer ─────
    if (EMAILJS_CONFIGURED) {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email:     email,
          to_name:      name,
          subject:      'We received your quote request — DallasTech',
          html_body:    buildConfirmationEmail(name, type),
          from_name:    'Adrian Dallas — DallasTech',
          project_type: type,
          budget:       budget   || 'Not specified',
          timeline:     timeline || 'Not specified',
          message:      desc     || 'No description provided.',
        });
      } catch (ejsErr) {
        // EmailJS failure doesn't block success — quote still generated
        console.warn('EmailJS confirmation skipped:', ejsErr.text || ejsErr.message);
      }
    }

    // ── Success ───────────────────────────────────────────────
    document.getElementById('form-content').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';

  } catch (err) {
    btn.disabled      = false;
    btn.textContent   = 'Send Quote Request →';
    btn.style.opacity = '1';
    formShowError('Something went wrong — please try again or email me directly.');
    console.error('Form submission error:', err);
  }
}

/* ── Instant confirmation email body sent to customer ── */
function buildConfirmationEmail(name, projectType) {
  return `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#7c3aed;border-radius:10px;padding:24px 28px;margin-bottom:24px;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Quote Request Received ✅</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">DallasTech · adriandallas.dev</p>
  </div>
  <p style="font-size:15px;color:#333;">Hi ${name},</p>
  <p style="font-size:14px;color:#555;line-height:1.7;">
    Thanks for reaching out! I've received your enquiry for a <strong>${projectType}</strong> project
    and I'm already working on your personalised quote.
  </p>
  <p style="font-size:14px;color:#555;line-height:1.7;">
    You'll receive a full breakdown — including scope, timeline, and pricing — within <strong>24 hours</strong>.
  </p>
  <p style="font-size:14px;color:#555;line-height:1.7;">
    In the meantime, feel free to reply to this email if you have any questions.
  </p>
  <p style="font-size:14px;color:#555;margin-top:28px;">
    Best,<br>
    <strong>Adrian Dallas</strong><br>
    DallasTech — Fast. Modern. Affordable.
  </p>
</div>`.trim();
}

/* ── Shake a field to indicate it's required ── */
function formShakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#a855f7';
  el.style.boxShadow   = '0 0 0 3px #7c3aed30';
  el.focus();
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow   = '';
  }, 2000);
}

/* ── Show inline error message ── */
function formShowError(msg) {
  let errEl = document.getElementById('form-error-msg');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'form-error-msg';
    errEl.style.cssText = 'color:#a855f7;font-size:0.82rem;margin-top:10px;text-align:center;';
    document.getElementById('form-submit-btn').after(errEl);
  }
  errEl.textContent = msg;
  setTimeout(() => { errEl.textContent = ''; }, 5000);
}