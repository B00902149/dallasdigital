'use strict';

var sel = null;
var scope = null;
var files = {};
var brand = {};
var WORKFLOW_STEPS = 4;

// Routes through the existing Railway proxy.
var API_BASE = window.location.origin;

// ─── PIP / NAVIGATION ─────────────────────────────────────────────────────────

function pip(n, completed) {
  var step = Math.max(1, Math.min(WORKFLOW_STEPS, n || 1));
  for (var i = 1; i <= WORKFLOW_STEPS; i++) {
    var el = document.getElementById('p' + i);
    if (!el) continue;
    var classes = ['pip-step'];
    if (i < step || (completed && i === step)) classes.push('done');
    if (i === step) classes.push('active');
    el.className = classes.join(' ');
  }
}

function goTo(n) {
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('on'); });
  var v = document.getElementById('v' + n);
  if (v) v.classList.add('on');
  pip(n);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setButtonState(id, disabled, label) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = !!disabled;
  if (label) btn.textContent = label;
}

function setHidden(id, hidden) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('is-hidden', !!hidden);
}

// ─── AI CALL ──────────────────────────────────────────────────────────────────

async function aiCall(messages, system, maxTokens) {
  var res = await fetch(API_BASE + '/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: system || '',
      messages: messages,
      max_tokens: maxTokens || 1500
    })
  });

  // Guard: if the proxy returns a non-JSON response (e.g. HTML error page on 403/405),
  // surface a clear error rather than a confusing JSON parse failure.
  var contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    var text = await res.text();
    throw new Error('API proxy returned HTTP ' + res.status + '. Response: ' + text.slice(0, 120));
  }

  var data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.content || []).map(function(b) { return b.text || ''; }).filter(Boolean).join('\n');
}

// ─── PARSE VIEW ───────────────────────────────────────────────────────────────

function initPasteView() {
  var btn = document.getElementById('parseBtn');
  var area = document.getElementById('emailPaste');
  if (!btn || !area) return;
  area.addEventListener('input', function() {
    btn.disabled = area.value.trim().length < 20;
  });
  btn.disabled = area.value.trim().length < 20;
}

async function parseEmail() {
  var area = document.getElementById('emailPaste');
  if (!area || area.value.trim().length < 20) return;

  var emailText = area.value.trim();
  setButtonState('parseBtn', true, 'Parsing with Groq...');

  sel = {
    rawText: emailText,
    fromName: '',
    fromEmail: '',
    snippet: emailText.substring(0, 200)
  };

  try {
    var raw = await aiCall(
      [{ role: 'user', content: 'Parse this proposal email:\n\n' + emailText }],
      'You are a project scoping assistant for DallasTech, a UK freelance web dev studio. '
      + 'This is an OUTBOUND proposal — written BY Adrian Dallas TO the client. '
      + 'CRITICAL: clientName is the person GREETED at the top (Dear X / Hi X). NEVER use the sign-off name (that is Adrian). '
      + 'businessName is the client venture or project name mentioned in the proposal body. '
      + 'projectType classification rules — read carefully: '
      + 'Use "React Native App" if the proposal mentions React Native, iOS, Android, mobile app, or App Store/Play Store WITHOUT a separate web frontend. '
      + 'Use "Full-Stack" ONLY if the proposal explicitly builds BOTH a mobile/web app AND a separate backend API or web frontend. '
      + 'Use "Node/Express Backend" if the proposal is purely a server, API, or backend service with no frontend. '
      + 'Use "Bespoke Website" for all other web-only projects. '
      + 'In this proposal, if React Native is in the Tech Stack and the deliverable is a mobile app, the answer is "React Native App". '
      + 'stack must list the actual technologies from the Tech Stack section, not generic defaults. '
      + 'Prefer explicit values from sections like Introduction, Understanding Your Project, Feature Breakdown, Tech Stack, Timeline Breakdown, Investment, and Existing Presence. '
      + 'Do not use generic phrases, bullet text, testimonials, or feature labels as names. '
      + 'Return ONLY valid JSON (no markdown, no extra text) with these exact fields '
      + '(use empty string "" if not found):\n'
      + '{\n'
      + '  "clientName": "full name of the client",\n'
      + '  "clientEmail": "client email address",\n'
      + '  "businessName": "business or project name",\n'
      + '  "projectType": "one of: Bespoke Website, React Native App, Node/Express Backend, Full-Stack",\n'
      + '  "industry": "one of: restaurant, fitness, legal, florist, gifts, generic",\n'
      + '  "stack": ["array","of","technologies"],\n'
      + '  "features": ["3 to 5 key features as strings"],\n'
      + '  "timeline": "project timeline if mentioned",\n'
      + '  "budget": "budget if mentioned",\n'
      + '  "tagline": "short punchy tagline inferred from the business context",\n'
      + '  "about": "2-3 sentence about blurb inferred from the business and industry",\n'
      + '  "phone": "phone number if mentioned",\n'
      + '  "instagram": "instagram URL if mentioned",\n'
      + '  "facebook": "facebook URL if mentioned",\n'
      + '  "tiktok": "tiktok URL if mentioned",\n'
      + '  "logo": "logo URL if mentioned",\n'
      + '  "hero": "1-2 word image keyword matching the industry e.g. restaurant, flowers, gym",\n'
      + '  "clientUrl": "existing website URL if mentioned, empty string if not"\n'
      + '}'
    );

    var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    var normalized = normalizeParsedProposal(parsed, emailText);

    scope = normalized.scope;

    sel.fromName = scope.clientName;
    sel.fromEmail = scope.clientEmail;
    sel.industry = scope.industry;

    var accent = industryAccent(scope.industry);
    fillBrandFields({
      tagline: normalized.brand.tagline,
      about: normalized.brand.about,
      phone: normalized.brand.phone,
      email: scope.clientEmail,
      instagram: normalized.brand.instagram,
      facebook: normalized.brand.facebook,
      tiktok: normalized.brand.tiktok,
      logo: normalized.brand.logo,
      hero: normalized.brand.hero
    });
    document.getElementById('brandColour').value = accent;
    updateSwatch(accent);
  } catch (e) {
    scope = localGuessScope(emailText);
    sel.fromName = scope.clientName;
    sel.fromEmail = scope.clientEmail;
    sel.industry = scope.industry;
    var accent2 = industryAccent(scope.industry);
    fillBrandFields({
      email: scope.clientEmail,
      hero: scope.industry
    });
    document.getElementById('brandColour').value = accent2;
    updateSwatch(accent2);
  } finally {
    setButtonState('parseBtn', false, 'Parse proposal \u203a');
  }

  renderScopeSummary(scope);
  goTo(2);
}

// ─── SCOPE SUMMARY ────────────────────────────────────────────────────────────

function renderScopeSummary(s) {
  var el = document.getElementById('scopeSummary');
  if (!el) return;
  var stack = (s.stack || []).join(', ');
  var features = (s.features || []).map(function(f) { return '&#8226; ' + esc(f); }).join('<br>');
  var timeline = esc(s.timeline || 'TBC');
  var timelineCompact = esc(compactTimeline(s.timeline || 'TBC'));
  var clientUrlDisplay = s.clientUrl
    ? '<a href="' + esc(s.clientUrl) + '" target="_blank" style="color:var(--accent)">' + esc(s.clientUrl) + '</a>'
    : '<span style="opacity:.5">None — new build</span>';

  el.style.display = 'grid';
  el.innerHTML =
      '<div class="sitem"><div class="skey">Client</div><div class="sval">' + esc(s.clientName || '-') + '</div></div>'
    + '<div class="sitem"><div class="skey">Business</div><div class="sval">' + esc(s.businessName || s.clientName || '-') + '</div></div>'
    + '<div class="sitem"><div class="skey">Project type</div><div class="sval">' + esc(s.projectType || '-') + '</div></div>'
    + '<div class="sitem"><div class="skey">Industry</div><div class="sval">' + esc(s.industry || '-') + '</div></div>'
    + '<div class="sitem"><div class="skey">Budget</div><div class="sval">' + esc(s.budget || 'TBC') + '</div></div>'
    + '<div class="sitem"><div class="skey">Timeline</div><div class="sval">' + timelineCompact + '</div><div class="smeta">' + timeline + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Existing site</div><div class="sval">' + clientUrlDisplay + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Stack</div><div class="sval">' + esc(stack || 'TBC') + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Features</div>'
    +   '<div class="sval stext-list">'
    +   features + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Override project type</div>'
    +   '<select id="typeOverride" class="type-select">'
    +     '<option value="Bespoke Website"' + (s.projectType === 'Bespoke Website' ? ' selected' : '') + '>Bespoke Website (HTML/CSS/JS)</option>'
    +     '<option value="React Native App"' + (s.projectType === 'React Native App' ? ' selected' : '') + '>React Native App</option>'
    +     '<option value="Node/Express Backend"' + (s.projectType === 'Node/Express Backend' ? ' selected' : '') + '>Node/Express Backend</option>'
    +     '<option value="Full-Stack"' + (s.projectType === 'Full-Stack' ? ' selected' : '') + '>Full-Stack (Web + Backend)</option>'
    +   '</select></div>';
}

// ─── PARSING HELPERS ──────────────────────────────────────────────────────────

function compactTimeline(value) {
  var text = cleanValue(value);
  if (!text) return 'TBC';
  var firstChunk = text.split('|')[0].trim();
  if (firstChunk.length <= 48) return firstChunk;
  var shortMatch = text.match(/\b\d+[- ]?(?:day|week|month)s?\b/i);
  if (shortMatch) return cleanValue(shortMatch[0]);
  return text.slice(0, 45) + '...';
}

function extractEmail(text) {
  var m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractClientUrl(text) {
  // Look for explicit "website" or "existing" URL mentions first
  var explicit = text.match(/(?:existing (?:website|site)|current (?:website|site)|website)[:\s]+?(https?:\/\/[^\s,\n"'<>]+)/i);
  if (explicit) return cleanValue(explicit[1]);
  // Fall back to any URL that looks like a business website (not social)
  var urls = text.match(/https?:\/\/(?!(?:www\.)?(?:instagram|facebook|tiktok|twitter|linkedin|youtube)\.)[^\s,\n"'<>]+/g);
  if (urls && urls.length) return cleanValue(urls[0]);
  return '';
}

function cleanValue(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
}

function cleanMultilineValue(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(function(line) { return cleanValue(line); })
    .filter(Boolean)
    .join('\n');
}

function titleCaseWords(value) {
  return cleanValue(value).split(/\s+/).map(function(part) {
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
  }).join(' ');
}

function looksLikePersonName(value) {
  var v = cleanValue(value);
  if (!v) return false;
  if (/\b(anywhere|anyone|someone|everyone|client|business)\b/i.test(v)) return false;
  if (/[^A-Za-z' -]/.test(v)) return false;
  var parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 3) return false;
  return parts.every(function(part) {
    return /^[A-Z][a-z]+(?:'[A-Z][a-z]+)?$/.test(part);
  });
}

function isSuspiciousName(value) {
  var v = cleanValue(value).toLowerCase();
  if (!v) return true;
  if (v.length < 3) return true;
  if (!looksLikePersonName(titleCaseWords(v))) return true;
  if (/(^feature breakdown$|^existing presence$|^understanding your project$|^satisfied clients$|^responsive design$|^contact form$|^seo$|^client$|^business$)/.test(v)) return true;
  if (/(testimonial|deliverable|feature|service|timeline|investment|support|results page|book page|call-to-action|sales funnel)/.test(v)) return true;
  return false;
}

function extractGreetingName(text) {
  // Match "Dear Name," / "Hi Name," / "Hello Name" — outbound proposal greeting
  var m = text.match(/^\s*(?:dear|hi|hello)[,\s]+([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})[,!\s]/im);
  if (m) return cleanValue(m[1]);
  // Fallback: anywhere in the text
  var m2 = text.match(/\b(?:dear|hi|hello)\s+([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\b/i);
  return m2 ? cleanValue(m2[1]) : '';
}

function extractName(text) {
  // For outbound proposals (written by Adrian TO client), the greeting is the
  // only reliable source of the client name. Never use sign-off — that's Adrian.
  var greeting = extractGreetingName(text);
  if (greeting && !isSuspiciousName(greeting)) return greeting;
  return 'Client';
}

function industryAccent(industry) {
  var map = {
    restaurant: '#c0392b',
    fitness: '#534AB7',
    legal: '#1a3a5c',
    florist: '#7c4d7e',
    gifts: '#534AB7'
  };
  return map[industry] || '#534AB7';
}

function normalizeIndustry(value, text) {
  var source = cleanValue(value).toLowerCase() + ' ' + String(text || '').toLowerCase();
  if (/(fitness|health & fitness|health and fitness|personal training|coach|coaching|gym|wellness)/.test(source)) return 'fitness';
  if (/(restaurant|cafe|menu|dining|food)/.test(source)) return 'restaurant';
  if (/(law|legal|solicitor|attorney)/.test(source)) return 'legal';
  if (/(floral|florist|flower|bouquet)/.test(source)) return 'florist';
  if (/(gift|gifts|embroid|personalised|shop)/.test(source)) return 'gifts';
  return 'generic';
}

function normalizeProjectType(value, text) {
  var t = String(text || '').toLowerCase();

  // Step 1: extract the Tech Stack section and check what's actually listed
  var stackSection = extractSection(text, 'Tech Stack').toLowerCase();
  var hasRN      = /react native/.test(stackSection) || /react native/.test(t);
  var hasMobile  = /mobile app|ios|android|app store|play store/.test(t);
  var hasWebOnly = /bespoke website|web frontend|web-only|landing page/.test(t);
  var hasBackend = /node\/express|express api|rest api|graphql api/.test(stackSection);
  var hasBothExplicit = /(full.stack|web and (mobile|backend)|mobile and web)/.test(t);

  // Step 2: rule-based classification — most specific first
  // Pure backend: has backend tech, no mobile, no web frontend
  if (hasBackend && !hasRN && !hasMobile && !hasWebOnly) return 'Node/Express Backend';
  // Explicit full-stack mention or BOTH mobile and web frontend signals
  if (hasBothExplicit) return 'Full-Stack';
  // React Native + mobile signals without explicit web frontend = RN app
  if (hasRN && hasMobile && !hasWebOnly) return 'React Native App';
  // React Native without mobile signals — still RN app
  if (hasRN && !hasWebOnly) return 'React Native App';
  // Mobile app signals without RN — could be RN or native
  if (hasMobile && !hasWebOnly) return 'React Native App';

  // Step 3: AI value as tiebreaker only when regex is ambiguous
  var aiValue = cleanValue(value).toLowerCase();
  if (aiValue === 'react native app') return 'React Native App';
  if (aiValue === 'node/express backend') return 'Node/Express Backend';
  if (aiValue === 'full-stack' || aiValue === 'full stack') return 'Full-Stack';

  return 'Bespoke Website';
}

function extractSection(text, heading) {
  var escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp(escaped + "\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Za-z&'\\- ]{2,}\\n|$)", 'i');
  var m = text.match(re);
  return m ? cleanMultilineValue(m[1]) : '';
}

function extractBusinessName(text) {
  // Ordered from most to least specific — first confident match wins
  var patterns = [
    // "vision for Al-Sanity Fitness," — most common in outbound proposals
    /vision for\s+([A-Za-z0-9][A-Za-z0-9&\'\-\. ]{1,40}?)\s*,/i,
    // "building a [native] [mobile] app/website for BusinessName,"
    /building\s+(?:a\s+)?(?:\w+\s+){0,2}(?:app|website|platform)\s+for\s+([A-Za-z0-9][A-Za-z0-9&\'\-\. ]{2,40}?)\s*[,\.]/i,
    // "propose building ... for BusinessName" 
    /propose\s+building[^.]+?for\s+([A-Za-z0-9][A-Za-z0-9&\'\-\. ]{2,40}?)[,\.\s]/i,
    // "project quote for X, your"
    /project quote for\s+([^,\n]+?)(?:,\s*your|\.)/i,
    // "proposal for/to X, your"
    /proposal (?:for|to)\s+([^,\n]+?)(?:,\s*your|\.)/i,
    // explicit field
    /business\/project:\s*([^\n]+)/i,
    // "for BusinessName, your [type] venture"
    /for\s+([A-Z][A-Za-z0-9&\' -]{2,})\s*,\s*your\s+[A-Z][A-Za-z&\' -]+ venture/i,
    // "the BusinessName mobile app/website/project" — last resort
    /the\s+([A-Za-z0-9][A-Za-z0-9&\'\-\. ]{2,40}?)\s+(?:mobile app|website|app|project)\b/i
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m) {
      var candidate = cleanValue(m[1]);
      // Must be at least 2 chars, not a generic word, not suspiciously long
      if (candidate.length >= 2 && candidate.length <= 50 && !/^(the|a|an|your|my|this|that|mobile|native|app|website)$/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return '';
}

function extractTimeline(text) {
  var section = extractSection(text, 'Timeline Breakdown');
  var monthMatch = text.match(/\b(\d+[- ]?(?:month|week)s?)\b/i);
  if (monthMatch) return cleanValue(monthMatch[1]);
  if (section) {
    var bullets = extractBulletList(section);
    if (bullets.length) return bullets.join(' | ');
    return section;
  }
  return '';
}

function extractBudget(text) {
  var section = extractSection(text, 'Investment');
  var pounds = section.match(/£\s?\d[\d,]*/g) || text.match(/£\s?\d[\d,]*/g) || [];
  if (pounds.length >= 2) return cleanValue(pounds[0] + ' - ' + pounds[1]);
  if (pounds.length === 1) return cleanValue(pounds[0]);
  return section ? cleanValue(section.split('\n')[0]) : '';
}

function extractBulletList(sectionText) {
  return String(sectionText || '')
    .split(/\r?\n/)
    .map(function(line) { return cleanValue(line.replace(/^[*\-•]\s*/, '')); })
    .filter(function(line) {
      if (!line) return false;
      // Drop only SHORT lines that look like section headings (no punctuation, under 32 chars)
      // Long clean sentences (features) must be kept even if they have no special chars
      var looksLikeHeading = /^[A-Z][A-Za-z&' -]+$/.test(line) && line.length < 32;
      return !looksLikeHeading;
    });
}

function extractStack(text) {
  var section = extractSection(text, 'Tech Stack');
  var bullets = extractBulletList(section).map(function(item) {
    // Split on " for ", " to ", " -" to strip the description and keep only the tech name
    var tech = item.split(/\s+for\s+|\s+to\s+|\s+-\s+/i)[0];
    // Also split on colon (e.g. "React Native: cross-platform")
    tech = tech.split(':')[0];
    tech = cleanValue(tech);
    return titleCaseWords(tech.replace(/front-end/i, 'Front-end').replace(/back-end/i, 'Back-end'));
  }).filter(function(item) {
    return item && item.length >= 2 && item.length <= 30 && !/^(to|for|and|the|a|an)$/i.test(item);
  });
  return bullets.length ? bullets : [];
}

function extractFeatures(text) {
  var section = extractSection(text, 'Feature Breakdown');
  var bullets = extractBulletList(section).map(function(item) {
    return cleanValue(item.replace(/^[^:]+:\s*/, function(match) {
      return match.replace(/:\s*$/, '');
    }));
  }).filter(function(item) {
    // Drop intro/preamble sentences (end with colon, or contain 'following', 'include', 'below')
    if (/(?:following|included|include|below|the app)[:\s]*$/i.test(item)) return false;
    // Must be at least 10 chars to be a real feature
    return item && item.length >= 10;
  });
  if (bullets.length) {
    return bullets.slice(0, 8).map(function(item) {
      var parts = item.split(':');
      return cleanValue(parts.length > 1 ? parts[0] + ': ' + parts.slice(1).join(':') : item);
    }).filter(function(item) {
      return item && item.length <= 180;
    });
  }
  return [];
}

function extractSocialHandle(text, label) {
  var re = new RegExp(label + '\\s*:?\\s*(@[A-Za-z0-9._]+|https?:\\/\\/[^\\s]+)', 'i');
  var m = text.match(re);
  if (!m) return '';
  var value = cleanValue(m[1]);
  if (value.charAt(0) === '@') {
    var base = label.toLowerCase() === 'instagram' ? 'https://instagram.com/' : 'https://tiktok.com/@';
    return label.toLowerCase() === 'instagram'
      ? base + value.slice(1)
      : base + value.slice(1);
  }
  return value;
}

function inferTagline(businessName, industry) {
  if (industry === 'fitness') return 'Personal coaching to help clients live their strongest life';
  if (industry === 'restaurant') return 'Fresh food and memorable dining experiences';
  if (industry === 'legal') return 'Trusted legal guidance with a personal approach';
  if (industry === 'florist') return 'Thoughtful floral design for every occasion';
  if (industry === 'gifts') return 'Meaningful personalised products made to delight';
  return businessName ? businessName + ' brought to life online' : '';
}

function inferAbout(text, businessName, industry) {
  var understanding = extractSection(text, 'Understanding Your Project');
  if (understanding) return understanding;
  if (industry === 'fitness') {
    return businessName + ' is a health and fitness business focused on personalised coaching, client results, and building a strong supportive community online.';
  }
  return '';
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map(cleanValue).filter(Boolean);
  if (!value) return [];
  return String(value).split(/,|\n/).map(cleanValue).filter(function(item) {
    return item && item.length <= 160;
  });
}

function normalizeParsedProposal(parsed, text) {
  var recipientName = extractGreetingName(text) || extractName(text);
  var businessName = cleanValue(parsed.businessName) || extractBusinessName(text);
  var industry = normalizeIndustry(parsed.industry, text);
  var projectType = normalizeProjectType(parsed.projectType, text);
  var clientName = cleanValue(parsed.clientName);
  if (isSuspiciousName(clientName)) clientName = recipientName;
  if (isSuspiciousName(clientName) && businessName) clientName = businessName;

  var stack = normalizeStringList(parsed.stack);
  if (!stack.length) stack = extractStack(text);
  if (!stack.length) {
    // Default stack based on project type rather than always HTML/CSS/JS
    var pt = cleanValue(parsed.projectType).toLowerCase();
    if (pt.indexOf('native') !== -1) {
      stack = ['React Native', 'Expo', 'Node.js'];
    } else if (pt.indexOf('backend') !== -1) {
      stack = ['Node.js', 'Express', 'MongoDB'];
    } else if (pt.indexOf('full') !== -1) {
      stack = ['React Native', 'Node.js', 'Express', 'MongoDB'];
    } else {
      stack = ['HTML', 'CSS', 'JS'];
    }
  }

  var features = normalizeStringList(parsed.features);
  // Always attempt regex extraction from raw text — use whichever gives more features
  var extractedFeatures = extractFeatures(text);
  if (extractedFeatures.length > features.length) features = extractedFeatures;
  // Fall back to AI result only if regex found nothing
  if (!features.length) features = normalizeStringList(parsed.features);
  // Last resort defaults only for truly empty proposals
  if (!features.length) features = ['Custom design', 'Mobile responsive', 'Contact form'];

  var timeline = cleanValue(parsed.timeline) || extractTimeline(text) || 'TBC';
  var budget = cleanValue(parsed.budget) || extractBudget(text) || 'TBC';
  var clientEmail = cleanValue(parsed.clientEmail) || extractEmail(text);

  // clientUrl: prefer AI-parsed value, fall back to regex extraction from raw text
  var clientUrl = cleanValue(parsed.clientUrl) || extractClientUrl(text);

  var brandData = {
    tagline: cleanValue(parsed.tagline) || inferTagline(businessName, industry),
    about: cleanValue(parsed.about) || inferAbout(text, businessName || clientName, industry),
    phone: cleanValue(parsed.phone),
    instagram: cleanValue(parsed.instagram) || extractSocialHandle(text, 'Instagram'),
    facebook: cleanValue(parsed.facebook),
    tiktok: cleanValue(parsed.tiktok) || extractSocialHandle(text, 'TikTok'),
    logo: cleanValue(parsed.logo),
    hero: cleanValue(parsed.hero) || industry
  };

  return {
    scope: {
      clientName: clientName || 'Client',
      clientEmail: clientEmail,
      businessName: businessName,
      projectType: projectType,
      industry: industry,
      stack: stack,
      features: features,
      timeline: timeline,
      budget: budget,
      clientUrl: clientUrl
    },
    brand: brandData
  };
}

function localGuessScope(text) {
  return normalizeParsedProposal({}, text).scope;
}

// ─── BRAND VIEW ───────────────────────────────────────────────────────────────

function goToBrand() {
  if (!scope) {
    alert('Please parse a proposal before continuing to brand and content.');
    goTo(1);
    return;
  }
  var overrideEl = document.getElementById('typeOverride');
  if (overrideEl) scope.projectType = overrideEl.value;
  goTo(3);
  drawWheel();
}

function fillBrandFields(data) {
  var map = {
    bTagline: 'tagline',
    bAbout: 'about',
    bPhone: 'phone',
    bEmail: 'email',
    bInstagram: 'instagram',
    bFacebook: 'facebook',
    bTikTok: 'tiktok',
    bLogo: 'logo',
    bHeroKeyword: 'hero'
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    var val = data[map[id]];
    if (el && val) el.value = val;
  });
}

function getBrandData() {
  return {
    colour: (document.getElementById('brandColour') || {}).value || '#534AB7',
    tagline: (document.getElementById('bTagline') || {}).value || '',
    about: (document.getElementById('bAbout') || {}).value || '',
    phone: (document.getElementById('bPhone') || {}).value || '',
    email: (document.getElementById('bEmail') || {}).value || '',
    instagram: (document.getElementById('bInstagram') || {}).value || '',
    facebook: (document.getElementById('bFacebook') || {}).value || '',
    tiktok: (document.getElementById('bTikTok') || {}).value || '',
    logo: (document.getElementById('bLogo') || {}).value || '',
    hero: (document.getElementById('bHeroKeyword') || {}).value || ''
  };
}

function validateBrand(b) {
  var missing = [];
  if (!b.colour) missing.push('Brand colour');
  if (!b.tagline.trim()) missing.push('Tagline');
  if (!b.about.trim()) missing.push('About blurb');
  if (!b.phone.trim()) missing.push('Phone');
  if (!b.email.trim()) missing.push('Email');
  return missing;
}

// ─── SCAFFOLD ─────────────────────────────────────────────────────────────────

async function doBrandedScaffold() {
  if (!scope) {
    alert('Please parse a proposal before generating a scaffold.');
    goTo(1);
    return;
  }
  brand = getBrandData();
  var missing = validateBrand(brand);
  if (missing.length) {
    alert('Please fill in: ' + missing.join(', '));
    return;
  }
  setButtonState('generateBtn', true, 'Generating scaffold...');
  try {
    await doScaffold();
  } finally {
    setButtonState('generateBtn', false, 'Generate scaffold \u203a');
  }
}

async function doScaffold() {
  goTo(4);
  setHidden('previewCard', false);
  setHidden('downloadActions', false);
  document.getElementById('ftree').innerHTML = '<div class="sbar"><div class="spin"></div>&nbsp;Generating scaffold...</div>';
  document.getElementById('tabRow').innerHTML = '';
  document.getElementById('codeBox').textContent = '';

  var type = (scope && scope.projectType) || 'Bespoke Website';
  var client = (scope && scope.clientName) || 'Client';
  var industry = (scope && scope.industry) || 'generic';

  files = buildFallback(type, client, industry);
  files = applyBrand(files, brand, scope, client);

  renderTree(files);
  var keys = Object.keys(files);
  renderTabs(keys);
  if (keys.length) showFile(keys[0]);

  // Inject per-page developer briefs into HTML files as comment blocks
  injectBriefs();
}

// ─── PER-PAGE BRIEF INJECTION ────────────────────────────────────────────────
// Makes one small Groq call per HTML page. Response is a plain-text developer
// brief (components, copy direction, SEO) injected as an HTML comment block at
// the top of each file. Small payload per call = no proxy 405 errors.

var PAGE_BRIEF_SYSTEM = 'You are a senior web developer writing a concise developer brief. '
  + 'Given a page name, industry, and project features, return a plain-text block (no JSON, no markdown) '
  + 'with exactly these four labelled sections separated by newlines: '
  + 'COMPONENTS: comma-separated list of UI components needed on this page. '
  + 'COPY: 1-2 sentences of suggested headline and subheading copy for this page. '
  + 'SEO: meta title (under 60 chars) and meta description (under 155 chars), each on its own line. '
  + 'CHECKLIST: 3-5 short must-have items for this page as a dash list. '
  + 'Be specific to the industry and business. No preamble, no sign-off.';

async function injectBriefs() {
  var htmlFiles = Object.keys(files).filter(function(f) { return f.indexOf('.html') !== -1; });
  if (!htmlFiles.length) return;

  var briefStatus = document.getElementById('briefStatus');
  if (briefStatus) briefStatus.textContent = 'Generating developer briefs...';

  var industry   = (scope && scope.industry)    || 'generic';
  var business   = (scope && scope.businessName) || (scope && scope.clientName) || 'Client';
  var features   = (scope && scope.features || []).slice(0, 5).join(', ') || 'standard website features';
  var projectType = (scope && scope.projectType) || 'Bespoke Website';

  for (var i = 0; i < htmlFiles.length; i++) {
    var fname = htmlFiles[i];
    var pageName = fname.replace(/^.*\//, '').replace('.html', '') || 'index';

    var prompt = 'Page: ' + pageName + '\n'
      + 'Business: ' + business + '\n'
      + 'Industry: ' + industry + '\n'
      + 'Project type: ' + projectType + '\n'
      + 'Key features: ' + features;

    try {
      var brief = await aiCall(
        [{ role: 'user', content: prompt }],
        PAGE_BRIEF_SYSTEM,
        400
      );

      var commentBlock = [
        '<!--',
        '================================================================',
        'DEVELOPER BRIEF — ' + pageName.toUpperCase() + '.html',
        'Generated by DevAgent for ' + business,
        '================================================================',
        brief.trim(),
        '================================================================',
        '-->'
      ].join('\n');

      files[fname] = commentBlock + '\n\n' + files[fname];

      // Refresh preview if this tab is active
      var activeTab = document.querySelector('.tab.active');
      if (activeTab && activeTab.textContent.trim() === fname.split('/').pop()) {
        showFile(fname);
      }
    } catch (e) {
      // Brief failed for this page — skip silently, scaffold is still valid
      console.warn('Brief failed for ' + fname + ':', e.message);
    }
  }

  if (briefStatus) briefStatus.textContent = 'Briefs ready — open any HTML file in VS Code.';

  // Refresh tree to show updated file sizes
  renderTree(files);
}

// ─── SCAFFOLD PREVIEW ──────────────────────────────────────────────────────

function applyBrand(fileMap, b, scopeData, client) {
  Object.keys(fileMap).forEach(function(fname) {
    var text = fileMap[fname];

    if (fname.indexOf('.css') !== -1 && b.colour) {
      text = text.replace(/--accent:#[0-9a-fA-F]{6}/, '--accent:' + b.colour);
      var hex = b.colour.replace('#', '');
      var r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
      var g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
      var bv = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
      var dk = '#' + [r, g, bv].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
      text = text.replace(/--accent-dark:#[0-9a-fA-F]{6}/, '--accent-dark:' + dk);
    }

    if (fname.indexOf('.html') !== -1) {
      if (b.tagline) text = text.replace(/Your tagline goes here[^<"']*/g, b.tagline);
      if (b.about) text = text.replace(/2-3 sentences about the business\.[^<"']*/g, b.about);
      if (b.phone) text = text.replace(/\+44 28 9[0-9 ]+/g, b.phone);
      if (b.email) text = text.replace(/hello@[a-z0-9.\-]+\.co\.uk/g, b.email);
      if (b.hero) text = text.replace(/assets\/images\/[a-z]+\.jpg/g, 'assets/images/' + b.hero.toLowerCase().replace(/\s+/g, '-') + '.jpg');
      text = applyProposalContent(text, b, scopeData, client);

      var socials = '';
      if (b.instagram) socials += '<a href="' + b.instagram + '" target="_blank" style="color:rgba(255,255,255,.5)">Instagram</a>';
      if (b.facebook) socials += (socials ? ' &bull; ' : '') + '<a href="' + b.facebook + '" target="_blank" style="color:rgba(255,255,255,.5)">Facebook</a>';
      if (b.tiktok) socials += (socials ? ' &bull; ' : '') + '<a href="' + b.tiktok + '" target="_blank" style="color:rgba(255,255,255,.5)">TikTok</a>';
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

function applyProposalContent(text, b, scopeData, client) {
  if (!scopeData || !text) return text;

  var featureCards = buildFeatureCards(scopeData, b, 0, 3);
  var aboutSection = buildAboutSection(scopeData, b);
  var benefitCards = buildBenefitCards(scopeData, b);
  var contactOptions = buildContactOptions(scopeData, b);
  var heroEyebrow = buildHeroEyebrow(scopeData, b);
  var heroHeadline = buildHeroHeadline(scopeData, b, client);
  var heroCopy = esc(b.tagline || b.about || 'A custom website tailored to your business goals.');

  text = text.replace(/Northern Ireland's #1 PT/g, heroEyebrow);
  text = text.replace(/<h1>[\s\S]*?<\/h1>/, '<h1>' + heroHeadline + '</h1>');
  text = text.replace(/<p>Your tagline goes here\.<\/p>/, '<p>' + heroCopy + '</p>');
  text = text.replace(/Start Your Journey/g, 'Book A Consultation');
  text = text.replace(/See Results/g, 'Explore More');

  if (featureCards) {
    text = text.replace(/<p class="section-tag" style="text-align:center">What I Offer<\/p>/, '<p class="section-tag" style="text-align:center">Highlights</p>');
    text = text.replace(/<h2 style="text-align:center;margin-bottom:3rem">Training Programmes<\/h2>/, '<h2 style="text-align:center;margin-bottom:3rem">Built Around Your Goals</h2>');
    text = text.replace(/<div class="grid-3">[\s\S]*?<\/div>\s*<\/div><\/section>/, featureCards + '\n  </div></section>');
  }

  if (aboutSection) {
    text = text.replace(/<p class="section-tag" style="text-align:center">Schedule<\/p>/, '<p class="section-tag" style="text-align:center">About</p>');
    text = text.replace(/<h2 style="text-align:center;margin-bottom:2.5rem">Weekly Timetable<\/h2>/, '<h2 style="text-align:center;margin-bottom:2.5rem">A Personal Approach</h2>');
    text = text.replace(/<div style="overflow-x:auto" data-anim>[\s\S]*?<\/div>\s*<\/div><\/section>/, aboutSection + '\n  </div></section>');
  }

  if (benefitCards) {
    text = text.replace(/<p class="section-tag" style="text-align:center">Transformations<\/p>/, '<p class="section-tag" style="text-align:center">Why Choose Us</p>');
    text = text.replace(/<h2 style="text-align:center;margin-bottom:2.5rem">Real Results<\/h2>/, '<h2 style="text-align:center;margin-bottom:2.5rem">Support That Keeps You Moving</h2>');
    text = text.replace(/<div class="grid-3">\s*<div class="testimonial"[\s\S]*?<\/div>\s*<\/div><\/section>/, benefitCards + '\n  </div></section>');
  }

  text = text.replace(/<h2 style="color:#fff;text-align:center;margin-bottom:.75rem">Free Consultation<\/h2>/, '<h2 style="color:#fff;text-align:center;margin-bottom:.75rem">Book A Consultation</h2>');
  text = text.replace(/No commitment &mdash; just a 30-minute chat about your goals\./, 'Tell us about your goals and we&apos;ll help you take the next step with confidence.');
  text = text.replace(/<select required><option value="">I&apos;m interested in\.\.\.<\/option>[\s\S]*?<\/select>/, contactOptions);
  text = text.replace(/Tell me about your goals\.\.\./, 'Tell me about your goals...');
  text = text.replace(/Book Free Consultation/g, 'Book A Consultation');

  return text;
}

function buildHeroEyebrow(scopeData, brandData) {
  var business = esc(scopeData.businessName || '');
  var industry = scopeData.industry === 'fitness' ? 'ONLINE FITNESS COACHING' : (scopeData.projectType || 'CUSTOM WEBSITE');
  return business ? business.toUpperCase() + ' \u2022 ' + industry : industry;
}

function buildHeroHeadline(scopeData, brandData, client) {
  var source = cleanValue((brandData && brandData.tagline) || '');
  if (scopeData && scopeData.industry === 'fitness') {
    if (/strongest life/i.test(source)) return 'LIVE STRONGER.<br>FEEL BETTER.';
    return 'PERSONAL COACHING.<br>REAL RESULTS.';
  }
  if (/results/i.test(source)) return 'BUILD A BRAND<br>THAT CONVERTS.';
  var business = cleanValue(scopeData.businessName || client || '');
  if (business) return esc(business.toUpperCase().replace(/\s+/g, ' '));
  return 'CUSTOM WEBSITE.<br>CLEAR RESULTS.';
}

function buildFeatureItems(features) {
  return (features || []).map(function(item) {
    var cleaned = cleanValue(item);
    if (!cleaned) return null;
    var parts = cleaned.split(':');
    var title = cleanValue(parts[0] || 'Feature');
    var body = cleanValue(parts.slice(1).join(':')) || 'Tailored to the project scope and business goals.';
    return { title: title, body: body };
  }).filter(Boolean);
}

function buildFeatureCards(scopeData, brandData, start, count) {
  var items = scopeData && scopeData.industry === 'fitness'
    ? buildFitnessServiceItems(scopeData, brandData).slice(start, start + count)
    : buildFeatureItems((scopeData && scopeData.features) || []).slice(start, start + count);
  if (!items.length) return '';
  return '<div class="grid-3">\n' + items.map(function(item, index) {
    var accent = item.meta ? '<p style="font-weight:700;color:var(--accent);margin-top:1rem">' + esc(item.meta) + '</p>' : '';
    return '      <div class="card" data-anim' + (index ? ' data-anim-delay="' + index + '"' : '') + '><div class="card-icon">' + item.icon + '</div><h3>' + esc(item.title) + '</h3><p style="color:var(--muted);font-size:.9rem;margin-bottom:0">' + esc(item.body) + '</p>' + accent + '</div>';
  }).join('\n') + '\n    </div>';
}

function buildFitnessServiceItems(scopeData, brandData) {
  var featureText = ((scopeData && scopeData.features) || []).join(' ').toLowerCase();
  var items = [
    {
      icon: '&#127947;',
      title: 'Personal Coaching',
      body: featureText.indexOf('book') !== -1
        ? 'Flexible coaching sessions designed around your lifestyle, schedule, and goals.'
        : 'One-to-one guidance built to help you train with clarity, structure, and confidence.',
      meta: 'Tailored support'
    },
    {
      icon: '&#128640;',
      title: 'Results-Focused Programmes',
      body: featureText.indexOf('results') !== -1
        ? 'Clear training pathways, visible progress, and accountability that keeps momentum high.'
        : 'Structured plans created to help clients stay consistent and move toward meaningful results.',
      meta: 'Built for progress'
    },
    {
      icon: '&#128101;',
      title: 'Supportive Community',
      body: featureText.indexOf('community') !== -1 || featureText.indexOf('sales funnel') !== -1
        ? 'A welcoming client journey that encourages commitment, motivation, and long-term progress.'
        : 'An encouraging experience that helps clients feel supported from their first enquiry onward.',
      meta: 'Confidence and consistency'
    }
  ];

  var business = cleanValue((scopeData && scopeData.businessName) || '');
  if (business) {
    items[0].body = business + ' offers a more personal route to coaching, built around real life and sustainable progress.';
  }

  var tagline = cleanValue((brandData && brandData.tagline) || '');
  if (tagline) {
    items[2].body = tagline + '. Every touchpoint is shaped to feel motivating, clear, and approachable.';
  }

  return items;
}

function buildAboutSection(scopeData, brandData) {
  var about = esc((brandData && brandData.about) || '');
  if (!about) return '';
  var pillars = scopeData && scopeData.industry === 'fitness'
    ? buildFitnessSupportItems(scopeData, brandData)
    : buildBenefitItems(scopeData, brandData).slice(0, 3);
  if (!pillars.length) {
    pillars = [{ title: 'Tailored Support', body: 'A client-first experience built around clear guidance, confidence, and momentum.' }];
  }
  return '<div class="grid-2" style="align-items:start;gap:2rem">\n'
    + '      <div data-anim><p style="font-size:1rem;line-height:1.9;color:var(--muted);max-width:520px">' + about + '</p></div>\n'
    + '      <div class="grid-2">' + pillars.map(function(item, index) {
      return '<div class="card" data-anim' + (index ? ' data-anim-delay="' + index + '"' : '') + '><h3>' + esc(item.title) + '</h3><p style="color:var(--muted);font-size:.92rem;margin-bottom:0">' + esc(item.body) + '</p></div>';
    }).join('') + '</div>\n'
    + '    </div>';
}

function buildBenefitItems(scopeData, brandData) {
  var items = [];
  var tagline = cleanValue((brandData && brandData.tagline) || '');
  if (tagline) {
    items.push({ title: 'Personal Support', body: tagline });
  }
  if ((scopeData.features || []).length) {
    var featureItems = buildFeatureItems(scopeData.features).slice(0, 2);
    featureItems.forEach(function(item) {
      items.push({ title: item.title, body: item.body });
    });
  }
  if (scopeData.industry === 'fitness') {
    items.push({ title: 'Sustainable Progress', body: 'Designed to help clients stay consistent, confident, and focused on meaningful results.' });
  }
  return items.slice(0, 3);
}

function buildFitnessSupportItems(scopeData, brandData) {
  var business = cleanValue((scopeData && scopeData.businessName) || 'This coaching approach');
  var tagline = cleanValue((brandData && brandData.tagline) || '');
  return [
    {
      title: 'Tailored Coaching',
      body: business + ' is designed around personalised guidance, practical structure, and sustainable progress.'
    },
    {
      title: 'Flexible Support',
      body: 'From first enquiry to ongoing sessions, every step is built to feel clear, approachable, and easy to follow.'
    },
    {
      title: 'Motivation That Lasts',
      body: tagline ? tagline + '.' : 'Encouragement, accountability, and real support help clients stay consistent over time.'
    }
  ];
}

function buildBenefitCards(scopeData, brandData) {
  var items = scopeData && scopeData.industry === 'fitness'
    ? buildFitnessWhyChooseItems(scopeData, brandData)
    : buildBenefitItems(scopeData, brandData);
  if (!items.length) return '';
  return '<div class="grid-3">\n' + items.map(function(item, index) {
    return '      <div class="card" data-anim' + (index ? ' data-anim-delay="' + index + '"' : '') + '><div class="card-icon">&#10022;</div><h3>' + esc(item.title) + '</h3><p style="color:var(--muted);font-size:.92rem;margin-bottom:0">' + esc(item.body) + '</p></div>';
  }).join('\n') + '\n    </div>';
}

function buildFitnessWhyChooseItems(scopeData, brandData) {
  return [
    {
      title: 'Clear Guidance',
      body: 'Clients get a straightforward path forward, with coaching that feels structured, supportive, and easy to trust.'
    },
    {
      title: 'Personal Accountability',
      body: 'Every interaction is shaped to help clients stay committed, build momentum, and keep moving with confidence.'
    },
    {
      title: 'Results With Balance',
      body: 'The experience is built around real life, helping clients pursue progress in a way that feels motivating and sustainable.'
    }
  ];
}

function buildContactOptions(scopeData, brandData) {
  var items = [];
  if (scopeData.industry === 'fitness') {
    items = ['1-to-1 Coaching', 'Online Coaching', 'Results Support'];
  } else {
    items = buildFeatureItems(scopeData.features).slice(0, 3).map(function(item) { return item.title; });
  }
  var options = items.map(function(item) {
    return '<option>' + esc(item) + '</option>';
  }).join('');
  if (!options) {
    options = '<option>General Enquiry</option><option>Consultation</option>';
  }
  return '<select required><option value="">I&apos;m interested in...</option>' + options + '<option>General Enquiry</option></select>';
}

// ─── SCAFFOLD BUILDERS ────────────────────────────────────────────────────────

function buildFallback(type, client, industry) {
  if (type.indexOf('Native') !== -1) return buildAppScaffold(client);
  if (type.indexOf('Backend') !== -1) return buildBackendScaffold(client);
  var web = buildWebScaffold(client, industry);
  if (type.indexOf('Full') !== -1) Object.assign(web, buildBackendScaffold(client));
  return web;
}

function buildWebScaffold(client, industry) {
  var data = SCAFFOLD_DATA[industry] || SCAFFOLD_DATA.generic;
  var out = {};
  Object.keys(data).forEach(function(fname) {
    out[fname] = atob(data[fname]).replace(/__CLIENT__/g, client);
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
      "app.get('/', (req,res) => res.json({ status:'ok', service:'" + c + " API' }));",
      "app.listen(PORT, () => console.log('Server on port '+PORT));"
    ].join('\n'),
    'package.json': JSON.stringify({
      name: slug + '-api',
      version: '1.0.0',
      main: 'server.js',
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
      'export default function App() { return (',
      '  <View style={s.c}><Text style={s.h}>' + c.toUpperCase() + '</Text>',
      '  <Text style={s.sub}>Built by DallasTech</Text>',
      '  <TouchableOpacity style={s.btn}><Text style={s.bt}>Get started</Text></TouchableOpacity>',
      '  </View>); }',
      'const s=StyleSheet.create({',
      "  c:{flex:1,backgroundColor:'#0a0a0a',alignItems:'center',justifyContent:'center',padding:24},",
      "  h:{fontSize:48,color:'#534AB7',fontWeight:'bold',textAlign:'center',marginBottom:8},",
      "  sub:{fontSize:14,color:'rgba(255,255,255,0.4)',marginBottom:32},",
      "  btn:{backgroundColor:'#534AB7',paddingVertical:14,paddingHorizontal:32,borderRadius:8},",
      "  bt:{color:'#fff',fontSize:15,fontWeight:'600'}});"
    ].join('\n'),
    'package.json': JSON.stringify({
      name: slug,
      version: '1.0.0',
      main: 'node_modules/expo/AppEntry.js',
      dependencies: { expo: '~50.0.0', react: '18.2.0', 'react-native': '0.73.0' }
    }, null, 2),
    'README.md': '# ' + c + '\n\nReact Native scaffold.\nnpm install && npx expo start\nhttps://dallastech.co.uk'
  };
}

// ─── FILE PREVIEW ─────────────────────────────────────────────────────────────

function renderTree(f) {
  var names = Object.keys(f);
  var dirs = [];
  var html = '';
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
    return '<div class="tab' + (i === 0 ? ' active' : '') + '" onclick="_tab(' + i + ',\'' + safe + '\')">' + esc(k.split('/').pop()) + '</div>';
  }).join('');
}

window._tab = function(i, k) {
  document.querySelectorAll('.tab').forEach(function(t, j) { t.classList.toggle('active', j === i); });
  showFile(k);
};

function showFile(k) {
  document.getElementById('codeBox').textContent = files[k] || '';
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────

async function doZip() {
  if (!Object.keys(files).length) {
    alert('Generate a scaffold before downloading the zip.');
    goTo(scope ? 3 : 1);
    return;
  }

  setButtonState('downloadBtn', true, 'Preparing zip...');

  try {

    var zip = new JSZip();
    Object.keys(files).forEach(function(name) { zip.file(name, files[name]); });
    var blob = await zip.generateAsync({ type: 'blob' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var slug = ((scope && scope.clientName) || 'project').toLowerCase().replace(/\s+/g, '-');
    a.href = url;
    a.download = slug + '-scaffold.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    document.getElementById('ftree').innerHTML =
      '<div style="text-align:center;padding:2rem">'
      + '<div style="font-size:36px;margin-bottom:12px">&#10003;</div>'
      + '<div style="font-size:15px;font-weight:500;margin-bottom:6px">Scaffold downloaded</div>'
      + '<div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:1.5rem">Your project files are ready. Start building.</div>'
      + '<button class="btn btn-p" onclick="doReset()">Start another project</button>'
      + '</div>';
    document.getElementById('tabRow').innerHTML = '';
    document.getElementById('codeBox').textContent = '';
    setHidden('previewCard', true);
    setHidden('downloadActions', true);
    pip(4, true);
  } finally {
    setButtonState('downloadBtn', false, 'Download zip');
  }
}

// ─── RESET ────────────────────────────────────────────────────────────────────

function doReset() {
  sel = null;
  scope = null;
  files = {};
  brand = {};

  var area = document.getElementById('emailPaste');
  if (area) area.value = '';

  var sum = document.getElementById('scopeSummary');
  if (sum) {
    sum.innerHTML = '';
    sum.style.display = 'none';
  }

  var tree = document.getElementById('ftree');
  if (tree) tree.innerHTML = '';
  setHidden('previewCard', false);
  setHidden('downloadActions', false);
  var tabs = document.getElementById('tabRow');
  if (tabs) tabs.innerHTML = '';
  var code = document.getElementById('codeBox');
  if (code) code.textContent = '';

  ['bTagline', 'bAbout', 'bPhone', 'bEmail', 'bInstagram', 'bFacebook', 'bTikTok', 'bLogo', 'bHeroKeyword'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });

  var colourInput = document.getElementById('brandColour');
  if (colourInput) colourInput.value = '#534AB7';
  var picker = document.getElementById('pickerWrap');
  if (picker) picker.style.display = 'none';
  var slider = document.getElementById('brightnessSlider');
  if (slider) slider.value = '1';

  _brightness = 1;
  _wheelDrawn = false;
  _pickerOpen = false;

  updateSwatch('#534AB7');
  setButtonState('parseBtn', true, 'Parse proposal \u203a');
  setButtonState('generateBtn', false, 'Generate scaffold \u203a');
  setButtonState('downloadBtn', false, 'Download zip');
  goTo(1);
}

// ─── COLOUR PICKER ────────────────────────────────────────────────────────────

var _brightness = 1;
var _wheelDrawn = false;
var _pickerOpen = false;

function togglePicker() {
  var w = document.getElementById('pickerWrap');
  if (!w) return;
  _pickerOpen = !_pickerOpen;
  w.style.display = _pickerOpen ? 'block' : 'none';
  if (_pickerOpen && !_wheelDrawn) {
    drawWheel();
    _wheelDrawn = true;
  }
}

function drawWheel() {
  var canvas = document.getElementById('colourWheel');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var r = cx;
  var img = ctx.createImageData(canvas.width, canvas.height);

  for (var y = 0; y < canvas.height; y++) {
    for (var x = 0; x < canvas.width; x++) {
      var dx = x - cx;
      var dy = y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        var hue = ((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 360;
        var rgb = hslToRgb(hue / 360, dist / r, 0.5 * _brightness);
        var idx = (y * canvas.width + x) * 4;
        img.data[idx] = rgb[0];
        img.data[idx + 1] = rgb[1];
        img.data[idx + 2] = rgb[2];
        img.data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  canvas.onclick = function(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var dx = x - cx;
    var dy = y - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= r) {
      var hue = ((Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1) * 360;
      var rgb = hslToRgb(hue / 360, dist / r, 0.5 * _brightness);
      var hex = '#' + rgb.map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
      document.getElementById('brandColour').value = hex;
      updateSwatch(hex);
    }
  };
}

function onBrightnessChange() {
  var sl = document.getElementById('brightnessSlider');
  if (sl) {
    _brightness = parseFloat(sl.value);
    _wheelDrawn = false;
    drawWheel();
    _wheelDrawn = true;
  }
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
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function() {
  initPasteView();
  updateSwatch('#534AB7');
});