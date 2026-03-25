'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
var sel   = null;
var scope = null;
var files = {};
var brand = {};

var IN_CLAUDE = window.location.hostname.indexOf('claude.ai') !== -1
             || window.location.hostname.indexOf('anthropic.com') !== -1;

var GMAIL_MCP = 'https://gmail.mcp.claude.com/mcp';

// ── Pipeline helpers ──────────────────────────────────────────────────────────
function pip(n) {
  for (var i = 1; i <= 5; i++) {
    var el = document.getElementById('p' + i);
    if (el) el.className = 'pip-step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function goTo(n) {
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('on'); });
  var v = document.getElementById('v' + n);
  if (v) v.classList.add('on');
  pip(n);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function aiCall(messages, system) {
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: system || '',
      messages: messages
    })
  });
  var data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API error');
  return (data.content || []).map(function(b) { return b.text || ''; }).filter(Boolean).join('\n');
}

async function gmailCall(messages, system) {
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: system || '',
      messages: messages,
      mcp_servers: [{ type: 'url', url: GMAIL_MCP, name: 'gmail' }]
    })
  });
  var data = await res.json();
  return data.content || [];
}

// ── Step 1: Fetch emails ──────────────────────────────────────────────────────
function mockEmails() {
  return [
    { id: '1', fromName: 'Nicole McKee',  fromEmail: 'nicole@craftymammies.co.uk',
      subject: 'RE: Proposal Approved — Crafty Mammies Gift Shop',
      date: '21 Mar', industry: 'gifts',
      snippet: 'Hi Adrian, the mock-ups look brilliant. Personalised embroidery shop — product gallery, custom order form, and Shopify integration.' },
    { id: '2', fromName: 'Marco Rossi',   fromEmail: 'marco@bellavitaristorante.co.uk',
      subject: 'Approved: Bella Vita Restaurant Website',
      date: '19 Mar', industry: 'restaurant',
      snippet: 'Ciao Adrian! Love the design. Online reservations, full menu displayed beautifully, gallery of restaurant and dishes.' },
    { id: '3', fromName: 'Claire Hughes', fromEmail: 'claire@peakperformancept.co.uk',
      subject: 'Project Proposal Approved — Peak Performance PT',
      date: '17 Mar', industry: 'fitness',
      snippet: 'Hi Adrian, looks perfect. Personal trainer site with class timetable, transformation gallery, testimonials and online booking.' },
    { id: '4', fromName: 'David Sterling', fromEmail: 'd.sterling@sterlinglaw.co.uk',
      subject: 'RE: Website Proposal Approved — Sterling Law',
      date: '14 Mar', industry: 'legal',
      snippet: 'Adrian, approved. Professional law firm site — practice areas, team profiles, consultation booking and case study section.' },
    { id: '5', fromName: 'Emma Walsh',    fromEmail: 'emma@bloomfloraldesign.co.uk',
      subject: 'Approved: Bloom Floral Design — New Website',
      date: '11 Mar', industry: 'florist',
      snippet: 'Hi Adrian, we love it! Florist site — seasonal collections, wedding and corporate packages, gallery and quote form.' }
  ];
}

async function loadEmails() {
  sel = null;
  document.getElementById('goBtn').disabled = true;
  document.getElementById('elist').innerHTML =
    '<div class="loading-state"><div class="spin"></div>Fetching from Gmail...</div>';

  var list = [];
  try {
    if (!IN_CLAUDE) throw new Error('not in claude.ai');
    var content = await gmailCall(
      [{ role: 'user', content: 'Search Gmail inbox of dallasdigital95@gmail.com for emails with "approved" in the subject from the last 30 days. Return up to 6.' }],
      'Gmail assistant. Use MCP tools. Return ONLY a valid JSON array: [{id,fromName,fromEmail,subject,date,snippet}]. No markdown.'
    );
    var txt = (content || []).filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('');
    list = JSON.parse(txt.replace(/```json|```/g, '').trim());
    if (!Array.isArray(list) || !list.length) throw new Error('empty');
  } catch(e) {
    document.getElementById('gmailNote').style.display = 'block';
    list = mockEmails();
  }
  renderEmails(list);
}

function renderEmails(list) {
  var el = document.getElementById('elist');
  if (!list.length) {
    el.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.3);padding:1rem">No approved proposals found.</div>';
    return;
  }
  var html = '';
  list.forEach(function(e, i) {
    var ini = e.fromName.split(' ').map(function(w) { return w[0] || ''; }).slice(0, 2).join('');
    html += '<div class="eitem" id="ei' + i + '" onclick="_pick(' + i + ')">'
          + '<div class="eavatar">' + esc(ini) + '</div>'
          + '<div class="emeta">'
          +   '<div class="efrom">' + esc(e.fromName) + '<span class="badge">approved</span></div>'
          +   '<div class="esubj">' + esc(e.subject) + '</div>'
          +   '<div class="esnip">' + esc(e.snippet) + '</div>'
          + '</div>'
          + '<div class="edate">' + esc(e.date) + '</div>'
          + '</div>';
  });
  el.innerHTML = html;
  el._data = list;
}

window._pick = function(i) {
  var list = document.getElementById('elist')._data;
  sel = list[i];
  document.querySelectorAll('.eitem').forEach(function(el) { el.classList.remove('sel'); });
  document.getElementById('ei' + i).classList.add('sel');
  document.getElementById('goBtn').disabled = false;
};

// ── Step 2: Parse scope ───────────────────────────────────────────────────────
function guessIndustry(email) {
  if (email.industry) return email.industry;
  var t = ((email.subject || '') + ' ' + (email.snippet || '')).toLowerCase();
  if (t.match(/restaurant|cafe|bistro|menu|reserv|dining/)) return 'restaurant';
  if (t.match(/fitness|gym|personal train|workout|class|timetable/)) return 'fitness';
  if (t.match(/law|legal|solicitor|barrister|counsel/))   return 'legal';
  if (t.match(/floral|florist|flower|bouquet/))            return 'florist';
  if (t.match(/embroid|gift|personalised|craft/))          return 'gifts';
  if (t.match(/react native|mobile app|ios|android/))      return 'app';
  if (t.match(/api|backend|node|express/))                 return 'backend';
  return 'generic';
}

function guessScope(email) {
  var t = ((email.subject || '') + ' ' + (email.snippet || '')).toLowerCase();
  var type = 'Bespoke Website';
  if (t.match(/react native|mobile app|ios|android/)) type = 'React Native App';
  else if (t.match(/full.?stack/))                    type = 'Full-Stack';
  else if (t.match(/api|backend|node|express/))       type = 'Node/Express Backend';
  var stacks = {
    'Bespoke Website':      ['HTML', 'CSS', 'JS'],
    'React Native App':     ['React Native', 'Expo', 'Node/Express'],
    'Full-Stack':           ['HTML', 'CSS', 'JS', 'Node/Express'],
    'Node/Express Backend': ['Node.js', 'Express', 'MongoDB']
  };
  return {
    clientName:  email.fromName,
    projectType: type,
    stack:       stacks[type],
    features:    ['Responsive design', 'Contact form', 'Modern UI', 'Mobile-friendly', 'SEO optimised'],
    timeline:    '4-6 weeks',
    budget:      'TBC'
  };
}

function renderScopeGrid(s) {
  document.getElementById('scopeSpin').style.display = 'none';
  var g = document.getElementById('scopeGrid');
  g.style.display = 'grid';
  g.innerHTML =
      '<div class="sitem"><div class="skey">Client</div><div class="sval">' + esc(s.clientName) + '</div></div>'
    + '<div class="sitem"><div class="skey">Project type</div><div class="sval">' + esc(s.projectType) + '</div></div>'
    + '<div class="sitem"><div class="skey">Stack</div><div class="sval">' + esc((s.stack || []).join(', ')) + '</div></div>'
    + '<div class="sitem"><div class="skey">Timeline</div><div class="sval">' + esc(s.timeline || 'TBC') + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Features</div>'
    +   '<div class="sval" style="font-weight:400;font-size:12px;line-height:1.8">'
    +   (s.features || []).map(function(f) { return '&#8226; ' + esc(f); }).join('<br>')
    +   '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Override project type</div>'
    +   '<select id="typeOverride" class="type-select">'
    +     '<option value="Bespoke Website"'       + (s.projectType === 'Bespoke Website'       ? ' selected' : '') + '>Bespoke Website (HTML/CSS/JS)</option>'
    +     '<option value="React Native App"'       + (s.projectType === 'React Native App'       ? ' selected' : '') + '>React Native App</option>'
    +     '<option value="Node/Express Backend"'   + (s.projectType === 'Node/Express Backend'   ? ' selected' : '') + '>Node/Express Backend</option>'
    +     '<option value="Full-Stack"'             + (s.projectType === 'Full-Stack'             ? ' selected' : '') + '>Full-Stack (Web + Backend)</option>'
    +   '</select>'
    + '</div>';
}

async function doScope() {
  if (!sel) return;
  goTo(2);
  document.getElementById('prevBox').textContent =
    'From: ' + sel.fromName + ' <' + sel.fromEmail + '>\n'
    + 'Subject: ' + sel.subject + '\nDate: ' + sel.date + '\n\n' + sel.snippet;
  document.getElementById('scopeCard').style.display = 'block';
  document.getElementById('scopeSpin').style.display = 'flex';
  document.getElementById('scopeGrid').style.display = 'none';
  document.getElementById('scopeActs').style.display = 'none';

  if (IN_CLAUDE) {
    try {
      var raw = await aiCall(
        [{ role: 'user', content: 'Parse this proposal:\nSubject: ' + sel.subject + '\n\n' + sel.snippet }],
        'DallasTech scoping assistant. Return ONLY valid JSON: {"clientName":"","projectType":"Bespoke Website|React Native App|Node/Express Backend|Full-Stack","stack":[],"features":[],"timeline":"","budget":""}. No markdown.'
      );
      scope = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch(e) { scope = guessScope(sel); }
  } else {
    scope = guessScope(sel);
  }

  // Pre-fill brand colour from industry
  var industryAccents = { restaurant: '#c0392b', fitness: '#534AB7', legal: '#1a3a5c', florist: '#7c4d7e', gifts: '#534AB7', generic: '#534AB7' };
  var accent = industryAccents[guessIndustry(sel)] || '#534AB7';
  var colInput = document.getElementById('brandColour');
  if (colInput) { colInput.value = accent; updateSwatch(accent); }

  renderScopeGrid(scope);
  document.getElementById('scopeActs').style.display = 'flex';
}

// ── Step 3: Brand form ────────────────────────────────────────────────────────
function goToBrand() {
  var overrideEl = document.getElementById('typeOverride');
  if (overrideEl && scope) scope.projectType = overrideEl.value;
  goTo(3);
  drawWheel();
  autoFillBrand();
}

// Auto-fill brand fields from proposal email using Claude API
async function autoFillBrand() {
  if (!sel) return;

  // Show loading state on all fields
  setBrandLoading(true);

  var proposalText = 'From: ' + sel.fromName + ' <' + sel.fromEmail + '>\n'
    + 'Subject: ' + sel.subject + '\n\n' + sel.snippet;

  var defaultBrand = {
    tagline:   '',
    about:     '',
    phone:     '',
    email:     sel.fromEmail || '',
    instagram: '',
    facebook:  '',
    tiktok:    '',
    logo:      '',
    hero:      guessIndustry(sel)
  };

  if (IN_CLAUDE) {
    try {
      var raw = await aiCall(
        [{ role: 'user', content: 'Extract brand and contact details from this proposal email:\n\n' + proposalText }],
        'You are extracting website content from a client proposal email for DallasTech, a web development studio.\n'
        + 'Return ONLY valid JSON with these fields (leave empty string "" if not found in the email):\n'
        + '{\n'
        + '  "tagline": "a short punchy tagline for the business (infer from context if not explicit)",\n'
        + '  "about": "2-3 sentence about blurb for the business (infer from context and industry)",\n'
        + '  "phone": "phone number if mentioned",\n'
        + '  "email": "client contact email",\n'
        + '  "instagram": "instagram URL if mentioned",\n'
        + '  "facebook": "facebook URL if mentioned",\n'
        + '  "tiktok": "tiktok URL if mentioned",\n'
        + '  "logo": "logo URL if mentioned",\n'
        + '  "hero": "1-2 word image keyword matching the industry (e.g. restaurant, flowers, gym)"\n'
        + '}\n'
        + 'No markdown, no extra text, ONLY the JSON object.'
      );
      var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      fillBrandFields(Object.assign(defaultBrand, parsed));
    } catch(e) {
      fillBrandFields(defaultBrand);
    }
  } else {
    // Offline: infer sensible defaults from email data
    var industry = guessIndustry(sel);
    var taglines = {
      restaurant: 'Exceptional dining, unforgettable evenings.',
      fitness:    'Transform your body. Change your life.',
      legal:      'Expert legal advice you can trust.',
      florist:    'Beautiful flowers for every occasion.',
      gifts:      'Handcrafted gifts, made with love.',
      generic:    'Quality service you can rely on.'
    };
    var abouts = {
      restaurant: sel.fromName + ' is a passionate dining destination serving seasonal, locally sourced cuisine in the heart of Northern Ireland. Every dish is crafted with care, creativity and the finest local ingredients.',
      fitness:    sel.fromName + ' offers expert personal training, group classes and online coaching across Northern Ireland. With a client-first approach, every programme is tailored to your goals, fitness level and lifestyle.',
      legal:      sel.fromName + ' is a trusted team of specialist solicitors serving clients across Northern Ireland. With decades of combined experience, we provide clear, practical legal advice when you need it most.',
      florist:    sel.fromName + ' creates bespoke floral arrangements for weddings, events and everyday gifting. Every piece is handcrafted with seasonal blooms and delivered with the same care and attention to detail.',
      gifts:      sel.fromName + ' specialises in personalised, handcrafted gifts and premium embroidery for individuals and businesses across Northern Ireland. Every item is made to order with love and attention to detail.',
      generic:    sel.fromName + ' provides professional, reliable services tailored to the needs of our clients. We pride ourselves on quality workmanship, honest pricing and exceptional customer care.'
    };
    defaultBrand.tagline = taglines[industry] || taglines.generic;
    defaultBrand.about   = abouts[industry]   || abouts.generic;
    defaultBrand.email   = sel.fromEmail || '';
    defaultBrand.hero    = industry;
    fillBrandFields(defaultBrand);
  }

  setBrandLoading(false);
}

function fillBrandFields(data) {
  var map = {
    bTagline:    'tagline',
    bAbout:      'about',
    bPhone:      'phone',
    bEmail:      'email',
    bInstagram:  'instagram',
    bFacebook:   'facebook',
    bTikTok:     'tiktok',
    bLogo:       'logo',
    bHeroKeyword:'hero'
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    var val = data[map[id]];
    if (el && val) el.value = val;
  });
}

function setBrandLoading(loading) {
  var fields = ['bTagline','bAbout','bPhone','bEmail','bInstagram','bFacebook','bTikTok','bLogo','bHeroKeyword'];
  var banner = document.getElementById('autoFillBanner');
  if (loading) {
    fields.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.disabled = true; el.style.opacity = '0.5'; }
    });
    if (banner) banner.style.display = 'flex';
  } else {
    fields.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.disabled = false; el.style.opacity = '1'; }
    });
    if (banner) banner.style.display = 'none';
  }
}

function getBrandData() {
  return {
    colour:    (document.getElementById('brandColour')    || {}).value || '#534AB7',
    tagline:   (document.getElementById('bTagline')       || {}).value || '',
    about:     (document.getElementById('bAbout')         || {}).value || '',
    phone:     (document.getElementById('bPhone')         || {}).value || '',
    email:     (document.getElementById('bEmail')         || {}).value || '',
    instagram: (document.getElementById('bInstagram')     || {}).value || '',
    facebook:  (document.getElementById('bFacebook')      || {}).value || '',
    tiktok:    (document.getElementById('bTikTok')        || {}).value || '',
    logo:      (document.getElementById('bLogo')          || {}).value || '',
    hero:      (document.getElementById('bHeroKeyword')   || {}).value || ''
  };
}

function validateBrand(b) {
  var missing = [];
  if (!b.colour)        missing.push('Brand colour');
  if (!b.tagline.trim()) missing.push('Tagline');
  if (!b.about.trim())   missing.push('About blurb');
  if (!b.phone.trim())   missing.push('Phone');
  if (!b.email.trim())   missing.push('Email');
  return missing;
}

async function doBrandedScaffold() {
  brand = getBrandData();
  var missing = validateBrand(brand);
  if (missing.length) {
    alert('Please fill in: ' + missing.join(', '));
    return;
  }
  await doScaffold();
}

// ── Step 4: Generate scaffold ─────────────────────────────────────────────────
async function doScaffold() {
  goTo(4);
  document.getElementById('ftree').innerHTML = '<div class="sbar"><div class="spin"></div>&nbsp;Generating scaffold...</div>';
  document.getElementById('tabRow').innerHTML = '';
  document.getElementById('codeBox').textContent = '';

  var type     = (scope && scope.projectType) || 'Bespoke Website';
  var client   = (scope && scope.clientName)  || 'Client';
  var industry = guessIndustry(sel || {});

  files = buildFallback(type, client, industry);
  files = applyBrand(files, brand, client);

  renderTree(files);
  var keys = Object.keys(files);
  renderTabs(keys);
  if (keys.length) showFile(keys[0]);
}

// ── Apply brand data to scaffold ──────────────────────────────────────────────
function applyBrand(fileMap, b, client) {
  Object.keys(fileMap).forEach(function(fname) {
    var text = fileMap[fname];

    if (fname.indexOf('.css') !== -1 && b.colour) {
      // Swap accent colour
      text = text.replace(/--accent:#[0-9a-fA-F]{6}/, '--accent:' + b.colour);
      var hex = b.colour.replace('#', '');
      var r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
      var g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
      var bv= Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
      var dk = '#' + [r, g, bv].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
      text = text.replace(/--accent-dark:#[0-9a-fA-F]{6}/, '--accent-dark:' + dk);
    }

    if (fname.indexOf('.html') !== -1) {
      if (b.tagline) text = text.replace(/Your tagline goes here[^<"']*/g, b.tagline);
      if (b.about)   text = text.replace(/2-3 sentences about the business\.[^<"']*/g, b.about);
      if (b.phone)   text = text.replace(/\+44 28 9[0-9 ]+/g, b.phone);
      if (b.email)   text = text.replace(/hello@[a-z0-9.\-]+\.co\.uk/g, b.email);
      if (b.hero)    text = text.replace(/assets\/images\/hero\.jpg/g, 'assets/images/' + b.hero.toLowerCase().replace(/\s+/g, '-') + '.jpg');

      // Social links injected before footer close
      var socials = '';
      if (b.instagram) socials += '<a href="' + b.instagram + '" target="_blank" style="color:rgba(255,255,255,.5)">Instagram</a>';
      if (b.facebook)  socials += (socials ? ' &bull; ' : '') + '<a href="' + b.facebook + '" target="_blank" style="color:rgba(255,255,255,.5)">Facebook</a>';
      if (b.tiktok)    socials += (socials ? ' &bull; ' : '') + '<a href="' + b.tiktok   + '" target="_blank" style="color:rgba(255,255,255,.5)">TikTok</a>';
      if (socials) {
        text = text.replace(
          '</nav>\n    <p class="footer-copy">',
          '</nav>\n    <div style="font-size:.85rem">' + socials + '</div>\n    <p class="footer-copy">'
        );
      }
    }

    fileMap[fname] = text;
  });
  return fileMap;
}

// ── Scaffold fallback (uses base64 data from scaffold-data.js) ────────────────
function buildFallback(type, client, industry) {
  if (type.indexOf('Native') !== -1) return buildAppScaffold(client);
  if (type.indexOf('Backend') !== -1) return buildBackendScaffold(client);
  var web = buildWebScaffold(client, industry);
  if (type.indexOf('Full') !== -1) Object.assign(web, buildBackendScaffold(client));
  return web;
}

function buildWebScaffold(client, industry) {
  var key = industry || 'generic';
  var data = SCAFFOLD_DATA[key] || SCAFFOLD_DATA['generic'];
  var out = {};
  Object.keys(data).forEach(function(fname) {
    var decoded = atob(data[fname]);
    decoded = decoded.replace(/__CLIENT__/g, client);
    out[fname] = decoded;
  });
  return out;
}

function buildBackendScaffold(c) {
  var slug = c.toLowerCase().replace(/\s+/g, '-');
  return {
    'server.js': [
      "const express = require('express');",
      "const cors = require('cors');",
      "require('dotenv').config();",
      'const app = express();',
      'const PORT = process.env.PORT || 3000;',
      'app.use(cors()); app.use(express.json());',
      "app.get('/', (req, res) => res.json({ status: 'ok', service: '" + c + " API' }));",
      "app.listen(PORT, () => console.log('Server on port ' + PORT));"
    ].join('\n'),
    'package.json': JSON.stringify({
      name: slug + '-api', version: '1.0.0', main: 'server.js',
      scripts: { start: 'node server.js', dev: 'nodemon server.js' },
      dependencies: { express: '^4.18.0', cors: '^2.8.5', dotenv: '^16.0.0' }
    }, null, 2),
    '.env.example': 'PORT=3000\nNODE_ENV=development',
    'README.md': '# ' + c + ' API\n\nNode/Express scaffold.\nnpm install && cp .env.example .env && npm run dev\nhttps://dallastech.co.uk'
  };
}

function buildAppScaffold(c) {
  var slug = c.toLowerCase().replace(/\s+/g, '-');
  return {
    'App.js': [
      "import React from 'react';",
      "import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';",
      'export default function App() {',
      '  return (',
      '    <View style={s.container}>',
      '      <Text style={s.heading}>' + c.toUpperCase() + '</Text>',
      '      <Text style={s.sub}>Built by DallasTech</Text>',
      '      <TouchableOpacity style={s.btn}><Text style={s.btnTxt}>Get started</Text></TouchableOpacity>',
      '    </View>',
      '  );',
      '}',
      'const s = StyleSheet.create({',
      "  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },",
      "  heading:   { fontSize: 48, color: '#534AB7', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },",
      "  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 },",
      "  btn:       { backgroundColor: '#534AB7', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },",
      "  btnTxt:    { color: '#fff', fontSize: 15, fontWeight: '600' }",
      '});'
    ].join('\n'),
    'package.json': JSON.stringify({
      name: slug, version: '1.0.0', main: 'node_modules/expo/AppEntry.js',
      dependencies: { expo: '~50.0.0', react: '18.2.0', 'react-native': '0.73.0' }
    }, null, 2),
    'README.md': '# ' + c + '\n\nReact Native scaffold.\nnpm install && npx expo start\nhttps://dallastech.co.uk'
  };
}

// ── File tree & code preview ──────────────────────────────────────────────────
function renderTree(f) {
  var names = Object.keys(f), dirs = [], html = '';
  names.forEach(function(n) {
    if (n.indexOf('/') !== -1) {
      var d = n.split('/')[0];
      if (dirs.indexOf(d) === -1) dirs.push(d);
    }
  });
  dirs.forEach(function(d) {
    html += '<div class="fdir">&#128193; ' + esc(d) + '/</div>';
    names.filter(function(n) { return n.startsWith(d + '/') && n.split('/').length === 2; })
         .forEach(function(n) { html += '<div class="ffile">' + esc(n.split('/').pop()) + '</div>'; });
  });
  names.filter(function(n) { return n.indexOf('/') === -1; })
       .forEach(function(n) { html += '<div class="ffile" style="padding-left:0">' + esc(n) + '</div>'; });
  document.getElementById('ftree').innerHTML = html;
}

function renderTabs(keys) {
  document.getElementById('tabRow').innerHTML = keys.slice(0, 6).map(function(k, i) {
    var safe = k.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="tab' + (i === 0 ? ' active' : '') + '" onclick="_tab(' + i + ',\'' + safe + '\')">'
         + esc(k.split('/').pop()) + '</div>';
  }).join('');
}
window._tab = function(i, k) {
  document.querySelectorAll('.tab').forEach(function(t, j) { t.classList.toggle('active', j === i); });
  showFile(k);
};
function showFile(k) {
  document.getElementById('codeBox').textContent = files[k] || '';
}

// ── Step 5: Download zip ──────────────────────────────────────────────────────
async function doZip() {
  var zip = new JSZip();
  Object.keys(files).forEach(function(name) { zip.file(name, files[name]); });
  var blob = await zip.generateAsync({ type: 'blob' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var slug = ((scope && scope.clientName) || 'project').toLowerCase().replace(/\s+/g, '-');
  a.href = url;
  a.download = slug + '-scaffold.zip';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  goTo(5);
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function doReset() {
  sel = null; scope = null; files = {}; brand = {};
  document.getElementById('gmailNote').style.display = 'none';
  goTo(1);
  loadEmails();
}

// ── Colour wheel ──────────────────────────────────────────────────────────────
var _brightness = 1;
var _wheelDrawn  = false;
var _pickerOpen  = false;

function togglePicker() {
  var w = document.getElementById('pickerWrap');
  if (!w) return;
  _pickerOpen = !_pickerOpen;
  w.style.display = _pickerOpen ? 'block' : 'none';
  if (_pickerOpen && !_wheelDrawn) { drawWheel(); _wheelDrawn = true; }
}

function drawWheel() {
  var canvas = document.getElementById('colourWheel');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cx  = canvas.width / 2, cy = canvas.height / 2, r = cx;
  var img = ctx.createImageData(canvas.width, canvas.height);
  for (var y = 0; y < canvas.height; y++) {
    for (var x = 0; x < canvas.width; x++) {
      var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        var hue = ((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 360;
        var sat = dist / r;
        var rgb = hslToRgb(hue / 360, sat, 0.5 * _brightness);
        var idx = (y * canvas.width + x) * 4;
        img.data[idx] = rgb[0]; img.data[idx+1] = rgb[1]; img.data[idx+2] = rgb[2]; img.data[idx+3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  canvas.onclick = function(e) {
    var rect = canvas.getBoundingClientRect();
    var x  = e.clientX - rect.left, y = e.clientY - rect.top;
    var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) {
      var hue = ((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 360;
      var sat = dist / r;
      var rgb = hslToRgb(hue / 360, sat, 0.5 * _brightness);
      var hex = '#' + rgb.map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
      document.getElementById('brandColour').value = hex;
      updateSwatch(hex);
    }
  };
}

function onBrightnessChange() {
  var sl = document.getElementById('brightnessSlider');
  if (sl) { _brightness = parseFloat(sl.value); _wheelDrawn = false; drawWheel(); _wheelDrawn = true; }
}

function onHexInput(val) {
  if (/^#[0-9a-fA-F]{6}$/.test(val)) updateSwatch(val);
}

function updateSwatch(hex) {
  var sw = document.getElementById('colourSwatch');
  if (sw) sw.style.background = hex;
}

function hslToRgb(h, s, l) {
  var r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  loadEmails();
});
