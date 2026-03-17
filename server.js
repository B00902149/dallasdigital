// ============================================================
// DallasTech — API Proxy Server (Groq)
// server.js
//
// Run:  node server.js
// Then open: http://localhost:3000
//
// Get your free Groq API key at: https://console.groq.com
// ============================================================

const express      = require('express');
const cors         = require('cors');
const fetch        = require('node-fetch');
const path         = require('path');
const crypto       = require('crypto');
const nodemailer   = require('nodemailer');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve static site from project root ─────────────────────
app.use(express.static(path.join(__dirname)));

// ── In-memory pending quotes store ──────────────────────────
// { [token]: { quoteText, lead, createdAt } }
const pendingQuotes = new Map();

// ── Nodemailer transporter (Gmail SMTP) ─────────────────────
const transporter = nodemailer.createTransport({
  host:   'smtp.gmail.com',
  port:   587,
  secure: false,          // TLS via STARTTLS — works on Railway
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ============================================================
// ROUTE: POST /api/claude
// Existing Groq proxy — unchanged
// ============================================================
app.post('/api/claude', async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;

    const groqMessages = [
      { role: 'system', content: system || '' },
      ...messages
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  max_tokens || 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Groq API error' });
    }

    // Normalise to Anthropic response shape → Main.js unchanged
    res.json({
      content: [
        { type: 'text', text: data.choices?.[0]?.message?.content || '' }
      ]
    });

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SHARED HELPER: callGroq
// Internal server-side Groq calls (quote generation etc.)
// ============================================================
async function callGroq(system, userMessage, maxTokens = 1500) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      messages:    [
        { role: 'system', content: system },
        { role: 'user',   content: userMessage }
      ],
      max_tokens:  maxTokens,
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Groq error');
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================
// SHARED HELPER: sendMail
// Sends HTML email via Nodemailer/Gmail SMTP.
// Replaces sendViaEmailJS — no templates needed, full HTML control.
// ============================================================
async function sendMail({ to, subject, html, replyTo }) {
  await transporter.sendMail({
    from:     `"DallasTech" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    replyTo:  replyTo || process.env.GMAIL_USER
  });
}

// ── Logging helpers ──────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}
function elapsed(startMs) {
  const s = ((Date.now() - startMs) / 1000).toFixed(1);
  return `${s}s`;
}

// ============================================================
// ROUTE: POST /api/quote-request
// Called by the contact form on submit.
// 1. Generates a full AI quote via Groq
// 2. Emails Adrian the quote with a one-click Approve button
// ============================================================
app.post('/api/quote-request', async (req, res) => {
  const {
    name, email,
    biz_name, industry, project_type, platforms,
    budget, timeline,
    website, socials, branding,
    message
  } = req.body;

  if (!name || !email || !project_type) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const requestStart = Date.now();

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📥 [${ts()}] New quote request received`);
  console.log(`   Lead:     ${name} <${email}>`);
  console.log(`   Business: ${biz_name || '—'} · ${industry || '—'}`);
  console.log(`   Project:  ${project_type} · ${platforms || '—'}`);
  console.log(`   Budget:   ${budget || '—'}  Timeline: ${timeline || '—'}`);
  console.log(`   Website:  ${website || '—'}`);
  console.log(`${'─'.repeat(55)}`);

  try {
    // ── 1. Generate quote with Groq ──────────────────────────
    console.log(`\n🤖 [${ts()}] Sending to Groq for quote generation...`);
    console.log(`   Model:  llama-3.3-70b-versatile`);
    console.log(`   Tokens: up to 2,000 (est. 5–15s on free tier)`);

    const groqStart = Date.now();

    const quotePrompt = `
A potential client has submitted this project enquiry:

── Contact ──────────────────────────────
Name:              ${name}
Email:             ${email}

── Business ─────────────────────────────
Business/Project:  ${biz_name  || 'Not provided'}
Industry:          ${industry  || 'Not specified'}

── Project ──────────────────────────────
Project Type:      ${project_type}
Platform(s):       ${platforms || 'Not specified'}
Budget Range:      ${budget    || 'Not specified'}
Timeline:          ${timeline  || 'Not specified'}

── Existing Presence ────────────────────
Current Website:   ${website   || 'None'}
Social Media:      ${socials   || 'None'}
Existing Branding: ${branding  || 'Not specified'}

── Brief ────────────────────────────────
${message || 'No description provided.'}

Write a professional, warm project quote to send to this client. Include:

1. A personalised opening paragraph (use their first name, reference their business name if provided)
2. Your understanding of their project and industry context
3. Proposed Solution — what you will build, tailored to their platform(s)
4. Feature Breakdown — bullet list of key deliverables specific to their brief
5. Tech Stack — technologies appropriate for their platform(s) and why
6. Timeline Breakdown — phases with week estimates, realistic to their stated timeline
7. Investment — Standard and Premium pricing tiers in GBP, calibrated to their budget range
8. What's Included — revisions, support, deployment; note any branding work if needed
9. Note on existing presence — if they have a website or socials, acknowledge how the new build will complement or replace it
10. Next Steps — clear CTA to reply and book a discovery call
11. Warm, confident closing sign-off as Adrian Dallas

Use **bold** for section headings. Reference their business name and industry where relevant. No generic placeholders.
`.trim();

    const quoteText = await callGroq(
      'You are Adrian Dallas (DallasTech), a UK freelance developer specialising in mobile apps, web apps, and AI integration. Your USP is fast, modern, affordable. Write professional, detailed, client-ready project quotes.',
      quotePrompt,
      2000
    );

    const wordCount = quoteText.split(/\s+/).length;
    console.log(`✅ [${ts()}] Quote generated in ${elapsed(groqStart)}`);
    console.log(`   Length: ~${wordCount} words`);

    // ── 2. Create single-use approval token ──────────────────
    const token      = crypto.randomBytes(32).toString('hex');
    const baseUrl    = process.env.RAILWAY_PUBLIC_DOMAIN
                         ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                         : `http://localhost:${PORT}`;
    const approveUrl = `${baseUrl}/api/approve/${token}`;

    pendingQuotes.set(token, {
      quoteText,
      lead: { name, email, biz_name, industry, project_type, platforms, budget, timeline, website, socials, branding, message },
      createdAt: Date.now()
    });

    setTimeout(() => pendingQuotes.delete(token), 7 * 24 * 60 * 60 * 1000);
    console.log(`🔑 [${ts()}] Approval token created (expires 7 days)`);
    console.log(`   Token: ${token.slice(0, 8)}...`);

    // ── 3. Format quote as HTML ──────────────────────────────
    const quoteHtml = quoteText
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e0dff5;">$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin:5px 0;color:#c0bfe0;font-size:14px;">$1</li>')
      .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul style="margin:10px 0;padding-left:20px;">${m}</ul>`)
      .replace(/\n\n/g, '</p><p style="margin:0 0 14px;color:#9090b0;font-size:14px;line-height:1.75;">')
      .replace(/\n/g, '<br>');

    // ── 4. Email Adrian with quote preview + Approve button ──
    console.log(`\n📧 [${ts()}] Sending approval email to ${process.env.ADMIN_EMAIL}...`);
    const emailStart = Date.now();

    await sendMail({
      to:      process.env.ADMIN_EMAIL,
      subject: `🔔 New Quote Request — ${project_type} from ${name}${biz_name ? ` (${biz_name})` : ''}`,
      replyTo: email,
      html:    buildAdminEmail({ name, email, biz_name, industry, project_type, platforms, budget, timeline, website, socials, branding, message, quoteHtml, approveUrl })
    });

    console.log(`✅ [${ts()}] Approval email sent in ${elapsed(emailStart)}`);
    console.log(`\n🎉 [${ts()}] Quote workflow complete in ${elapsed(requestStart)} total`);
    console.log(`   → Check your inbox and click Approve to send to ${name}`);
    console.log(`${'─'.repeat(55)}\n`);

    res.json({ success: true });

  } catch (err) {
    console.error(`\n❌ [${ts()}] Quote request failed after ${elapsed(requestStart)}`);
    console.error(`   Error: ${err.message}`);
    console.log(`${'─'.repeat(55)}\n`);
    res.status(500).json({ error: 'Failed to generate quote. Please try again.' });
  }
});

// ============================================================
// ROUTE: GET /api/approve/:token
// Adrian clicks Approve in his email.
// Sends the AI-generated quote to the customer via Nodemailer.
// ============================================================
app.get('/api/approve/:token', async (req, res) => {
  const { token } = req.params;
  const pending   = pendingQuotes.get(token);

  if (!pending) {
    console.warn(`\n⚠️  [${ts()}] Approve attempt with invalid/expired token: ${token.slice(0, 8)}...`);
    return res.status(404).send(approvalPage('error', 'This link has already been used or has expired.'));
  }

  const { quoteText, lead } = pending;
  const approveStart = Date.now();

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`👆 [${ts()}] Quote approved by Adrian`);
  console.log(`   Sending to: ${lead.name} <${lead.email}>`);
  console.log(`   Project:    ${lead.project_type}`);
  console.log(`📧 [${ts()}] Delivering quote email to customer...`);

  try {
    await sendMail({
      to:      lead.email,
      subject: `Your Project Quote from DallasTech — ${lead.project_type}`,
      replyTo: process.env.ADMIN_EMAIL,
      html:    buildQuoteEmail({ name: lead.name, project_type: lead.project_type, quoteText })
    });

    // Single-use — delete immediately after sending
    pendingQuotes.delete(token);

    console.log(`✅ [${ts()}] Quote delivered to customer in ${elapsed(approveStart)}`);
    console.log(`   → ${lead.name} should receive it within minutes`);
    console.log(`${'─'.repeat(55)}\n`);

    res.send(approvalPage('success', lead));

  } catch (err) {
    console.error(`❌ [${ts()}] Failed to deliver quote after ${elapsed(approveStart)}: ${err.message}`);
    console.log(`${'─'.repeat(55)}\n`);
    res.send(approvalPage('error', `Failed to send: ${err.message}`));
  }
});

// ============================================================
// EMAIL BUILDER: buildAdminEmail
// HTML email sent to Adrian with lead details + Approve button
// ============================================================
function buildAdminEmail({ name, email, biz_name, industry, project_type, platforms, budget, timeline, website, socials, branding, message, quoteHtml, approveUrl }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 20px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#3b1fa8,#7c3aed);border-radius:16px 16px 0 0;padding:36px 40px;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;margin-bottom:16px;">
        <span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;">DALLASTECH · ADMIN</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">🔔 New Quote Request</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${name} is interested in a ${project_type} project</p>
    </td></tr>

    <!-- Lead details -->
    <tr><td style="background:#12121f;padding:36px 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border:1px solid #2a2a45;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:16px 20px;border-bottom:1px solid #2a2a45;">
          <span style="font-size:11px;color:#a855f7;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Lead Details</span>
        </td></tr>
        <tr><td style="padding:20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;width:120px;">Name</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;font-weight:600;">${name}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Email</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;font-size:13px;">
                <a href="mailto:${email}" style="color:#a855f7;text-decoration:none;font-weight:600;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Business</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;font-weight:600;">${biz_name || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Industry</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;">${industry || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Project</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;font-weight:600;">${project_type}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Platform(s)</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;">${platforms || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Budget</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;font-weight:600;">${budget || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Timeline</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;">${timeline || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Website</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;font-size:13px;">
                ${website ? `<a href="${website}" style="color:#a855f7;text-decoration:none;">${website}</a>` : '<span style="color:#6060a0;">—</span>'}
              </td>
            </tr>
            <tr>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#6060a0;font-size:13px;">Socials</td>
              <td style="padding:7px 0;border-bottom:1px solid #1e1e35;color:#e0dff5;font-size:13px;">${socials || '—'}</td>
            </tr>
            <tr>
              <td style="padding:7px 0;color:#6060a0;font-size:13px;">Branding</td>
              <td style="padding:7px 0;color:#e0dff5;font-size:13px;">${branding || '—'}</td>
            </tr>
          </table>
        </td></tr>
        ${message ? `
        <tr><td style="padding:0 20px 20px;">
          <div style="background:#0f0f1e;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:14px 18px;">
            <p style="margin:0 0 6px;font-size:11px;color:#a855f7;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Their Message</p>
            <p style="margin:0;color:#c0bfe0;font-size:13px;line-height:1.7;">${message}</p>
          </div>
        </td></tr>` : ''}
      </table>

      <!-- AI Quote preview -->
      <p style="margin:0 0 12px;font-size:11px;color:#a855f7;font-weight:700;letter-spacing:2px;text-transform:uppercase;">AI-Generated Quote Preview</p>
      <div style="background:#1a1a2e;border:1px solid #2a2a45;border-radius:12px;padding:24px;margin-bottom:28px;">
        <p style="margin:0 0 14px;color:#9090b0;font-size:14px;line-height:1.75;">${quoteHtml}</p>
      </div>

      <!-- Approve button -->
      <p style="margin:0 0 16px;color:#9090b0;font-size:14px;line-height:1.7;">
        Happy with this quote? Click below to send it directly to <strong style="color:#e0dff5;">${name}</strong> at <strong style="color:#e0dff5;">${email}</strong>.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td style="background:#7c3aed;border-radius:50px;padding:14px 36px;">
            <a href="${approveUrl}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;">
              ✅ Approve &amp; Send to Client
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 36px;color:#3a3a5c;font-size:12px;">
        This link works once and expires in 7 days. Your local server must be running when you click it.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0d0d1a;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #1e1e35;">
      <p style="margin:0;color:#3a3a5c;font-size:12px;">© 2025 DallasTech · Internal notification — do not forward</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ============================================================
// EMAIL BUILDER: buildQuoteEmail
// HTML email sent to the customer with their full AI quote
// ============================================================
function buildQuoteEmail({ name, project_type, quoteText }) {
  const quoteHtml = quoteText
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e0dff5;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:5px 0;color:#c0bfe0;font-size:14px;">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, m => `<ul style="margin:10px 0;padding-left:20px;">${m}</ul>`)
    .replace(/\n\n/g, '</p><p style="margin:0 0 14px;color:#9090b0;font-size:14px;line-height:1.75;">')
    .replace(/\n/g, '<br>');

  const firstName = name.split(' ')[0];

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a12;padding:40px 20px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:linear-gradient(135deg,#5b21b6,#7c3aed);border-radius:16px 16px 0 0;padding:36px 40px;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:10px;padding:8px 14px;margin-bottom:16px;">
        <span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:2px;">DALLASTECH</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">Your Project Quote 📋</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Personalised for ${firstName} · ${project_type}</p>
    </td></tr>

    <!-- Intro -->
    <tr><td style="background:#12121f;padding:36px 40px 24px;">
      <p style="margin:0 0 16px;color:#e0dff5;font-size:16px;line-height:1.6;">
        Hi <strong style="color:#a855f7;">${firstName}</strong>,
      </p>
      <p style="margin:0 0 0;color:#9090b0;font-size:15px;line-height:1.7;">
        Thank you for your interest in working together. I've reviewed your brief and put together a detailed proposal below.
        Take your time reading through it — and don't hesitate to reply with any questions.
      </p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="background:#12121f;padding:0 40px;">
      <div style="border-top:1px solid #2a2a45;"></div>
    </td></tr>

    <!-- Quote content -->
    <tr><td style="background:#12121f;padding:28px 40px;">
      <div style="background:#1a1a2e;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:12px 18px;margin-bottom:24px;">
        <span style="font-size:11px;color:#a855f7;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Project Proposal &amp; Quote</span>
      </div>
      <p style="margin:0 0 14px;color:#9090b0;font-size:14px;line-height:1.75;">${quoteHtml}</p>
    </td></tr>

    <!-- Divider -->
    <tr><td style="background:#12121f;padding:0 40px;">
      <div style="border-top:1px solid #2a2a45;"></div>
    </td></tr>

    <!-- CTA -->
    <tr><td style="background:#12121f;padding:28px 40px;">
      <p style="margin:0 0 16px;color:#e0dff5;font-size:15px;font-weight:600;">Ready to move forward?</p>
      <p style="margin:0 0 24px;color:#9090b0;font-size:14px;line-height:1.7;">
        Simply reply to this email to accept the quote or ask any questions. I'll then send over a short contract and we can get started.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#7c3aed;border-radius:50px;padding:14px 36px;">
            <a href="mailto:${process.env.ADMIN_EMAIL}?subject=Re: My Project Quote — ${project_type}"
               style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;">
              Reply to Accept Quote →
            </a>
          </td>
        </tr>
      </table>

      <!-- Trust signals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border:1px solid #2a2a45;border-radius:12px;">
        <tr><td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="33%" style="padding:6px 8px;vertical-align:top;">
                <p style="margin:0 0 4px;color:#a855f7;font-size:18px;">⚡</p>
                <p style="margin:0 0 2px;color:#e0dff5;font-size:13px;font-weight:600;">Fast delivery</p>
                <p style="margin:0;color:#6060a0;font-size:12px;">Realistic timelines, always met</p>
              </td>
              <td width="33%" style="padding:6px 8px;vertical-align:top;">
                <p style="margin:0 0 4px;color:#a855f7;font-size:18px;">🤖</p>
                <p style="margin:0 0 2px;color:#e0dff5;font-size:13px;font-weight:600;">AI included</p>
                <p style="margin:0;color:#6060a0;font-size:12px;">Smart features built in</p>
              </td>
              <td width="33%" style="padding:6px 8px;vertical-align:top;">
                <p style="margin:0 0 4px;color:#a855f7;font-size:18px;">💜</p>
                <p style="margin:0 0 2px;color:#e0dff5;font-size:13px;font-weight:600;">Transparent pricing</p>
                <p style="margin:0;color:#6060a0;font-size:12px;">No hidden fees, ever</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <!-- Sign off -->
    <tr><td style="background:#12121f;padding:0 40px 36px;">
      <p style="margin:0 0 6px;color:#9090b0;font-size:14px;">Best regards,</p>
      <p style="margin:0 0 2px;color:#e0dff5;font-size:15px;font-weight:700;">Adrian Dallas</p>
      <p style="margin:0;color:#6060a0;font-size:13px;">DallasTech · Fast. Modern. Affordable.</p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0d0d1a;border-radius:0 0 16px 16px;padding:20px 40px;border-top:1px solid #1e1e35;">
      <p style="margin:0;color:#3a3a5c;font-size:12px;">© 2025 Adrian Dallas · DallasTech · United Kingdom</p>
      <p style="margin:4px 0 0;color:#3a3a5c;font-size:12px;">This quote is valid for 30 days from the date of issue. Prices in GBP.</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ============================================================
// HELPER: approvalPage
// Branded HTML page shown to Adrian after clicking Approve
// ============================================================
function approvalPage(status, data) {
  const isSuccess = status === 'success';

  const content = isSuccess
    ? `<h1 style="color:#a855f7;font-size:2rem;margin:0 0 12px;">✅ Quote Sent!</h1>
       <p style="color:#9090b0;line-height:1.7;margin:0 0 8px;">
         Your quote has been sent to <strong style="color:#e0dff5;">${data.name}</strong>
         at <strong style="color:#e0dff5;">${data.email}</strong>.
       </p>
       <p style="color:#9090b0;line-height:1.7;margin:0 0 24px;">They'll receive it shortly. You can close this tab.</p>
       <span style="display:inline-block;background:#7c3aed20;border:1px solid #7c3aed40;
         color:#a855f7;padding:6px 18px;border-radius:20px;font-size:13px;">${data.project_type}</span>`
    : `<h1 style="color:#f87171;font-size:2rem;margin:0 0 12px;">⚠️ Error</h1>
       <p style="color:#9090b0;line-height:1.7;margin:0;">${data}</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${isSuccess ? 'Quote Sent' : 'Error'} — DallasTech</title></head>
<body style="margin:0;background:#0a0a12;font-family:'Segoe UI',Arial,sans-serif;
  display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#12121f;border:1px solid #2a2a45;border-radius:20px;
    padding:52px 48px;text-align:center;max-width:480px;width:90%;">
    <div style="display:inline-block;background:rgba(124,58,237,0.15);border-radius:10px;
      padding:7px 14px;margin-bottom:24px;">
      <span style="color:#a855f7;font-size:12px;font-weight:700;letter-spacing:2px;">DALLASTECH</span>
    </div>
    ${content}
  </div>
</body>
</html>`;
}

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n✅ DallasTech (Groq) running at http://localhost:${PORT}`);
  console.log(`   Model:     llama-3.3-70b-versatile`);
  console.log(`   Free tier: 14,400 requests/day`);
  console.log(`\n   Routes:`);
  console.log(`   POST /api/claude          → Groq proxy (AI demo + chatbot)`);
  console.log(`   POST /api/quote-request   → Generate & email quote for approval`);
  console.log(`   GET  /api/approve/:token  → Approve & send quote to customer`);

  // ── Validate .env variables ──────────────────────────────
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🔍 Checking .env configuration...`);

  const required = {
    GROQ_API_KEY:       process.env.GROQ_API_KEY,
    GMAIL_USER:         process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    ADMIN_EMAIL:        process.env.ADMIN_EMAIL,
  };

  let envOk = true;
  for (const [key, val] of Object.entries(required)) {
    if (!val || val.startsWith('your_') || val.includes('YOUR_')) {
      console.log(`   ❌ ${key} — missing or still set to placeholder`);
      envOk = false;
    } else {
      const display = key.includes('PASSWORD') || key.includes('KEY')
        ? val.slice(0, 6) + '••••••'
        : val;
      console.log(`   ✅ ${key} = ${display}`);
    }
  }

  if (!envOk) {
    console.log(`\n   ⚠️  Fix the above .env values then restart the server.`);
    console.log(`${'─'.repeat(55)}\n`);
    return;
  }

  // ── Test Gmail SMTP connection ───────────────────────────
  console.log(`\n📧 Testing Gmail SMTP connection...`);
  try {
    await transporter.verify();
    console.log(`   ✅ Gmail SMTP connected — ready to send as ${process.env.GMAIL_USER}`);
  } catch (err) {
    console.log(`   ❌ Gmail SMTP failed: ${err.message}`);
    console.log(`\n   Common fixes:`);
    console.log(`   • Make sure GMAIL_APP_PASSWORD is an App Password (16 chars)`);
    console.log(`     NOT your regular Gmail password`);
    console.log(`   • Generate one at: myaccount.google.com → Security → App Passwords`);
    console.log(`   • 2-Step Verification must be enabled on your Google account`);
    console.log(`   • If using a Google Workspace account, App Passwords may be`);
    console.log(`     disabled by your admin — try a personal Gmail instead`);
  }

  console.log(`${'─'.repeat(55)}\n`);
});