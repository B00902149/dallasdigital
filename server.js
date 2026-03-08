// ============================================================
// DallasTech — API Proxy Server (Groq)
// server.js
//
// Run:  node server.js
// Then open: http://localhost:3000
//
// Get your free Groq API key at: https://console.groq.com
// ============================================================

const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve static site from project root ─────────────────────
app.use(express.static(path.join(__dirname)));

// ── Proxy endpoint ───────────────────────────────────────────
// Groq uses the OpenAI-compatible chat/completions format.
// We normalise the response back to Anthropic shape so
// Main.js (data.content[0].text) needs zero changes.
app.post('/api/claude', async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;

    // Prepend system prompt as a system-role message
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
        model:       'llama-3.3-70b-versatile', // Best free model on Groq
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

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ DallasTech (Groq) running at http://localhost:${PORT}`);
  console.log(`   Model: llama-3.3-70b-versatile`);
  console.log(`   Free tier: 14,400 requests/day\n`);
});