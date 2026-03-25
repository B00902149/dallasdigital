'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
var sel   = null;
var scope = null;
var files = {};
var brand = {};

// Routes through your existing Railway Groq proxy
var API_BASE = window.location.origin;

// ── Pipeline helpers ──────────────────────────────────────────────────────────
function pip(n) {
  for (var i = 1; i <= 4; i++) {
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
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── API: Groq via Railway proxy ───────────────────────────────────────────────
async function aiCall(messages, system) {
  var res = await fetch(API_BASE + '/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: system || '', messages: messages, max_tokens: 1500 })
  });
  var data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.content || []).map(function(b) { return b.text || ''; }).filter(Boolean).join('\n');
}

// ── Step 1: Paste & parse ─────────────────────────────────────────────────────
function initPasteView() {
  var btn  = document.getElementById('parseBtn');
  var area = document.getElementById('emailPaste');
  if (!btn || !area) return;
  area.addEventListener('input', function() {
    btn.disabled = area.value.trim().length < 20;
  });
}

async function parseEmail() {
  var area = document.getElementById('emailPaste');
  if (!area || area.value.trim().length < 20) return;

  var emailText = area.value.trim();
  var btn = document.getElementById('parseBtn');
  btn.disabled = true;
  btn.textContent = 'Parsing with Groq…';

  sel = { rawText: emailText, fromName: '', fromEmail: '', snippet: emailText.substring(0, 200) };

  try {
    var raw = await aiCall(
      [{ role: 'user', content: 'Parse this proposal email:\n\n' + emailText }],
      'You are a project scoping assistant for DallasTech, a UK freelance web dev studio. '
      + 'Extract all available information from this proposal email. '
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
      + '  "hero": "1-2 word image keyword matching the industry e.g. restaurant, flowers, gym"\n'
      + '}'
    );

    var parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    scope = {
      clientName:   parsed.clientName   || extractName(emailText),
      clientEmail:  parsed.clientEmail  || extractEmail(emailText),
      businessName: parsed.businessName || '',
      projectType:  parsed.projectType  || 'Bespoke Website',
      industry:     parsed.industry     || 'generic',
      stack:        parsed.stack        || ['HTML', 'CSS', 'JS'],
      features:     parsed.features     || ['Responsive design', 'Contact form', 'SEO'],
      timeline:     parsed.timeline     || 'TBC',
      budget:       parsed.budget       || 'TBC'
    };

    sel.fromName  = scope.clientName;
    sel.fromEmail = scope.clientEmail;
    sel.industry  = scope.industry;

    // Pre-fill brand fields from parsed data
    var accent = industryAccent(scope.industry);
    fillBrandFields({
      tagline:   parsed.tagline   || '',
      about:     parsed.about     || '',
      phone:     parsed.phone     || '',
      email:     scope.clientEmail,
      instagram: parsed.instagram || '',
      facebook:  parsed.facebook  || '',
      tiktok:    parsed.tiktok    || '',
      logo:      parsed.logo      || '',
      hero:      parsed.hero      || scope.industry
    });
    document.getElementById('brandColour').value = accent;
    updateSwatch(accent);

  } catch(e) {
    // Graceful fallback — use regex extraction and industry defaults
    scope = localGuessScope(emailText);
    sel.fromName  = scope.clientName;
    sel.fromEmail = scope.clientEmail;
    sel.industry  = scope.industry;
    var accent2 = industryAccent(scope.industry);
    fillBrandFields({
      email: scope.clientEmail,
      hero:  scope.industry
    });
    document.getElementById('brandColour').value = accent2;
    updateSwatch(accent2);
  }

  renderScopeSummary(scope);
  goTo(2);

  btn.disabled = false;
  btn.textContent = 'Parse proposal \u203a';
}

function renderScopeSummary(s) {
  var el = document.getElementById('scopeSummary');
  if (!el) return;
  el.style.display = 'grid';
  el.innerHTML =
      '<div class="sitem"><div class="skey">Client</div><div class="sval">'       + esc(s.clientName   || '—') + '</div></div>'
    + '<div class="sitem"><div class="skey">Business</div><div class="sval">'     + esc(s.businessName || s.clientName || '—') + '</div></div>'
    + '<div class="sitem"><div class="skey">Project type</div><div class="sval">' + esc(s.projectType  || '—') + '</div></div>'
    + '<div class="sitem"><div class="skey">Industry</div><div class="sval">'     + esc(s.industry     || '—') + '</div></div>'
    + '<div class="sitem"><div class="skey">Stack</div><div class="sval">'        + esc((s.stack||[]).join(', ')) + '</div></div>'
    + '<div class="sitem"><div class="skey">Timeline</div><div class="sval">'     + esc(s.timeline     || 'TBC') + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Features</div>'
    +   '<div class="sval" style="font-weight:400;font-size:12px;line-height:1.8">'
    +   (s.features||[]).map(function(f){ return '&#8226; ' + esc(f); }).join('<br>') + '</div></div>'
    + '<div class="sitem" style="grid-column:1/-1"><div class="skey">Override project type</div>'
    +   '<select id="typeOverride" class="type-select">'
    +     '<option value="Bespoke Website"'      + (s.projectType==='Bespoke Website'      ?' selected':'') + '>Bespoke Website (HTML/CSS/JS)</option>'
    +     '<option value="React Native App"'     + (s.projectType==='React Native App'     ?' selected':'') + '>React Native App</option>'
    +     '<option value="Node/Express Backend"' + (s.projectType==='Node/Express Backend' ?' selected':'') + '>Node/Express Backend</option>'
    +     '<option value="Full-Stack"'           + (s.projectType==='Full-Stack'           ?' selected':'') + '>Full-Stack (Web + Backend)</option>'
    +   '</select></div>';
}

// ── Local helpers ─────────────────────────────────────────────────────────────
function extractEmail(text) {
  var m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}
function extractName(text) {
  var m = text.match(/(?:from|regards|cheers|thanks)[,:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i);
  return m ? m[1] : 'Client';
}
function industryAccent(industry) {
  var map = { restaurant:'#c0392b', fitness:'#534AB7', legal:'#1a3a5c', florist:'#7c4d7e', gifts:'#534AB7' };
  return map[industry] || '#534AB7';
}
function localGuessScope(text) {
  var t = text.toLowerCase();
  var industry = 'generic';
  if (t.match(/restaurant|cafe|menu|dining/))   industry = 'restaurant';
  if (t.match(/fitness|gym|personal train/))     industry = 'fitness';
  if (t.match(/law|legal|solicitor/))            industry = 'legal';
  if (t.match(/floral|florist|flower/))          industry = 'florist';
  if (t.match(/embroid|gift|personalised/))      industry = 'gifts';
  return {
    clientName:  extractName(text),
    clientEmail: extractEmail(text),
    businessName:'',
    projectType: 'Bespoke Website',
    industry:    industry,
    stack:       ['HTML','CSS','JS'],
    features:    ['Responsive design','Contact form','SEO'],
    timeline:    'TBC',
    budget:      'TBC'
  };
}

// ── Step 2: Review scope ──────────────────────────────────────────────────────
function goToBrand() {
  var overrideEl = document.getElementById('typeOverride');
  if (overrideEl && scope) scope.projectType = overrideEl.value;
  goTo(3);
  drawWheel();
}

// ── Brand form ────────────────────────────────────────────────────────────────
function fillBrandFields(data) {
  var map = {
    bTagline:'tagline', bAbout:'about', bPhone:'phone', bEmail:'email',
    bInstagram:'instagram', bFacebook:'facebook', bTikTok:'tiktok',
    bLogo:'logo', bHeroKeyword:'hero'
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    var val = data[map[id]];
    if (el && val) el.value = val;
  });
}

function getBrandData() {
  return {
    colour:    (document.getElementById('brandColour')  ||{}).value||'#534AB7',
    tagline:   (document.getElementById('bTagline')     ||{}).value||'',
    about:     (document.getElementById('bAbout')       ||{}).value||'',
    phone:     (document.getElementById('bPhone')       ||{}).value||'',
    email:     (document.getElementById('bEmail')       ||{}).value||'',
    instagram: (document.getElementById('bInstagram')   ||{}).value||'',
    facebook:  (document.getElementById('bFacebook')    ||{}).value||'',
    tiktok:    (document.getElementById('bTikTok')      ||{}).value||'',
    logo:      (document.getElementById('bLogo')        ||{}).value||'',
    hero:      (document.getElementById('bHeroKeyword') ||{}).value||''
  };
}

function validateBrand(b) {
  var missing = [];
  if (!b.colour)         missing.push('Brand colour');
  if (!b.tagline.trim()) missing.push('Tagline');
  if (!b.about.trim())   missing.push('About blurb');
  if (!b.phone.trim())   missing.push('Phone');
  if (!b.email.trim())   missing.push('Email');
  return missing;
}

async function doBrandedScaffold() {
  brand = getBrandData();
  var missing = validateBrand(brand);
  if (missing.length) { alert('Please fill in: ' + missing.join(', ')); return; }
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
  var industry = (scope && scope.industry)    || 'generic';

  files = buildFallback(type, client, industry);
  files = applyBrand(files, brand, client);

  renderTree(files);
  var keys = Object.keys(files);
  renderTabs(keys);
  if (keys.length) showFile(keys[0]);
}

// ── Apply brand ───────────────────────────────────────────────────────────────
function applyBrand(fileMap, b, client) {
  Object.keys(fileMap).forEach(function(fname) {
    var text = fileMap[fname];

    if (fname.indexOf('.css') !== -1 && b.colour) {
      text = text.replace(/--accent:#[0-9a-fA-F]{6}/, '--accent:' + b.colour);
      var hex = b.colour.replace('#','');
      var r  = Math.max(0,parseInt(hex.substr(0,2),16)-40);
      var g  = Math.max(0,parseInt(hex.substr(2,2),16)-40);
      var bv = Math.max(0,parseInt(hex.substr(4,2),16)-40);
      var dk = '#'+[r,g,bv].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
      text = text.replace(/--accent-dark:#[0-9a-fA-F]{6}/, '--accent-dark:' + dk);
    }

    if (fname.indexOf('.html') !== -1) {
      if (b.tagline) text = text.replace(/Your tagline goes here[^<"']*/g, b.tagline);
      if (b.about)   text = text.replace(/2-3 sentences about the business\.[^<"']*/g, b.about);
      if (b.phone)   text = text.replace(/\+44 28 9[0-9 ]+/g, b.phone);
      if (b.email)   text = text.replace(/hello@[a-z0-9.\-]+\.co\.uk/g, b.email);
      if (b.hero)    text = text.replace(/assets\/images\/[a-z]+\.jpg/g, 'assets/images/'+b.hero.toLowerCase().replace(/\s+/g,'-')+'.jpg');

      var socials = '';
      if (b.instagram) socials += '<a href="'+b.instagram+'" target="_blank" style="color:rgba(255,255,255,.5)">Instagram</a>';
      if (b.facebook)  socials += (socials?' &bull; ':'')+'<a href="'+b.facebook+'" target="_blank" style="color:rgba(255,255,255,.5)">Facebook</a>';
      if (b.tiktok)    socials += (socials?' &bull; ':'')+'<a href="'+b.tiktok  +'" target="_blank" style="color:rgba(255,255,255,.5)">TikTok</a>';
      if (socials) {
        text = text.replace(
          '</nav>\n    <p class="footer-copy">',
          '</nav>\n    <div style="font-size:.85rem">'+socials+'</div>\n    <p class="footer-copy">'
        );
      }
    }
    fileMap[fname] = text;
  });
  return fileMap;
}

// ── Scaffold builders ─────────────────────────────────────────────────────────
function buildFallback(type, client, industry) {
  if (type.indexOf('Native')  !== -1) return buildAppScaffold(client);
  if (type.indexOf('Backend') !== -1) return buildBackendScaffold(client);
  var web = buildWebScaffold(client, industry);
  if (type.indexOf('Full') !== -1) Object.assign(web, buildBackendScaffold(client));
  return web;
}

function buildWebScaffold(client, industry) {
  var data = SCAFFOLD_DATA[industry] || SCAFFOLD_DATA['generic'];
  var out  = {};
  Object.keys(data).forEach(function(fname) {
    out[fname] = atob(data[fname]).replace(/__CLIENT__/g, client);
  });
  return out;
}

function buildBackendScaffold(c) {
  var slug = c.toLowerCase().replace(/\s+/g,'-');
  return {
    'server.js': [
      "const express = require('express');",
      "const cors = require('cors');",
      "require('dotenv').config();",
      'const app = express();',
      'const PORT = process.env.PORT || 3000;',
      'app.use(cors()); app.use(express.json());',
      "app.get('/', (req,res) => res.json({ status:'ok', service:'"+c+" API' }));",
      "app.listen(PORT, () => console.log('Server on port '+PORT));"
    ].join('\n'),
    'package.json': JSON.stringify({
      name:slug+'-api',version:'1.0.0',main:'server.js',
      scripts:{start:'node server.js',dev:'nodemon server.js'},
      dependencies:{express:'^4.18.0',cors:'^2.8.5',dotenv:'^16.0.0'}
    },null,2),
    '.env.example':'PORT=3000\nNODE_ENV=development',
    'README.md':'# '+c+' API\n\nNode/Express scaffold.\nnpm install && cp .env.example .env && npm run dev\nhttps://dallastech.co.uk'
  };
}

function buildAppScaffold(c) {
  var slug = c.toLowerCase().replace(/\s+/g,'-');
  return {
    'App.js':[
      "import React from 'react';",
      "import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';",
      'export default function App() { return (',
      '  <View style={s.c}><Text style={s.h}>'+c.toUpperCase()+'</Text>',
      '  <Text style={s.sub}>Built by DallasTech</Text>',
      '  <TouchableOpacity style={s.btn}><Text style={s.bt}>Get started</Text></TouchableOpacity>',
      '  </View>); }',
      "const s=StyleSheet.create({",
      "  c:{flex:1,backgroundColor:'#0a0a0a',alignItems:'center',justifyContent:'center',padding:24},",
      "  h:{fontSize:48,color:'#534AB7',fontWeight:'bold',textAlign:'center',marginBottom:8},",
      "  sub:{fontSize:14,color:'rgba(255,255,255,0.4)',marginBottom:32},",
      "  btn:{backgroundColor:'#534AB7',paddingVertical:14,paddingHorizontal:32,borderRadius:8},",
      "  bt:{color:'#fff',fontSize:15,fontWeight:'600'}});"
    ].join('\n'),
    'package.json':JSON.stringify({
      name:slug,version:'1.0.0',main:'node_modules/expo/AppEntry.js',
      dependencies:{expo:'~50.0.0',react:'18.2.0','react-native':'0.73.0'}
    },null,2),
    'README.md':'# '+c+'\n\nReact Native scaffold.\nnpm install && npx expo start\nhttps://dallastech.co.uk'
  };
}

// ── File tree & code preview ──────────────────────────────────────────────────
function renderTree(f) {
  var names=Object.keys(f),dirs=[],html='';
  names.forEach(function(n){if(n.indexOf('/')!==-1){var d=n.split('/')[0];if(dirs.indexOf(d)===-1)dirs.push(d);}});
  dirs.forEach(function(d){
    html+='<div class="fdir">&#128193; '+esc(d)+'/</div>';
    names.filter(function(n){return n.startsWith(d+'/')&&n.split('/').length===2;})
         .forEach(function(n){html+='<div class="ffile">'+esc(n.split('/').pop())+'</div>';});
  });
  names.filter(function(n){return n.indexOf('/')===-1;})
       .forEach(function(n){html+='<div class="ffile" style="padding-left:0">'+esc(n)+'</div>';});
  document.getElementById('ftree').innerHTML=html;
}

function renderTabs(keys) {
  document.getElementById('tabRow').innerHTML=keys.slice(0,6).map(function(k,i){
    var safe=k.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="tab'+(i===0?' active':'')+'" onclick="_tab('+i+',\''+safe+'\')">'+esc(k.split('/').pop())+'</div>';
  }).join('');
}
window._tab=function(i,k){
  document.querySelectorAll('.tab').forEach(function(t,j){t.classList.toggle('active',j===i);});
  showFile(k);
};
function showFile(k){document.getElementById('codeBox').textContent=files[k]||'';}

// ── Download zip ──────────────────────────────────────────────────────────────
async function doZip() {
  var zip=new JSZip();
  Object.keys(files).forEach(function(name){zip.file(name,files[name]);});
  var blob=await zip.generateAsync({type:'blob'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var slug=((scope&&scope.clientName)||'project').toLowerCase().replace(/\s+/g,'-');
  a.href=url; a.download=slug+'-scaffold.zip';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  document.getElementById('ftree').innerHTML=
    '<div style="text-align:center;padding:2rem">'
    +'<div style="font-size:36px;margin-bottom:12px">&#10003;</div>'
    +'<div style="font-size:15px;font-weight:500;margin-bottom:6px">Scaffold downloaded</div>'
    +'<div style="font-size:13px;color:rgba(255,255,255,.4);margin-bottom:1.5rem">Your project files are ready. Start building.</div>'
    +'<button class="btn btn-p" onclick="doReset()">Start another project</button>'
    +'</div>';
  document.getElementById('tabRow').innerHTML='';
  document.getElementById('codeBox').textContent='';
  pip(5);
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function doReset() {
  sel=null; scope=null; files={}; brand={};
  var area=document.getElementById('emailPaste'); if(area) area.value='';
  var sum=document.getElementById('scopeSummary'); if(sum){sum.innerHTML='';sum.style.display='none';}
  // Clear brand fields
  ['bTagline','bAbout','bPhone','bEmail','bInstagram','bFacebook','bTikTok','bLogo','bHeroKeyword'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  goTo(1);
}

// ── Colour wheel ──────────────────────────────────────────────────────────────
var _brightness=1,_wheelDrawn=false,_pickerOpen=false;

function togglePicker(){
  var w=document.getElementById('pickerWrap');
  if(!w) return;
  _pickerOpen=!_pickerOpen;
  w.style.display=_pickerOpen?'block':'none';
  if(_pickerOpen&&!_wheelDrawn){drawWheel();_wheelDrawn=true;}
}

function drawWheel(){
  var canvas=document.getElementById('colourWheel');
  if(!canvas) return;
  var ctx=canvas.getContext('2d'),cx=canvas.width/2,cy=canvas.height/2,r=cx;
  var img=ctx.createImageData(canvas.width,canvas.height);
  for(var y=0;y<canvas.height;y++){
    for(var x=0;x<canvas.width;x++){
      var dx=x-cx,dy=y-cy,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<=r){
        var hue=((Math.atan2(dy,dx)/(2*Math.PI)+1)%1)*360;
        var rgb=hslToRgb(hue/360,dist/r,0.5*_brightness);
        var idx=(y*canvas.width+x)*4;
        img.data[idx]=rgb[0];img.data[idx+1]=rgb[1];img.data[idx+2]=rgb[2];img.data[idx+3]=255;
      }
    }
  }
  ctx.putImageData(img,0,0);
  canvas.onclick=function(e){
    var rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    var dx=x-cx,dy=y-cy,dist=Math.sqrt(dx*dx+dy*dy);
    if(dist<=r){
      var hue=((Math.atan2(dy,dx)/(2*Math.PI)+1)%1)*360;
      var rgb=hslToRgb(hue/360,dist/r,0.5*_brightness);
      var hex='#'+rgb.map(function(v){return v.toString(16).padStart(2,'0');}).join('');
      document.getElementById('brandColour').value=hex;
      updateSwatch(hex);
    }
  };
}

function onBrightnessChange(){
  var sl=document.getElementById('brightnessSlider');
  if(sl){_brightness=parseFloat(sl.value);_wheelDrawn=false;drawWheel();_wheelDrawn=true;}
}
function onHexInput(val){if(/^#[0-9a-fA-F]{6}$/.test(val)) updateSwatch(val);}
function updateSwatch(hex){var sw=document.getElementById('colourSwatch');if(sw) sw.style.background=hex;}

function hslToRgb(h,s,l){
  var r,g,b;
  if(s===0){r=g=b=l;}
  else{
    function hue2rgb(p,q,t){if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;}
    var q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
    r=hue2rgb(p,q,h+1/3);g=hue2rgb(p,q,h);b=hue2rgb(p,q,h-1/3);
  }
  return[Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function(){
  initPasteView();
  // Initialise swatch with default colour
  updateSwatch('#534AB7');
});
