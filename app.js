/* ═══════════════════════════════════════════════════════
   COLLEGE BRIEF LAB — app.js v3
   20 features total — 10 original + 10 new
══════════════════════════════════════════════════════════ */

/* ─── Global state ────────────────────────────────────── */
var currentUser        = null;
var userProfile        = null;
var currentView        = 'dashboard';
var currentBriefData   = null;
var _unsubBriefs       = null;
var _unsubOpps         = null;
var currentWordLimit   = 0;
var focusMode          = false;
var briefSearchQuery   = '';

/* ─── LocalStorage ────────────────────────────────────── */
var KEY_BRIEFS = 'cbl-briefs';
var KEY_OPPS   = 'cbl-opportunities';

function loadBriefs() { try { return JSON.parse(localStorage.getItem(KEY_BRIEFS)||'[]'); } catch(e){ return []; } }
function saveBriefs(a){ localStorage.setItem(KEY_BRIEFS, JSON.stringify(a)); }
function loadOpps()   { try { return JSON.parse(localStorage.getItem(KEY_OPPS)||'[]');   } catch(e){ return []; } }
function saveOpps(a)  { localStorage.setItem(KEY_OPPS,   JSON.stringify(a)); }
function loadChecklist(oppId){ try { return JSON.parse(localStorage.getItem('cbl-cl-'+oppId)||'{}'); } catch(e){ return {}; } }
function saveChecklist(oppId,data){ localStorage.setItem('cbl-cl-'+oppId, JSON.stringify(data)); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ═══════════════════════════════════════════════════════
   FIRESTORE SYNC
══════════════════════════════════════════════════════════ */
function getDB(){ try { return firebase.firestore(); } catch(e){ return null; } }

function startFirestoreSync(){
  if(!currentUser) return;
  var db=getDB(); if(!db) return;
  var userId=currentUser.uid;
  migrateLocalToFirestore(db,userId);
  _unsubBriefs=db.collection('users').doc(userId).collection('briefs').orderBy('createdAt','desc').onSnapshot(function(snap){
    saveBriefs(snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }));
    softRefresh('briefs');
  },function(e){ console.warn('Briefs sync:',e.message); });
  _unsubOpps=db.collection('users').doc(userId).collection('opportunities').orderBy('createdAt','desc').onSnapshot(function(snap){
    saveOpps(snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }));
    softRefresh('opportunities');
  },function(e){ console.warn('Opps sync:',e.message); });
}

function stopFirestoreSync(){
  if(_unsubBriefs){ _unsubBriefs(); _unsubBriefs=null; }
  if(_unsubOpps){   _unsubOpps();   _unsubOpps=null;   }
}

function migrateLocalToFirestore(db,userId){
  var col=db.collection('users').doc(userId);
  loadBriefs().forEach(function(b){ col.collection('briefs').doc(b.id).set(b,{merge:true}).catch(function(){}); });
  loadOpps().forEach(function(o){ col.collection('opportunities').doc(o.id).set(o,{merge:true}).catch(function(){}); });
}

function cloudSaveBrief(brief){ var db=getDB(); if(!db||!currentUser) return; db.collection('users').doc(currentUser.uid).collection('briefs').doc(brief.id).set(brief).catch(function(e){ console.warn(e.message); }); }
function cloudSaveOpp(opp){ var db=getDB(); if(!db||!currentUser) return; db.collection('users').doc(currentUser.uid).collection('opportunities').doc(opp.id).set(opp).catch(function(e){ console.warn(e.message); }); }
function cloudUpdateOpp(id,data){ var db=getDB(); if(!db||!currentUser) return; db.collection('users').doc(currentUser.uid).collection('opportunities').doc(id).update(data).catch(function(e){ console.warn(e.message); }); }

function softRefresh(changed){
  updateSidebarStats();
  if(currentView==='dashboard'){ renderView(); return; }
  if(currentView==='briefs'&&changed==='briefs'){ var el=document.getElementById('brief-history'); if(el){ el.innerHTML=renderHistoryList(loadBriefs()); wireHistoryButtons(); } return; }
  if(currentView==='opportunities'&&changed==='opportunities'){ var el2=document.getElementById('opp-list'); if(el2){ el2.innerHTML=renderOppCards(loadOpps()); wireOppButtons(); } }
}

/* ═══════════════════════════════════════════════════════
   AUTH STATE
══════════════════════════════════════════════════════════ */
function handleAuthState(event){
  currentUser=event.detail.user||null; userProfile=event.detail.profile||null;
  if(currentUser){ startFirestoreSync(); } else { stopFirestoreSync(); }
  renderSidebar(); renderView();
}
document.addEventListener('ne-auth-state',handleAuthState);

/* ═══════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════ */
function renderSidebar(){ renderSidebarUser(); updateSidebarStats(); }

function renderSidebarUser(){
  var c=document.getElementById('sb-user'); if(!c) return;
  if(currentUser){
    var dn=(userProfile&&userProfile.displayName)?userProfile.displayName:(currentUser.displayName||currentUser.email||'Signed in');
    var photo=(userProfile&&userProfile.photoURL)||currentUser.photoURL||'';
    var img=photo?'<img src="'+escHtml(photo)+'" alt="" />':'';
    c.innerHTML='<div class="sb-user-row">'+img+'<span class="sb-user-name">'+escHtml(dn)+'</span><button class="btn-sb-signout" id="btn-sign-out">Out</button></div>';
    document.getElementById('btn-sign-out').addEventListener('click',function(){ if(typeof logOut==='function') logOut(); });
  } else {
    c.innerHTML='<button class="btn-signin-sidebar" id="btn-sign-in">Sign in with Google</button>';
    document.getElementById('btn-sign-in').addEventListener('click',function(){ if(typeof signInGoogle==='function') signInGoogle(); });
  }
}

function updateSidebarStats(){
  var footer=document.getElementById('sb-footer'); if(!footer) return;
  if(!currentUser){ footer.innerHTML=renderSidebarControls(); return; }
  var briefs=loadBriefs(); var opps=loadOpps();
  var upcoming=opps.filter(function(o){ return getDaysUntil(o.deadline)<=30&&getDaysUntil(o.deadline)>=0; }).length;
  footer.innerHTML=
    '<div class="sb-stat-row"><span class="sb-stat-label">Briefs</span><span class="sb-stat-value">'+briefs.length+'</span></div>'+
    '<div class="sb-stat-row"><span class="sb-stat-label">Applications</span><span class="sb-stat-value">'+opps.length+'</span></div>'+
    (upcoming?'<div class="sb-stat-row"><span class="sb-stat-label" style="color:#f59e0b">Deadlines soon</span><span class="sb-stat-value" style="color:#f59e0b">'+upcoming+'</span></div>':'')+
    '<div class="sb-sync-dot">☁ Synced across devices</div>'+
    renderSidebarControls();
}

/* ① Dark mode toggle in sidebar ──────────────────────── */
function renderSidebarControls(){
  var isDark=document.documentElement.getAttribute('data-theme')==='dark';
  return '<div class="sb-controls">'+
    '<button class="sb-ctrl-btn" id="btn-dark-mode" title="Toggle dark mode">'+(isDark?'☀ Light':'◑ Dark')+'</button>'+
    '<button class="sb-ctrl-btn" id="btn-focus-mode" title="Focus mode (Ctrl+F)">⊡ Focus</button>'+
    '<button class="sb-ctrl-btn" id="btn-shortcuts" title="Keyboard shortcuts">⌨ Keys</button>'+
  '</div>';
}

document.querySelectorAll('.sb-nav-item').forEach(function(btn){
  btn.addEventListener('click',function(){ switchView(btn.dataset.view); });
});

function switchView(view){
  currentView=view;
  document.querySelectorAll('.sb-nav-item').forEach(function(b){ b.classList.toggle('active',b.dataset.view===view); });
  if(focusMode) exitFocusMode();
  renderView();
}

function renderView(){
  var main=document.getElementById('app-main'); if(!main) return;
  if(currentView==='dashboard')          { main.innerHTML=renderDashboard();  wireDashboard(); }
  else if(currentView==='briefs')        { main.innerHTML=renderBriefs();     wireBriefs(); }
  else if(currentView==='opportunities') { main.innerHTML=renderOpps();       wireOpps(); }
  wireSidebarControls();
}

function wireSidebarControls(){
  var dm=document.getElementById('btn-dark-mode');
  if(dm) dm.addEventListener('click',toggleDarkMode);
  var fm=document.getElementById('btn-focus-mode');
  if(fm) fm.addEventListener('click',toggleFocusMode);
  var sc=document.getElementById('btn-shortcuts');
  if(sc) sc.addEventListener('click',showShortcutsModal);
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD + SMART INSIGHTS
══════════════════════════════════════════════════════════ */
function renderDashboard(){
  if(!currentUser){
    return '<div class="signed-out-msg"><div class="signed-out-icon">✦</div><strong>College Brief Lab</strong><p>Build structured arguments, essay outlines, and policy memos — powered by AI. Sign in to sync across devices.</p></div>';
  }
  var briefs=loadBriefs(); var opps=loadOpps();
  var firstName=(userProfile&&userProfile.displayName)?userProfile.displayName.split(' ')[0]:'';
  var inProgress=opps.filter(function(o){ return ['Brainstorming','Drafting','Polishing'].indexOf(o.status)>-1; }).length;
  var activity=[];
  briefs.forEach(function(b){ activity.push({type:'brief',title:b.title||b.briefType,id:b.id,createdAt:b.createdAt}); });
  opps.forEach(function(o){ activity.push({type:'opp',title:o.name,id:o.id,createdAt:o.createdAt}); });
  activity.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); }); activity=activity.slice(0,5);
  var actHtml=activity.length===0?'<div class="empty-state">No activity yet. Build a brief or add an application to get started.</div>':
    '<ul class="activity-list">'+activity.map(function(item){
      var cls=item.type==='opp'?'chip chip-opp':'chip chip-brief';
      return '<li><span class="'+cls+'">'+(item.type==='opp'?'App':'Brief')+'</span><span class="activity-title">'+escHtml(item.title)+'</span><button class="btn-ghost btn-small" data-type="'+item.type+'" data-id="'+item.id+'">Open →</button></li>';
    }).join('')+'</ul>';

  return '<div class="hero-card"><h2>Good to see you'+(firstName?', '+escHtml(firstName):'')+' ✦</h2><p>Build arguments, essay outlines, and policy memos — powered by AI. Sign in to sync across devices.</p></div>'+
    '<div class="stat-grid">'+statCard(briefs.length,'Briefs created')+statCard(opps.length,'Applications tracked')+statCard(inProgress,'In progress')+'</div>'+
    renderInsights(briefs,opps)+
    '<div class="card"><p class="section-heading">Recent activity</p>'+actHtml+'</div>';
}

function renderInsights(briefs,opps){
  var insights=[];
  var urgent=opps.filter(function(o){ var d=getDaysUntil(o.deadline); return d>=0&&d<=7; });
  var soon=opps.filter(function(o){ var d=getDaysUntil(o.deadline); return d>7&&d<=30; });
  if(urgent.length) insights.push({icon:'🔴',text:urgent.length+' application'+(urgent.length>1?'s':'')+' due within 7 days',cta:'View',view:'opportunities'});
  else if(soon.length) insights.push({icon:'🟡',text:soon.length+' deadline'+(soon.length>1?'s':'')+' in the next 30 days',cta:'View',view:'opportunities'});
  if(briefs.length>=3){
    var typeCounts={}; briefs.forEach(function(b){ typeCounts[b.briefType]=(typeCounts[b.briefType]||0)+1; });
    var top=Object.keys(typeCounts).sort(function(a,b){ return typeCounts[b]-typeCounts[a]; })[0];
    insights.push({icon:'✦',text:'Most-used type: '+top+' ('+typeCounts[top]+')',cta:'Build one',view:'briefs'});
  }
  if(opps.length>=3){
    var submitted=opps.filter(function(o){ return o.status==='Submitted'||o.status==='Result'; }).length;
    insights.push({icon:'📊',text:Math.round(submitted/opps.length*100)+'% of applications submitted ('+submitted+'/'+opps.length+')',cta:'Track',view:'opportunities'});
  }
  if(briefs.length>=2){
    var recent=briefs.filter(function(b){ return b.createdAt&&(Date.now()-b.createdAt)<7*864e5; });
    if(recent.length>=2) insights.push({icon:'🔥',text:'You\'ve built '+recent.length+' briefs this week — keep the momentum!',cta:null});
  }
  if(!insights.length) return '';
  return '<div class="insight-cards">'+insights.map(function(ins){
    return '<div class="insight-card"><span class="insight-icon">'+ins.icon+'</span><span class="insight-text">'+ins.text+'</span>'+(ins.cta?'<button class="btn-ghost btn-small" data-insight-view="'+(ins.view||'')+'">'+ins.cta+' →</button>':'')+
    '</div>';
  }).join('')+'</div>';
}

function statCard(n,label){ return '<div class="stat-card"><span class="stat-number">'+n+'</span><div class="stat-label">'+label+'</div></div>'; }

function wireDashboard(){
  document.querySelectorAll('.activity-list [data-type]').forEach(function(btn){ btn.addEventListener('click',function(){ switchView(btn.dataset.type==='opp'?'opportunities':'briefs'); }); });
  document.querySelectorAll('[data-insight-view]').forEach(function(btn){ btn.addEventListener('click',function(){ if(btn.dataset.insightView) switchView(btn.dataset.insightView); }); });
}

/* ═══════════════════════════════════════════════════════
   ⑩ WORD LIMIT PRESETS (feature 2 of new 10)
══════════════════════════════════════════════════════════ */
var WORD_LIMIT_PRESETS = {
  'College Essay Outline': [
    { label: 'Common App Main (650w)', limit: 650 },
    { label: 'Why Us Supplement (250w)', limit: 250 },
    { label: 'Short Answer (150w)', limit: 150 },
    { label: 'Activity Description (150w)', limit: 150 },
    { label: 'No limit', limit: 0 },
  ],
  'Policy Memo': [
    { label: 'Standard Memo (1000w)', limit: 1000 },
    { label: 'Executive Brief (500w)', limit: 500 },
    { label: 'One-Pager (300w)', limit: 300 },
    { label: 'No limit', limit: 0 },
  ],
  'Debate Case': [
    { label: 'Standard Case (800w)', limit: 800 },
    { label: 'Short Case (400w)', limit: 400 },
    { label: 'No limit', limit: 0 },
  ],
};

function renderWordLimitBar(plainText){
  if(!currentWordLimit) return '';
  var words=plainText.trim().split(/\s+/).filter(Boolean).length;
  var pct=Math.min(100,Math.round(words/currentWordLimit*100));
  var color=pct>100?'#ef4444':pct>85?'#f59e0b':'#22c55e';
  return '<div class="word-limit-bar-wrap">'+
    '<div class="word-limit-track"><div class="word-limit-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
    '<span class="word-limit-label" style="color:'+color+'">'+words+' / '+currentWordLimit+' words'+(pct>100?' ⚠ over limit':pct>85?' · approaching limit':'')+'</span>'+
  '</div>';
}

/* ══ ⑥ TEMPLATES PANEL ══════════════════════════════════ */
var TEMPLATES=[
  {cat:'Essay',label:'Why I want to study Computer Science',briefType:'College Essay Outline'},
  {cat:'Essay',label:'A challenge I overcame that changed me',briefType:'College Essay Outline'},
  {cat:'Essay',label:'Why I want to attend a small liberal arts college',briefType:'College Essay Outline'},
  {cat:'Essay',label:'How a mentor shaped my ambitions',briefType:'College Essay Outline'},
  {cat:'Policy',label:'Should the US lower the voting age to 16?',briefType:'Policy Memo'},
  {cat:'Policy',label:'How should universities address student mental health?',briefType:'Policy Memo'},
  {cat:'Policy',label:'Should standardized testing be eliminated in admissions?',briefType:'Policy Memo'},
  {cat:'Debate',label:'Social media does more harm than good to teenagers',briefType:'Debate Case'},
  {cat:'Debate',label:'Universal basic income would benefit society',briefType:'Debate Case'},
  {cat:'Debate',label:'AI in education threatens academic integrity',briefType:'Debate Case'},
  {cat:'Debate',label:'The US should abolish the Electoral College',briefType:'Debate Case'},
  {cat:'Debate',label:'Affirmative action in college admissions is justified',briefType:'Debate Case'},
];

function renderTemplates(){
  var bycat={};
  TEMPLATES.forEach(function(t){ (bycat[t.cat]=bycat[t.cat]||[]).push(t); });
  return '<div class="templates-panel" id="templates-panel" style="display:none">'+
    '<p class="section-heading" style="margin-bottom:10px">Quick-start templates</p>'+
    Object.keys(bycat).map(function(cat){
      return '<div class="templates-group"><span class="template-cat">'+cat+'</span>'+
        bycat[cat].map(function(t){ return '<button class="template-btn" data-tpl-label="'+escHtml(t.label)+'" data-tpl-type="'+escHtml(t.briefType)+'">'+escHtml(t.label)+'</button>'; }).join('')+
      '</div>';
    }).join('')+
  '</div>';
}

/* ══ BRIEF BUILDER ═══════════════════════════════════════ */
function renderBriefs(){
  var briefs=loadBriefs();
  var limitPresets=WORD_LIMIT_PRESETS[document.getElementById('bb-type')? document.getElementById('bb-type').value : 'College Essay Outline']||WORD_LIMIT_PRESETS['College Essay Outline'];

  /* ③ Quick-switch type bar */
  var typesBar='<div class="type-quick-switch" id="type-quick-switch">'+
    ['College Essay Outline','Policy Memo','Debate Case'].map(function(t){
      return '<button class="type-switch-btn'+(false?' active':'')+'" data-type="'+escHtml(t)+'">'+t.replace(' Outline','').replace('College ','')+'</button>';
    }).join('')+
  '</div>';

  return '<div class="brief-builder">'+
    '<div class="card">'+
      '<h2>Brief Builder</h2>'+
      '<p class="subtitle">Generate a structured argument, memo, or essay outline — powered by AI.</p>'+
      typesBar+
      '<button id="btn-toggle-templates" class="btn-ghost btn-small" style="margin-bottom:10px">⚡ Quick prompts</button>'+
      renderTemplates()+
      '<div class="form-group"><label for="bb-prompt">Prompt or question <span class="req">*</span></label>'+
        '<textarea id="bb-prompt" rows="3" placeholder="e.g. Argue that end-to-end encryption undermines public safety — or press ⚡ for a template."></textarea></div>'+
      '<div class="form-group"><label for="bb-notes">Source notes <span class="opt">(optional)</span></label>'+
        '<textarea id="bb-notes" rows="2" placeholder="Paste key facts, quotes, or research notes."></textarea></div>'+
      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">'+
        '<div style="flex:1;min-width:140px"><label for="bb-type">Type</label>'+
          '<select id="bb-type"><option>College Essay Outline</option><option>Policy Memo</option><option>Debate Case</option></select></div>'+
        '<div style="flex:1;min-width:140px"><label for="bb-tone">Tone</label>'+
          '<select id="bb-tone"><option>Neutral Analytic</option><option>Advocacy</option><option>Academic Formal</option></select></div>'+
        /* ② Word limit preset */
        '<div style="flex:1;min-width:140px"><label for="bb-limit">Word limit</label>'+
          '<select id="bb-limit">'+limitPresets.map(function(p){ return '<option value="'+p.limit+'">'+escHtml(p.label)+'</option>'; }).join('')+'</select></div>'+
        '<button id="btn-generate" class="btn-primary" style="padding:9px 22px;white-space:nowrap;height:36px">Generate →</button>'+
      '</div>'+
    '</div>'+

    '<div class="brief-builder-split">'+
      '<div class="card" style="margin-bottom:0">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
          '<p class="section-heading" style="margin:0">Output</p>'+
          '<span id="gen-source" class="gen-source-badge" style="visibility:hidden"></span>'+
        '</div>'+
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your brief will appear here after generation. Use <kbd>Ctrl+Enter</kbd> to generate.</span></div>'+
        '<div id="word-limit-bar" style="display:none"></div>'+
        '<div id="score-bars" style="display:none" class="score-bars"></div>'+
        '<div id="readability-row" style="display:none" class="readability-row"></div>'+
        '<div id="dig-deeper-row" style="display:none" class="dig-deeper-row"></div>'+
        '<div class="btn-row" id="output-actions" style="display:none">'+
          '<button id="btn-copy" class="btn-secondary btn-small">Copy</button>'+
          '<button id="btn-save" class="btn-primary btn-small">Save</button>'+
          '<button id="btn-polish" class="btn-secondary btn-small">✦ Polish</button>'+
          '<button id="btn-share" class="btn-secondary btn-small">Share →</button>'+
          '<button id="btn-pdf" class="btn-secondary btn-small">PDF ↓</button>'+
          '<button id="btn-focus-brief" class="btn-secondary btn-small">⊡ Focus</button>'+
        '</div>'+
        '<div id="share-panel" class="share-panel" style="display:none">'+
          '<input id="share-url" type="text" readonly style="flex:1" />'+
          '<button id="btn-copy-share" class="btn-primary btn-small">Copy link</button>'+
        '</div>'+
        '<div id="brief-summary" class="brief-summary" style="display:none"></div>'+
      '</div>'+

      '<div class="card" style="margin-bottom:0">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
          '<p class="section-heading" style="margin:0">'+(currentUser?'☁ Saved briefs':'Recent briefs')+'</p>'+
        '</div>'+
        /* ③ Brief search */
        '<input type="text" id="brief-search" placeholder="Search briefs…" style="margin-bottom:10px;font-size:12.5px;padding:6px 10px" />' +
        '<div id="brief-history">'+renderHistoryList(briefs)+'</div>'+
      '</div>'+
    '</div>'+
  '</div>';
}

/* ─── Wire brief builder ──────────────────────────────── */
function wireBriefs(){
  /* ③ Quick-switch type bar */
  var currentType=document.getElementById('bb-type')&&document.getElementById('bb-type').value||'College Essay Outline';
  document.querySelectorAll('.type-switch-btn').forEach(function(btn){
    if(btn.dataset.type===currentType) btn.classList.add('active');
    btn.addEventListener('click',function(){
      document.querySelectorAll('.type-switch-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var typeEl=document.getElementById('bb-type'); if(typeEl) typeEl.value=btn.dataset.type;
      /* Update word limit presets */
      var limitSel=document.getElementById('bb-limit'); if(!limitSel) return;
      var presets=WORD_LIMIT_PRESETS[btn.dataset.type]||WORD_LIMIT_PRESETS['College Essay Outline'];
      limitSel.innerHTML=presets.map(function(p){ return '<option value="'+p.limit+'">'+escHtml(p.label)+'</option>'; }).join('');
      currentWordLimit=parseInt(limitSel.value)||0;
    });
  });

  /* Word limit change */
  var limitSel=document.getElementById('bb-limit');
  if(limitSel){ currentWordLimit=parseInt(limitSel.value)||0; limitSel.addEventListener('change',function(){ currentWordLimit=parseInt(limitSel.value)||0; updateWordLimitBar(); }); }

  /* Templates toggle */
  document.getElementById('btn-toggle-templates').addEventListener('click',function(){
    var p=document.getElementById('templates-panel'); p.style.display=p.style.display==='none'?'block':'none';
  });
  document.querySelectorAll('.template-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.getElementById('bb-prompt').value=btn.dataset.tplLabel;
      var typeEl=document.getElementById('bb-type'); if(typeEl) typeEl.value=btn.dataset.tplType;
      document.querySelectorAll('.type-switch-btn').forEach(function(b){ b.classList.toggle('active',b.dataset.type===btn.dataset.tplType); });
      var presets=WORD_LIMIT_PRESETS[btn.dataset.tplType]||WORD_LIMIT_PRESETS['College Essay Outline'];
      var ls=document.getElementById('bb-limit'); if(ls){ ls.innerHTML=presets.map(function(p){ return '<option value="'+p.limit+'">'+escHtml(p.label)+'</option>'; }).join(''); }
      document.getElementById('templates-panel').style.display='none';
    });
  });

  /* ③ Brief search filter */
  var srch=document.getElementById('brief-search');
  if(srch){ srch.value=briefSearchQuery; srch.addEventListener('input',function(){ briefSearchQuery=srch.value; document.getElementById('brief-history').innerHTML=renderHistoryList(loadBriefs()); wireHistoryButtons(); }); }

  /* Generate */
  document.getElementById('btn-generate').addEventListener('click',function(){ runGenerate('generate'); });

  /* Copy */
  document.getElementById('btn-copy').addEventListener('click',function(){
    if(!currentBriefData) return;
    navigator.clipboard.writeText(currentBriefData.plainText).then(function(){ var b=document.getElementById('btn-copy'); b.textContent='Copied!'; setTimeout(function(){ b.textContent='Copy'; },1800); }).catch(function(){ alert('Please select and copy the text manually.'); });
  });

  /* Save */
  document.getElementById('btn-save').addEventListener('click',doSaveBrief);

  /* ⑦ Polish */
  document.getElementById('btn-polish').addEventListener('click',function(){ if(!currentBriefData||!currentBriefData.plainText) return; runGenerate('polish'); });

  /* Share */
  document.getElementById('btn-share').addEventListener('click',function(){
    if(!currentBriefData) return;
    var panel=document.getElementById('share-panel'); var isOpen=panel.style.display!=='none';
    if(isOpen){ panel.style.display='none'; return; }
    var encoded=encodeShareData(currentBriefData);
    document.getElementById('share-url').value=window.location.origin+window.location.pathname+'#brief='+encoded;
    panel.style.display='flex';
  });
  document.getElementById('btn-copy-share').addEventListener('click',function(){
    var inp=document.getElementById('share-url');
    navigator.clipboard.writeText(inp.value).then(function(){ var b=document.getElementById('btn-copy-share'); b.textContent='Copied!'; setTimeout(function(){ b.textContent='Copy link'; },2000); }).catch(function(){ inp.select(); document.execCommand('copy'); });
  });

  /* PDF */
  document.getElementById('btn-pdf').addEventListener('click',exportPDF);

  /* ⑦ Focus mode from output panel */
  document.getElementById('btn-focus-brief').addEventListener('click',toggleFocusMode);

  wireHistoryButtons();
}

function doSaveBrief(){
  if(!currentBriefData) return;
  var prompt=document.getElementById('bb-prompt').value.trim();
  var tagInput=prompt; // derive tags from keywords
  var tags=extractKeywords(tagInput).slice(0,3);
  var entry={ id:uid(), title:prompt.slice(0,80), briefType:(document.getElementById('bb-type')&&document.getElementById('bb-type').value)||'College Essay Outline',
    tone:(document.getElementById('bb-tone')&&document.getElementById('bb-tone').value)||'Neutral Analytic', createdAt:Date.now(),
    outlineText:currentBriefData.plainText, sections:currentBriefData.sections||[], score:currentBriefData.score||null,
    summary:currentBriefData.summary||'', tags:tags };
  var briefs=loadBriefs(); briefs.unshift(entry); if(briefs.length>30) briefs=briefs.slice(0,30);
  saveBriefs(briefs); cloudSaveBrief(entry);
  var b=document.getElementById('btn-save'); b.textContent='Saved!'; setTimeout(function(){ b.textContent='Save'; },1800);
  document.getElementById('brief-history').innerHTML=renderHistoryList(loadBriefs()); wireHistoryButtons(); updateSidebarStats();
}

/* ─── Run generation ──────────────────────────────────── */
async function runGenerate(mode){
  var promptVal,sourceNotes,briefType,tone;
  if(mode==='polish'){
    promptVal=currentBriefData&&currentBriefData.plainText?currentBriefData.plainText:''; sourceNotes='';
    briefType=currentBriefData&&currentBriefData.briefType?currentBriefData.briefType:'College Essay Outline';
    tone=currentBriefData&&currentBriefData.tone?currentBriefData.tone:'Neutral Analytic';
  } else {
    promptVal=(document.getElementById('bb-prompt')&&document.getElementById('bb-prompt').value||'').trim();
    sourceNotes=(document.getElementById('bb-notes')&&document.getElementById('bb-notes').value||'').trim();
    briefType=(document.getElementById('bb-type')&&document.getElementById('bb-type').value)||'College Essay Outline';
    tone=(document.getElementById('bb-tone')&&document.getElementById('bb-tone').value)||'Neutral Analytic';
    if(!promptVal){ alert('Please enter a prompt or question.'); return; }
  }

  var genBtn=document.getElementById('btn-generate');
  var polBtn=document.getElementById('btn-polish');
  var outputEl=document.getElementById('brief-output');
  var actionsEl=document.getElementById('output-actions');
  var badgeEl=document.getElementById('gen-source');
  var scoreBarsEl=document.getElementById('score-bars');
  var readRowEl=document.getElementById('readability-row');
  var summaryEl=document.getElementById('brief-summary');
  var sharePanel=document.getElementById('share-panel');
  var digDeeper=document.getElementById('dig-deeper-row');
  var wlBar=document.getElementById('word-limit-bar');

  [scoreBarsEl,readRowEl,summaryEl,sharePanel,digDeeper].forEach(function(el){ if(el) el.style.display='none'; });
  if(wlBar) wlBar.style.display='none';
  if(genBtn){ genBtn.textContent=mode==='polish'?'Polishing…':'Generating…'; genBtn.disabled=true; }
  if(polBtn) polBtn.disabled=true;
  outputEl.innerHTML='<div class="gen-loading"><span class="gen-dot"></span><span class="gen-dot"></span><span class="gen-dot"></span></div>';
  if(actionsEl) actionsEl.style.display='none';

  try {
    var data=await callGenerateBriefAPI(promptVal,sourceNotes,briefType,tone,mode);
    if(data.quality==='filler'){
      outputEl.innerHTML='<div class="filler-msg"><div style="font-size:28px;margin-bottom:8px">🤔</div><strong>That doesn\'t look like a brief topic.</strong><p>'+escHtml(data.message||'Please enter a more specific prompt.')+'</p></div>';
      if(badgeEl) badgeEl.style.visibility='hidden';
    } else {
      var plainText=sectionsToPlainText(data.sections||[]);
      currentBriefData={ sections:data.sections||[], score:data.score||null, summary:data.summary||'', plainText:plainText, briefType:briefType, tone:tone, title:(promptVal||'').slice(0,80) };
      outputEl.innerHTML=renderSections(data.sections||[]);
      if(actionsEl) actionsEl.style.display='flex';
      if(badgeEl){ badgeEl.textContent=mode==='polish'?'✦ Polished':'✦ AI'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
      if(data.score&&scoreBarsEl){ scoreBarsEl.innerHTML=renderScoreBars(data.score); scoreBarsEl.style.display='block'; requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); }
      if(readRowEl){ readRowEl.innerHTML=renderReadability(plainText); readRowEl.style.display='flex'; }
      if(data.summary&&summaryEl){ summaryEl.textContent='"'+data.summary+'"'; summaryEl.style.display='block'; }
      /* ② Word limit bar */
      if(currentWordLimit&&wlBar){ wlBar.innerHTML=renderWordLimitBar(plainText); wlBar.style.display='block'; }
      /* ⑤ Dig deeper */
      if(digDeeper&&mode==='generate'){ digDeeper.innerHTML=renderDigDeeper(promptVal,briefType); digDeeper.style.display='block'; wireDigDeeper(); }
      /* Wire section regen buttons */
      wireSectionRegenButtons(briefType,tone);
    }
  } catch(err){
    var errMsg=err&&err.message?err.message:'Unknown error';
    outputEl.innerHTML=
      '<div class="api-error-card">'+
        '<div class="api-error-icon">⚡</div>'+
        '<strong>AI unavailable</strong>'+
        '<p>'+escHtml(errMsg)+'</p>'+
        '<div class="api-error-actions">'+
          '<button class="btn-primary btn-small" id="btn-retry-gen">Retry with AI</button>'+
          '<span class="api-error-hint">Make sure you\'re using the app through the preview URL, not a downloaded file.</span>'+
        '</div>'+
      '</div>';
    if(badgeEl){ badgeEl.textContent='⚠ Error'; badgeEl.className='gen-source-badge badge-error'; badgeEl.style.visibility='visible'; }
    var retryBtn=document.getElementById('btn-retry-gen');
    if(retryBtn) retryBtn.addEventListener('click',function(){ runGenerate(mode); });
  } finally {
    if(genBtn){ genBtn.textContent='Generate →'; genBtn.disabled=false; }
    if(polBtn) polBtn.disabled=false;
  }
}

function updateWordLimitBar(){
  var wlBar=document.getElementById('word-limit-bar');
  if(!wlBar) return;
  if(!currentBriefData||!currentBriefData.plainText||!currentWordLimit){ wlBar.style.display='none'; return; }
  wlBar.innerHTML=renderWordLimitBar(currentBriefData.plainText); wlBar.style.display='block';
}

/* ─── API call ────────────────────────────────────────── */
async function callGenerateBriefAPI(prompt,sourceNotes,briefType,tone,mode){
  var res=await fetch('/api/generate-brief',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt:prompt,sourceNotes:sourceNotes,briefType:briefType,tone:tone,mode:mode||'generate'}) });
  var data=await res.json();
  if(!res.ok) throw new Error(data.error||('Server error '+res.status));
  return data;
}

/* ─── Render structured sections ─────────────────────── */
function renderSections(sections){
  if(!sections||!sections.length) return '<span class="output-placeholder">No content returned. Try a more specific prompt.</span>';
  return sections.map(function(s,i){
    var bullets=(s.bullets||[]).filter(function(b){ return b&&b.trim(); });
    /* ⑧ Per-section regenerate button */
    return '<div class="brief-section-block" data-section-idx="'+i+'">'+
      '<div class="brief-section-head-row">'+
        '<h3 class="brief-section-heading">'+escHtml(s.heading||'')+'</h3>'+
        '<button class="btn-regen-section" data-section-heading="'+escHtml(s.heading||'')+'" data-section-idx="'+i+'" title="Regenerate this section">↻</button>'+
      '</div>'+
      '<ul class="brief-bullets">'+bullets.map(function(b){ return '<li>'+escHtml(b)+'</li>'; }).join('')+'</ul>'+
    '</div>';
  }).join('');
}

function renderFallbackSections(sections){
  return sections.map(function(s,i){
    return '<div class="brief-section-block" data-section-idx="'+i+'">'+
      '<div class="brief-section-head-row"><h3 class="brief-section-heading">'+escHtml(s.heading||'')+'</h3></div>'+
      '<ul class="brief-bullets">'+s.lines.map(function(l){ return '<li>'+escHtml(stripTags(l))+'</li>'; }).join('')+'</ul>'+
    '</div>';
  }).join('');
}

function sectionsToPlainText(sections){
  return sections.map(function(s){ return s.heading+'\n'+(s.bullets||[]).join('\n'); }).join('\n\n');
}

/* ⑧ Per-section regeneration ─────────────────────────── */
function wireSectionRegenButtons(briefType,tone){
  document.querySelectorAll('.btn-regen-section').forEach(function(btn){
    btn.addEventListener('click',function(){
      var heading=btn.dataset.sectionHeading; var idx=parseInt(btn.dataset.sectionIdx);
      if(!currentBriefData||!currentBriefData.plainText) return;
      btn.textContent='…'; btn.disabled=true;
      var prompt=(document.getElementById('bb-prompt')&&document.getElementById('bb-prompt').value)||currentBriefData.title||'';
      callGenerateBriefAPI('Rewrite and improve only the "'+heading+'" section for this brief about: '+prompt+'. Make the bullets more specific and compelling. Existing content: '+currentBriefData.plainText,'',briefType||currentBriefData.briefType,tone||currentBriefData.tone,'generate').then(function(data){
        if(data.quality==='good'&&data.sections&&data.sections.length){
          var bestSection=data.sections.find(function(s){ return s.heading&&s.heading.toLowerCase().includes(heading.toLowerCase()); })||data.sections[0];
          if(bestSection&&currentBriefData.sections){
            var newSections=currentBriefData.sections.slice();
            if(idx<newSections.length){ newSections[idx]={ heading:heading, bullets:bestSection.bullets }; }
            currentBriefData.sections=newSections; currentBriefData.plainText=sectionsToPlainText(newSections);
            document.getElementById('brief-output').innerHTML=renderSections(newSections);
            wireSectionRegenButtons(briefType,tone);
            var readRow=document.getElementById('readability-row'); if(readRow){ readRow.innerHTML=renderReadability(currentBriefData.plainText); readRow.style.display='flex'; }
          }
        }
      }).catch(function(e){ console.warn('Section regen failed:',e.message); }).finally(function(){ btn.textContent='↻'; btn.disabled=false; });
    });
  });
}

/* ⑤ Dig-deeper prompts ───────────────────────────────── */
function renderDigDeeper(prompt,briefType){
  var kw=extractKeywords(prompt).slice(0,2); var k0=kw[0]||'this topic'; var k1=kw[1]||k0;
  var suggestions=briefType==='Debate Case'?[
    'Strengthen the economic argument around '+k0,
    'Add a counterargument about '+k1+' with a strong rebuttal',
    'Make the thesis sharper and more assertive',
  ]:briefType==='Policy Memo'?[
    'Add more specific policy options with trade-offs',
    'Strengthen the evidence in the Problem Statement',
    'Write a more detailed Research Plan for '+k0,
  ]:[
    'Expand the Hook with a more vivid opening scene',
    'Make the Reflection more specific about how '+k0+' changed you',
    'Strengthen the Takeaway to connect to college goals',
  ];
  return '<div class="dig-deeper-label">Dig deeper →</div>'+
    suggestions.map(function(s){
      return '<button class="dig-deeper-btn" data-dd-prompt="'+escHtml(s)+'">'+escHtml(s)+'</button>';
    }).join('');
}

function wireDigDeeper(){
  document.querySelectorAll('.dig-deeper-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var briefType=(document.getElementById('bb-type')&&document.getElementById('bb-type').value)||'College Essay Outline';
      var tone=(document.getElementById('bb-tone')&&document.getElementById('bb-tone').value)||'Neutral Analytic';
      var existing=currentBriefData&&currentBriefData.plainText?'\n\nExisting brief:\n'+currentBriefData.plainText:'';
      var promptEl=document.getElementById('bb-prompt');
      var oldPrompt=promptEl?promptEl.value:'';
      callGenerateBriefAPI(btn.dataset.ddPrompt+existing,'',briefType,tone,'polish').then(function(data){
        if(data.quality==='good'&&data.sections&&data.sections.length){
          currentBriefData.sections=data.sections; currentBriefData.plainText=sectionsToPlainText(data.sections);
          document.getElementById('brief-output').innerHTML=renderSections(data.sections);
          wireSectionRegenButtons(briefType,tone);
          var readRow=document.getElementById('readability-row'); if(readRow){ readRow.innerHTML=renderReadability(currentBriefData.plainText); readRow.style.display='flex'; }
          if(currentWordLimit){ var wlBar=document.getElementById('word-limit-bar'); if(wlBar){ wlBar.innerHTML=renderWordLimitBar(currentBriefData.plainText); wlBar.style.display='block'; } }
          if(data.score){ var sb=document.getElementById('score-bars'); if(sb){ sb.innerHTML=renderScoreBars(data.score); sb.style.display='block'; requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); } }
        }
      }).catch(function(e){ console.warn('Dig deeper failed:',e.message); });
    });
  });
}

/* ② Score bars */
function renderScoreBars(score){
  var dims=[['Argument Strength',score.strength],['Clarity',score.clarity],['Evidence Use',score.evidence]];
  return '<div class="score-bars-title">Brief quality score</div>'+dims.map(function(d){
    var pct=Math.round((d[1]/10)*100); var color=d[1]>=8?'#22c55e':d[1]>=6?'#3b82f6':d[1]>=4?'#f59e0b':'#ef4444';
    return '<div class="score-bar-row"><span class="score-bar-label">'+d[0]+'</span><div class="score-bar-track"><div class="score-bar-fill" data-target="'+pct+'" style="width:0%;background:'+color+'"></div></div><span class="score-bar-num">'+d[1]+'/10</span></div>';
  }).join('');
}

/* ③ Readability */
function renderReadability(text){
  var words=text.trim().split(/\s+/).filter(Boolean); var wc=words.length;
  var sentences=(text.match(/[.!?]+/g)||[]).length||1; var avgWPS=wc/sentences;
  var syllables=words.reduce(function(s,w){ return s+countSyllables(w); },0); var avgSPW=wc>0?syllables/wc:1;
  var fkgl=Math.max(1,Math.min(18,Math.round(0.39*avgWPS+11.8*avgSPW-15.59)));
  var level=fkgl<=6?'Elementary':fkgl<=9?'Middle School':fkgl<=12?'High School':fkgl<=16?'College':'Graduate';
  return '<span class="read-pill">'+wc+' words</span><span class="read-pill">~'+Math.max(1,Math.round(wc/200))+' min read</span><span class="read-pill">Grade '+fkgl+' · '+level+'</span>';
}

function countSyllables(word){
  word=word.toLowerCase().replace(/[^a-z]/g,''); if(!word) return 1;
  var c=(word.match(/[aeiouy]+/g)||[]).length; if(word.match(/[^aeiou]e$/)) c--; return Math.max(1,c);
}

/* ④ PDF export */
function exportPDF(){
  if(!currentBriefData) return;
  var frame=document.getElementById('print-frame'); var sections=currentBriefData.sections;
  var html='<h1 style="font-size:20px;font-weight:700;margin-bottom:8px">'+escHtml(currentBriefData.title||'College Brief')+'</h1>'+
    '<p style="color:#6b7280;font-size:13px;margin-bottom:20px">'+escHtml(currentBriefData.briefType)+' · '+escHtml(currentBriefData.tone)+'</p>';
  if(sections&&sections.length){
    html+=sections.map(function(s){ return '<div style="margin-bottom:18px"><h2 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">'+escHtml(s.heading)+'</h2><ul style="margin:0;padding-left:18px">'+(s.bullets||[]).map(function(b){ return '<li style="margin-bottom:5px;line-height:1.6;font-size:14px">'+escHtml(b)+'</li>'; }).join('')+'</ul></div>'; }).join('');
  } else { html+='<pre style="font-size:13px;line-height:1.7;white-space:pre-wrap">'+escHtml(currentBriefData.plainText)+'</pre>'; }
  frame.innerHTML=html; window.print(); setTimeout(function(){ frame.innerHTML=''; },2000);
}

/* ⑧ Share link */
function encodeShareData(data){
  try { return btoa(unescape(encodeURIComponent(JSON.stringify({title:data.title,sections:data.sections,summary:data.summary,score:data.score,briefType:data.briefType,tone:data.tone})))); } catch(e){ return ''; }
}
function decodeShareData(encoded){ try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch(e){ return null; } }

function checkShareHash(){
  var hash=window.location.hash; if(!hash.startsWith('#brief=')) return;
  var data=decodeShareData(hash.slice(7)); if(!data) return;
  var banner=document.getElementById('share-banner'); if(banner) banner.classList.remove('hidden');
  switchView('briefs');
  setTimeout(function(){
    var outputEl=document.getElementById('brief-output'); var actionsEl=document.getElementById('output-actions'); var badgeEl=document.getElementById('gen-source');
    if(!outputEl) return;
    currentBriefData={ sections:data.sections||[], score:data.score||null, summary:data.summary||'', plainText:sectionsToPlainText(data.sections||[]), briefType:data.briefType||'College Essay Outline', tone:data.tone||'Neutral Analytic', title:data.title||'Shared Brief' };
    if(data.sections&&data.sections.length){ outputEl.innerHTML=renderSections(data.sections); wireSectionRegenButtons(data.briefType,data.tone); }
    if(actionsEl) actionsEl.style.display='flex';
    if(badgeEl){ badgeEl.textContent='☁ Shared'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
    var prompt=document.getElementById('bb-prompt'); if(prompt) prompt.value=data.title||'';
    if(data.score){ var sb=document.getElementById('score-bars'); if(sb){ sb.innerHTML=renderScoreBars(data.score); sb.style.display='block'; requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); } }
    if(data.summary){ var s=document.getElementById('brief-summary'); if(s){ s.textContent='"'+data.summary+'"'; s.style.display='block'; } }
  },100);
  var closeBanner=document.getElementById('btn-close-banner');
  if(closeBanner) closeBanner.addEventListener('click',function(){ var b=document.getElementById('share-banner'); if(b) b.classList.add('hidden'); window.location.hash=''; });
  var importBtn=document.getElementById('btn-import-shared');
  if(importBtn) importBtn.addEventListener('click',function(){
    if(!currentUser){ alert('Sign in to save this brief.'); return; }
    if(!currentBriefData) return;
    var entry={ id:uid(), title:data.title||'Shared Brief', briefType:data.briefType||'College Essay Outline', tone:data.tone||'Neutral Analytic', createdAt:Date.now(), outlineText:currentBriefData.plainText, sections:currentBriefData.sections||[], score:currentBriefData.score||null, summary:currentBriefData.summary||'' };
    var briefs=loadBriefs(); briefs.unshift(entry); if(briefs.length>30) briefs=briefs.slice(0,30); saveBriefs(briefs); cloudSaveBrief(entry);
    importBtn.textContent='Saved!'; setTimeout(function(){ var b=document.getElementById('share-banner'); if(b) b.classList.add('hidden'); window.location.hash=''; },1500); updateSidebarStats();
  });
}

/* ─── History ────────────────────────────────────────── */
function renderHistoryList(briefs){
  var q=(briefSearchQuery||'').toLowerCase().trim();
  var filtered=q?briefs.filter(function(b){ return (b.title||'').toLowerCase().includes(q)||(b.briefType||'').toLowerCase().includes(q)||((b.tags||[]).join(' ')).toLowerCase().includes(q); }):briefs;
  if(!filtered.length) return '<div class="empty-state">'+(q?'No briefs match "'+escHtml(q)+'"':'No saved briefs yet.')+'</div>';
  return '<ul class="brief-history">'+filtered.slice(0,12).map(function(b){
    var date=b.createdAt?new Date(b.createdAt).toLocaleDateString():'';
    var scoreHtml=''; if(b.score&&b.score.strength){ var avg=Math.round((b.score.strength+b.score.clarity+b.score.evidence)/3); scoreHtml='<span class="history-score">'+avg+'/10</span>'; }
    var tagsHtml=(b.tags&&b.tags.length)?b.tags.map(function(t){ return '<span class="brief-tag">'+escHtml(t)+'</span>'; }).join(''):'';
    return '<li>'+
      '<div style="flex:1;min-width:0">'+
        '<div class="bh-title">'+escHtml(b.title||b.briefType)+'</div>'+
        (tagsHtml?'<div class="brief-tags-row">'+tagsHtml+'</div>':'')+
        '<div class="bh-meta">'+escHtml(b.briefType)+(date?' · '+date:'')+'</div>'+
      '</div>'+
      scoreHtml+
      '<button class="btn-ghost btn-small" data-brief-id="'+b.id+'">Load</button>'+
    '</li>';
  }).join('')+'</ul>';
}

function wireHistoryButtons(){
  document.querySelectorAll('[data-brief-id]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var brief=loadBriefs().find(function(b){ return b.id===btn.dataset.briefId; }); if(!brief) return;
      var outputEl=document.getElementById('brief-output'); if(!outputEl) return;
      currentBriefData={ sections:brief.sections||[], score:brief.score||null, summary:brief.summary||'', plainText:brief.outlineText, briefType:brief.briefType, tone:brief.tone||'Neutral Analytic', title:brief.title };
      if(brief.sections&&brief.sections.length){ outputEl.innerHTML=renderSections(brief.sections); wireSectionRegenButtons(brief.briefType,brief.tone||'Neutral Analytic'); }
      else{ outputEl.innerHTML='<pre class="brief-pre">'+escHtml(brief.outlineText)+'</pre>'; }
      var actionsEl=document.getElementById('output-actions'); if(actionsEl) actionsEl.style.display='flex';
      var badgeEl=document.getElementById('gen-source'); if(badgeEl){ badgeEl.textContent='☁ Saved'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
      var sb=document.getElementById('score-bars'); if(sb){ if(brief.score){ sb.innerHTML=renderScoreBars(brief.score); sb.style.display='block'; requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); } else sb.style.display='none'; }
      var readRow=document.getElementById('readability-row'); if(readRow&&brief.outlineText){ readRow.innerHTML=renderReadability(brief.outlineText); readRow.style.display='flex'; }
      var summaryEl=document.getElementById('brief-summary'); if(summaryEl&&brief.summary){ summaryEl.textContent='"'+brief.summary+'"'; summaryEl.style.display='block'; } else if(summaryEl) summaryEl.style.display='none';
      var prompt=document.getElementById('bb-prompt'); if(prompt) prompt.value=brief.title||'';
      var typeEl=document.getElementById('bb-type'); if(typeEl&&brief.briefType) typeEl.value=brief.briefType;
      document.querySelectorAll('.type-switch-btn').forEach(function(b){ b.classList.toggle('active',b.dataset.type===brief.briefType); });
      document.getElementById('share-panel').style.display='none';
      var sp=document.getElementById('dig-deeper-row'); if(sp) sp.style.display='none';
      if(currentWordLimit){ var wlBar=document.getElementById('word-limit-bar'); if(wlBar){ wlBar.innerHTML=renderWordLimitBar(brief.outlineText); wlBar.style.display='block'; } }
    });
  });
}

/* ═══════════════════════════════════════════════════════
   OPPORTUNITIES + URGENCY + CHECKLIST + ⑥ PRIORITY STARS
══════════════════════════════════════════════════════════ */
var OPP_STATUSES=['Not started','Brainstorming','Drafting','Polishing','Submitted','Result'];
var OPP_CATS=['College','Scholarship','Program','Competition','Other'];
var CHECKLIST_ITEMS=[
  {key:'essay',label:'Essay Draft'},{key:'rec',label:'Rec Letters'},
  {key:'scores',label:'Test Scores'},{key:'resume',label:'Resume / CV'},{key:'activities',label:'Activity List'},
];

function getDaysUntil(deadline){ if(!deadline) return 9999; var d=new Date(deadline); d.setHours(23,59,59); return Math.ceil((d-Date.now())/(1000*60*60*24)); }

function urgencyBadge(deadline){
  var days=getDaysUntil(deadline);
  if(days<0) return '<span class="urgency-badge urgency-past">Passed</span>';
  if(days===0) return '<span class="urgency-badge urgency-red">Today!</span>';
  if(days<=7) return '<span class="urgency-badge urgency-red">'+days+'d left</span>';
  if(days<=30) return '<span class="urgency-badge urgency-amber">'+days+'d left</span>';
  return '<span class="urgency-badge urgency-green">'+days+'d</span>';
}

/* ⑥ Priority stars */
function renderStars(oppId, currentPriority){
  var p=currentPriority||0;
  return '<div class="priority-stars" data-star-opp="'+oppId+'">'+
    [1,2,3,4,5].map(function(n){ return '<button class="star-btn'+(n<=p?' filled':'')+'" data-star-n="'+n+'" data-star-opp="'+oppId+'" title="Priority '+n+'">★</button>'; }).join('')+
  '</div>';
}

function renderOpps(){
  var opps=loadOpps().slice().sort(function(a,b){ return getDaysUntil(a.deadline)-getDaysUntil(b.deadline); });
  return '<div class="opp-intro-bar"><div>'+
    '<h2>Applications &amp; Programs</h2>'+
    '<p class="subtitle">Track deadlines, link essays, monitor progress — sorted by deadline.</p>'+
  '</div></div>'+
  '<div class="card">'+
    '<p class="section-heading">Add new</p>'+
    '<div class="opp-form-grid">'+
      '<div class="form-group"><label for="opp-name">Name <span class="req">*</span></label><input type="text" id="opp-name" placeholder="e.g. Dartmouth ED, QuestBridge, Gates Scholarship"></div>'+
      '<div class="form-group"><label for="opp-cat">Category</label><select id="opp-cat">'+OPP_CATS.map(function(c){ return '<option>'+c+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label for="opp-deadline">Deadline <span class="req">*</span></label><input type="date" id="opp-deadline"></div>'+
      '<div class="form-group"><label for="opp-status">Status</label><select id="opp-status">'+OPP_STATUSES.map(function(s){ return '<option>'+s+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label for="opp-link">Link</label><input type="url" id="opp-link" placeholder="https://"></div>'+
      '<div class="form-group"><label for="opp-strategy">Strategy note</label><input type="text" id="opp-strategy" placeholder="Angle or story to emphasize"></div>'+
    '</div>'+
    '<button id="btn-add-opp" class="btn-primary">Add application</button>'+
  '</div>'+
  '<div id="opp-list">'+renderOppCards(opps)+'</div>';
}

function renderOppCards(opps){
  if(!opps.length) return '<div class="empty-state" style="margin-top:8px">No applications tracked yet. Add one above.</div>';
  return '<div class="opp-cards">'+opps.map(function(o){
    var dl=o.deadline?formatDate(o.deadline):'No deadline';
    var linkHtml=o.link?'<a href="'+escHtml(o.link)+'" target="_blank" rel="noopener" class="opp-link">Website ↗</a>':'';
    var statusOpts=OPP_STATUSES.map(function(s){ return '<option'+(s===o.status?' selected':'')+'>'+s+'</option>'; }).join('');
    var cl=loadChecklist(o.id); var done=CHECKLIST_ITEMS.filter(function(i){ return cl[i.key]; }).length; var total=CHECKLIST_ITEMS.length;
    return '<div class="opp-card">'+
      '<div class="opp-card-top">'+
        '<div style="flex:1">'+
          '<div class="opp-card-name">'+escHtml(o.name)+'</div>'+
          '<div class="opp-card-meta">'+
            '<span class="chip chip-cat">'+escHtml(o.category||'Other')+'</span>'+
            urgencyBadge(o.deadline)+
            '<span class="opp-deadline">Due '+escHtml(dl)+'</span>'+
            linkHtml+
          '</div>'+
        '</div>'+
        '<select class="status-select '+statusClass(o.status)+'" data-status-id="'+o.id+'">'+statusOpts+'</select>'+
      '</div>'+
      renderStars(o.id,o.priority)+
      (o.strategy?'<div class="opp-strategy">'+escHtml(o.strategy)+'</div>':'')+
      '<div class="opp-checklist">'+
        '<button class="checklist-toggle btn-ghost btn-small" data-cl-opp="'+o.id+'">☑ Checklist ('+done+'/'+total+') · '+Math.round(done/total*100)+'%</button>'+
        '<div class="checklist-items" id="cl-'+o.id+'" style="display:none">'+
          CHECKLIST_ITEMS.map(function(item){ return '<label class="checklist-item"><input type="checkbox" data-cl-id="'+o.id+'" data-cl-key="'+item.key+'"'+(cl[item.key]?' checked':'')+' />'+item.label+'</label>'; }).join('')+
        '</div>'+
      '</div>'+
      '<div class="opp-card-actions"><button class="btn-primary btn-small" data-opp-id="'+o.id+'">Open in Brief Builder →</button></div>'+
    '</div>';
  }).join('')+'</div>';
}

function wireOpps(){
  document.getElementById('btn-add-opp').addEventListener('click',function(){
    var name=document.getElementById('opp-name').value.trim(); var deadline=document.getElementById('opp-deadline').value;
    if(!name){ alert('Please enter a name.'); return; } if(!deadline){ alert('Please enter a deadline.'); return; }
    var opp={ id:uid(), name:name, category:document.getElementById('opp-cat').value, deadline:deadline, status:document.getElementById('opp-status').value, link:document.getElementById('opp-link').value.trim(), strategy:document.getElementById('opp-strategy').value.trim(), createdAt:Date.now(), priority:0 };
    var opps=loadOpps(); opps.unshift(opp); saveOpps(opps); cloudSaveOpp(opp);
    ['opp-name','opp-deadline','opp-link','opp-strategy'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('opp-status').value='Not started';
    document.getElementById('opp-list').innerHTML=renderOppCards(loadOpps()); wireOppButtons(); updateSidebarStats();
  });
  wireOppButtons();
}

function wireOppButtons(){
  document.querySelectorAll('[data-opp-id]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var opp=loadOpps().find(function(o){ return o.id===btn.dataset.oppId; }); if(!opp) return;
      var prompt='Write a College Essay Outline for: '+opp.name+' ('+( opp.category||'College')+').'+( opp.strategy?' Strategy: '+opp.strategy+'.':'');
      switchView('briefs'); document.getElementById('bb-prompt').value=prompt; document.getElementById('bb-type').value='College Essay Outline';
    });
  });
  document.querySelectorAll('[data-status-id]').forEach(function(sel){
    sel.addEventListener('change',function(){
      var opps=loadOpps(); var opp=opps.find(function(o){ return o.id===sel.dataset.statusId; }); if(!opp) return;
      opp.status=sel.value; saveOpps(opps); cloudUpdateOpp(opp.id,{status:opp.status}); sel.className='status-select '+statusClass(sel.value);
    });
  });
  document.querySelectorAll('.checklist-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){ var div=document.getElementById('cl-'+btn.dataset.clOpp); if(div) div.style.display=div.style.display==='none'?'flex':'none'; });
  });
  document.querySelectorAll('[data-cl-id]').forEach(function(cb){
    cb.addEventListener('change',function(){
      var cl=loadChecklist(cb.dataset.clId); cl[cb.dataset.clKey]=cb.checked; saveChecklist(cb.dataset.clId,cl);
      var done=CHECKLIST_ITEMS.filter(function(i){ return cl[i.key]; }).length; var total=CHECKLIST_ITEMS.length;
      var toggle=document.querySelector('[data-cl-opp="'+cb.dataset.clId+'"]');
      if(toggle) toggle.textContent='☑ Checklist ('+done+'/'+total+') · '+Math.round(done/total*100)+'%';
    });
  });
  /* ⑥ Priority stars */
  document.querySelectorAll('.star-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var oppId=btn.dataset.starOpp; var n=parseInt(btn.dataset.starN);
      var opps=loadOpps(); var opp=opps.find(function(o){ return o.id===oppId; }); if(!opp) return;
      opp.priority=opp.priority===n?0:n; saveOpps(opps); cloudUpdateOpp(oppId,{priority:opp.priority});
      document.querySelectorAll('.star-btn[data-star-opp="'+oppId+'"]').forEach(function(s){ s.classList.toggle('filled',parseInt(s.dataset.starN)<=opp.priority); });
    });
  });
}

/* ═══════════════════════════════════════════════════════
   ① DARK MODE
══════════════════════════════════════════════════════════ */
function initDarkMode(){
  var saved=localStorage.getItem('cbl-theme')||'light';
  if(saved==='dark') document.documentElement.setAttribute('data-theme','dark');
}

function toggleDarkMode(){
  var isDark=document.documentElement.getAttribute('data-theme')==='dark';
  if(isDark){ document.documentElement.removeAttribute('data-theme'); localStorage.setItem('cbl-theme','light'); }
  else{ document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('cbl-theme','dark'); }
  /* Refresh the controls label */
  updateSidebarStats();
  wireSidebarControls();
}

/* ⑦ FOCUS MODE ══════════════════════════════════════════ */
function toggleFocusMode(){
  if(focusMode) exitFocusMode();
  else enterFocusMode();
}

function enterFocusMode(){
  focusMode=true;
  document.body.classList.add('focus-mode');
  var hint=document.createElement('div'); hint.id='focus-hint'; hint.className='focus-hint';
  hint.textContent='Focus mode — press Esc to exit'; document.body.appendChild(hint);
  setTimeout(function(){ var h=document.getElementById('focus-hint'); if(h) h.style.opacity='0'; },2500);
}

function exitFocusMode(){
  focusMode=false;
  document.body.classList.remove('focus-mode');
  var hint=document.getElementById('focus-hint'); if(hint) hint.remove();
}

/* ④ KEYBOARD SHORTCUTS ══════════════════════════════════ */
function initKeyboardShortcuts(){
  document.addEventListener('keydown',function(e){
    var tag=document.activeElement&&document.activeElement.tagName;
    var inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
    /* Ctrl/Cmd shortcuts work anywhere */
    if(e.ctrlKey||e.metaKey){
      if(e.key==='Enter'){ e.preventDefault(); if(currentView==='briefs'){ var btn=document.getElementById('btn-generate'); if(btn&&!btn.disabled) btn.click(); } }
      if(e.key==='s'){ e.preventDefault(); if(currentView==='briefs'){ var sb=document.getElementById('btn-save'); if(sb) sb.click(); } }
      if(e.key==='k'){ e.preventDefault(); switchView('briefs'); setTimeout(function(){ var p=document.getElementById('bb-prompt'); if(p){ p.focus(); p.select(); } },100); }
      if(e.key==='f'){ e.preventDefault(); toggleFocusMode(); }
      if(e.key==='d'){ e.preventDefault(); toggleDarkMode(); }
    }
    /* Single-key shortcuts only outside inputs */
    if(!inInput){
      if(e.key==='?'){ showShortcutsModal(); }
      if(e.key==='Escape'){ if(focusMode){ exitFocusMode(); } else { var modal=document.getElementById('shortcuts-modal'); if(modal) modal.remove(); } }
      if(e.key==='1') switchView('dashboard');
      if(e.key==='2') switchView('briefs');
      if(e.key==='3') switchView('opportunities');
    }
  });
}

function showShortcutsModal(){
  var existing=document.getElementById('shortcuts-modal'); if(existing){ existing.remove(); return; }
  var shortcuts=[
    ['Ctrl+Enter','Generate brief'],['Ctrl+S','Save brief'],['Ctrl+K','Go to Brief Builder'],
    ['Ctrl+F','Toggle focus mode'],['Ctrl+D','Toggle dark mode'],
    ['1 / 2 / 3','Switch views (outside input)'],['?','Show this panel'],['Esc','Close / exit focus'],
  ];
  var modal=document.createElement('div'); modal.id='shortcuts-modal'; modal.className='shortcuts-modal';
  modal.innerHTML='<div class="shortcuts-modal-inner">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'+
      '<strong style="font-size:14px">Keyboard shortcuts</strong>'+
      '<button id="btn-close-shortcuts" class="btn-secondary btn-small">✕ Close</button>'+
    '</div>'+
    shortcuts.map(function(s){ return '<div class="shortcut-row"><kbd>'+s[0]+'</kbd><span>'+s[1]+'</span></div>'; }).join('')+
  '</div>';
  document.body.appendChild(modal);
  document.getElementById('btn-close-shortcuts').addEventListener('click',function(){ modal.remove(); });
  modal.addEventListener('click',function(e){ if(e.target===modal) modal.remove(); });
}

/* ⑨ BROWSER DEADLINE NOTIFICATIONS ════════════════════ */
function initNotifications(){
  if(!('Notification' in window)) return;
  /* Check deadlines silently if already permitted */
  if(Notification.permission==='granted'){ setTimeout(checkAndFireNotifications,2000); }
  /* Add a non-intrusive prompt to the opp page if not yet decided */
}

function requestNotificationPermission(){
  if(!('Notification' in window)){ alert('Your browser does not support notifications.'); return; }
  Notification.requestPermission().then(function(permission){
    if(permission==='granted'){
      checkAndFireNotifications();
      updateSidebarStats();
    }
  });
}

function checkAndFireNotifications(){
  if(Notification.permission!=='granted') return;
  var opps=loadOpps();
  opps.forEach(function(o){
    var days=getDaysUntil(o.deadline);
    if(days>=0&&days<=1){
      var key='cbl-notif-'+o.id+'-'+Math.floor(Date.now()/(1000*60*60*12));
      if(!localStorage.getItem(key)){
        localStorage.setItem(key,'1');
        new Notification('⏰ Deadline '+(days===0?'today':'tomorrow')+'!',{
          body:o.name+(o.deadline?' — due '+formatDate(o.deadline):''),
          icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%233b5bdb"/><text x="8" y="22" font-size="18" fill="white">C</text></svg>',
          tag:'cbl-deadline-'+o.id,
        });
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════
   LOCAL BRIEF GENERATION ENGINE (offline fallback)
══════════════════════════════════════════════════════════ */
var STOPWORDS=new Set(['the','this','that','with','from','about','into','there','which','would','could','should','have','been','being','because','against','between','under','each','other','such','only','very','over','after','before','again','further','then','once','also','both','does','more','most','some','than','when','where','while','your','their','they','them','will','were','what','just','here','even','still','well','back','many','much','too','our','and','but','for','not','you','all','can','her','was','one','has','his','him','any','its','how','who','did','get','may','own','out','use','now','way','new','see']);

function extractKeywords(text){
  if(!text||!text.trim()) return [];
  var freq={};
  text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w){ if(w.length>=4&&!STOPWORDS.has(w)) freq[w]=(freq[w]||0)+1; });
  return Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; }).slice(0,5);
}

function tonePhrase(base,tone){
  var map={ thesis:{'Neutral Analytic':'This analysis finds','Advocacy':'This brief argues','Academic Formal':'This paper contends'}, evidence:{'Neutral Analytic':'The evidence suggests','Advocacy':'We must recognize','Academic Formal':'The available evidence indicates'}, conclude:{'Neutral Analytic':'The brief finds','Advocacy':'It is urgent that','Academic Formal':'Consequently, this analysis finds'} };
  return (map[base]&&map[base][tone])||base;
}

function generateBrief(prompt,sourceNotes,briefType,tone){
  var trimmed=prompt.trim(); if(!trimmed) return null;
  var m=trimmed.match(/^([^.!?]{5,})[.!?]/); var topic=m?m[1].trim():(trimmed.length<=80?trimmed:trimmed.slice(0,trimmed.lastIndexOf(' ',80)));
  var kw=extractKeywords(sourceNotes); if(!kw.length) kw=extractKeywords(trimmed).slice(0,3); if(!kw.length) kw=[topic.split(' ').filter(function(w){return w.length>3;})[0]||topic.split(' ')[0]];
  var sections=briefType==='Debate Case'?buildDebateCase(topic,kw,tone):briefType==='Policy Memo'?buildPolicyMemo(topic,kw,tone):buildEssayOutline(topic,kw,tone);
  var plainText=sections.map(function(s){ return s.heading+'\n'+s.lines.map(function(l){ return stripTags(l); }).join('\n'); }).join('\n\n');
  return { sections:sections, plainText:plainText };
}

function buildDebateCase(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0,k2=kw[2]||k0; var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [{heading:'Thesis',lines:[th+' that '+topic+' — supported by convergent social, institutional, and empirical evidence.']},{heading:'Contention 1 — Social consequences',lines:['The ramifications of '+topic+' extend beyond abstract principle.',ev+' that data on '+k0+' shows inaction widens inequality.']},{heading:'Contention 2 — Systemic implications',lines:[k1+' operates as a systemic variable — changes reverberate across legal, economic, and social systems.']},{heading:'Contention 3 — Democratic stakes',lines:['When governing bodies defer on '+k2+', they erode public trust.']},{heading:'Counterargument 1 + Response',lines:['Objection: The harms are overstated. Response: '+ev+' that even conservative estimates support action.']},{heading:'Counterargument 2 + Response',lines:['Objection: Incremental reform is better. Response: Incremental reform has failed in analogous contexts.']},{heading:'Conclusion',lines:[co+' that the evidence supports action — not as ideology, but as a principled response to what the data shows.']}];
}

function buildPolicyMemo(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0; var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [{heading:'Executive Summary',lines:[th+' that the current approach to '+topic+' is insufficient.',ev+' that a phased intervention targeting '+k0+' offers the strongest path to reform.']},{heading:'Background',lines:['The debate over '+topic+' has seen repeated calls for action met by fragmented responses.']},{heading:'Problem Statement',lines:[topic+' lacks an enforceable framework.']},{heading:'Policy Options',lines:['Option A — Status quo: low cost, fails to address structural drivers.','Option B — Targeted reform: binding standards on '+k0+'.','Option C — Hybrid framework: incentives plus baseline regulatory requirements.']},{heading:'Recommendation',lines:[th+' that Option C provides the strongest foundation.',co+' that comparable frameworks achieved durable results within 3–5 years.']},{heading:'Next Steps',lines:['Commission a 30-day landscape assessment.','Convene a cross-sector working group.','Establish measurable success criteria and a 12-month review cycle.']}];
}

function buildEssayOutline(topic,kw,tone){
  var k0=kw[0]||'this experience',k1=kw[1]||k0;
  return [{heading:'Hook',lines:['Open with a precise moment directly connected to '+topic+'.']},{heading:'Core Story',lines:['Establish the situation and the central tension in relation to '+topic+'.']},{heading:'Key Moment 1',lines:['Describe the first time you engaged seriously with '+topic+'.']},{heading:'Key Moment 2',lines:['Introduce the moment when your initial understanding proved incomplete.']},{heading:'Key Moment 3',lines:['Describe the decision or realization that marked a shift.']},{heading:'Reflection',lines:['What changed internally — in beliefs, habits, or understanding of '+k1+'?']},{heading:'Takeaway',lines:['Connect your experience with '+topic+' to who you are becoming.']}];
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════ */
function statusClass(s){ return {'Not started':'status-neutral','Brainstorming':'status-purple','Drafting':'status-blue','Polishing':'status-amber','Submitted':'status-green','Result':'status-result'}[s]||'status-neutral'; }
function formatDate(str){ if(!str) return ''; var p=str.split('-'); if(p.length!==3) return str; return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2])).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function escHtml(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stripTags(s){ return s.replace(/<[^>]*>/g,''); }

/* ═══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
initDarkMode();
initKeyboardShortcuts();
checkShareHash();
document.querySelector('.sb-nav-item[data-view="dashboard"]').classList.add('active');
renderSidebar();
renderView();
/* Notifications fire after a short delay (user must have granted permission earlier) */
setTimeout(initNotifications, 1500);
