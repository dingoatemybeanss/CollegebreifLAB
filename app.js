/* ═══════════════════════════════════════════════════════
   COLLEGE BRIEF LAB — app.js
   10 business-grade features + structured AI output
══════════════════════════════════════════════════════════ */

/* ─── Global state ────────────────────────────────────── */
var currentUser        = null;
var userProfile        = null;
var currentView        = 'dashboard';
var currentBriefData   = null; // { sections, score, summary, plainText, briefType, tone, title }
var _unsubBriefs       = null;
var _unsubOpps         = null;

/* ─── LocalStorage keys ───────────────────────────────── */
var KEY_BRIEFS = 'cbl-briefs';
var KEY_OPPS   = 'cbl-opportunities';

function loadBriefs() { try { return JSON.parse(localStorage.getItem(KEY_BRIEFS)||'[]'); } catch(e){ return []; } }
function saveBriefs(a){ localStorage.setItem(KEY_BRIEFS, JSON.stringify(a)); }
function loadOpps()   { try { return JSON.parse(localStorage.getItem(KEY_OPPS)||'[]');   } catch(e){ return []; } }
function saveOpps(a)  { localStorage.setItem(KEY_OPPS,   JSON.stringify(a)); }
function loadChecklist(oppId) { try { return JSON.parse(localStorage.getItem('cbl-cl-'+oppId)||'{}'); } catch(e){ return {}; } }
function saveChecklist(oppId, data) { localStorage.setItem('cbl-cl-'+oppId, JSON.stringify(data)); }
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ═══════════════════════════════════════════════════════
   FIRESTORE SYNC
══════════════════════════════════════════════════════════ */
function getDB(){ try { return firebase.firestore(); } catch(e){ return null; } }

function startFirestoreSync(){
  if(!currentUser) return;
  var db=getDB(); if(!db) return;
  var userId=currentUser.uid;
  migrateLocalToFirestore(db,userId);
  _unsubBriefs = db.collection('users').doc(userId).collection('briefs')
    .orderBy('createdAt','desc').onSnapshot(function(snap){
      saveBriefs(snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }));
      softRefresh('briefs');
    }, function(e){ console.warn('Briefs sync:',e.message); });
  _unsubOpps = db.collection('users').doc(userId).collection('opportunities')
    .orderBy('createdAt','desc').onSnapshot(function(snap){
      saveOpps(snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }));
      softRefresh('opportunities');
    }, function(e){ console.warn('Opps sync:',e.message); });
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

function cloudSaveBrief(brief){
  var db=getDB(); if(!db||!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('briefs').doc(brief.id)
    .set(brief).catch(function(e){ console.warn(e.message); });
}

function cloudSaveOpp(opp){
  var db=getDB(); if(!db||!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(opp.id)
    .set(opp).catch(function(e){ console.warn(e.message); });
}

function cloudUpdateOpp(id,data){
  var db=getDB(); if(!db||!currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(id)
    .update(data).catch(function(e){ console.warn(e.message); });
}

function softRefresh(changed){
  updateSidebarStats();
  if(currentView==='dashboard'){ renderView(); return; }
  if(currentView==='briefs'&&changed==='briefs'){
    var el=document.getElementById('brief-history');
    if(el){ el.innerHTML=renderHistoryList(loadBriefs()); wireHistoryButtons(); }
    return;
  }
  if(currentView==='opportunities'&&changed==='opportunities'){
    var el2=document.getElementById('opp-list');
    if(el2){ el2.innerHTML=renderOppCards(loadOpps()); wireOppButtons(); }
  }
}

/* ═══════════════════════════════════════════════════════
   AUTH STATE
══════════════════════════════════════════════════════════ */
function handleAuthState(event){
  currentUser=event.detail.user||null;
  userProfile=event.detail.profile||null;
  if(currentUser){ startFirestoreSync(); } else { stopFirestoreSync(); }
  renderSidebar();
  renderView();
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
  if(!currentUser){ footer.innerHTML=''; return; }
  var briefs=loadBriefs(); var opps=loadOpps();
  var upcoming=opps.filter(function(o){ return getDaysUntil(o.deadline)<=30&&getDaysUntil(o.deadline)>=0; }).length;
  footer.innerHTML=
    '<div class="sb-stat-row"><span class="sb-stat-label">Briefs</span><span class="sb-stat-value">'+briefs.length+'</span></div>'+
    '<div class="sb-stat-row"><span class="sb-stat-label">Applications</span><span class="sb-stat-value">'+opps.length+'</span></div>'+
    (upcoming?'<div class="sb-stat-row"><span class="sb-stat-label" style="color:#f59e0b">Deadlines soon</span><span class="sb-stat-value" style="color:#f59e0b">'+upcoming+'</span></div>':'')+
    '<div class="sb-sync-dot">☁ Synced across devices</div>';
}

document.querySelectorAll('.sb-nav-item').forEach(function(btn){
  btn.addEventListener('click',function(){ switchView(btn.dataset.view); });
});

function switchView(view){
  currentView=view;
  document.querySelectorAll('.sb-nav-item').forEach(function(b){ b.classList.toggle('active',b.dataset.view===view); });
  renderView();
}

function renderView(){
  var main=document.getElementById('app-main'); if(!main) return;
  if(currentView==='dashboard')          { main.innerHTML=renderDashboard();  wireDashboard(); }
  else if(currentView==='briefs')        { main.innerHTML=renderBriefs();     wireBriefs(); }
  else if(currentView==='opportunities') { main.innerHTML=renderOpps();       wireOpps(); }
}

/* ═══════════════════════════════════════════════════════
   ① DASHBOARD + SMART INSIGHTS
══════════════════════════════════════════════════════════ */
function renderDashboard(){
  if(!currentUser){
    return '<div class="signed-out-msg">'+
      '<div class="signed-out-icon">✦</div>'+
      '<strong>College Brief Lab</strong>'+
      '<p>Build structured arguments, essay outlines, and policy memos — powered by AI. Sign in to sync across devices.</p>'+
    '</div>';
  }

  var briefs=loadBriefs(); var opps=loadOpps();
  var firstName=(userProfile&&userProfile.displayName)?userProfile.displayName.split(' ')[0]:'';
  var inProgress=opps.filter(function(o){ return ['Brainstorming','Drafting','Polishing'].indexOf(o.status)>-1; }).length;

  var activity=[];
  briefs.forEach(function(b){ activity.push({type:'brief',title:b.title||b.briefType,id:b.id,createdAt:b.createdAt}); });
  opps.forEach(function(o){ activity.push({type:'opp',title:o.name,id:o.id,createdAt:o.createdAt}); });
  activity.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  activity=activity.slice(0,5);

  var actHtml=activity.length===0
    ?'<div class="empty-state">No activity yet. Build a brief or add an application to get started.</div>'
    :'<ul class="activity-list">'+activity.map(function(item){
        var cls=item.type==='opp'?'chip chip-opp':'chip chip-brief';
        var lbl=item.type==='opp'?'App':'Brief';
        return '<li><span class="'+cls+'">'+lbl+'</span><span class="activity-title">'+escHtml(item.title)+'</span>'+
          '<button class="btn-ghost btn-small" data-type="'+item.type+'" data-id="'+item.id+'">Open →</button></li>';
      }).join('')+'</ul>';

  return '<div class="hero-card">'+
    '<h2>Good to see you'+(firstName?', '+escHtml(firstName):'')+' ✦</h2>'+
    '<p>Build arguments, essay outlines, and policy memos — then link them to your college applications.</p>'+
  '</div>'+
  '<div class="stat-grid">'+
    statCard(briefs.length,'Briefs created')+
    statCard(opps.length,'Applications tracked')+
    statCard(inProgress,'In progress')+
  '</div>'+
  renderInsights(briefs,opps)+
  '<div class="card"><p class="section-heading">Recent activity</p>'+actHtml+'</div>';
}

/* ① Smart Insights ──────────────────────────────────────── */
function renderInsights(briefs,opps){
  var insights=[];

  // Upcoming deadlines
  var urgent=opps.filter(function(o){ var d=getDaysUntil(o.deadline); return d>=0&&d<=7; });
  var soon=opps.filter(function(o){ var d=getDaysUntil(o.deadline); return d>7&&d<=30; });
  if(urgent.length){
    insights.push({ icon:'🔴', text: urgent.length+' application'+(urgent.length>1?'s':'')+' due within 7 days', cta:'View', view:'opportunities' });
  } else if(soon.length){
    insights.push({ icon:'🟡', text: soon.length+' deadline'+(soon.length>1?'s':'')+' in the next 30 days', cta:'View', view:'opportunities' });
  }

  // Brief type breakdown
  if(briefs.length>=3){
    var typeCounts={};
    briefs.forEach(function(b){ typeCounts[b.briefType]=(typeCounts[b.briefType]||0)+1; });
    var top=Object.keys(typeCounts).sort(function(a,b){ return typeCounts[b]-typeCounts[a]; })[0];
    insights.push({ icon:'✦', text:'Your most-used brief type: '+top+' ('+typeCounts[top]+')', cta:'Build one', view:'briefs' });
  }

  // Completion rate
  if(opps.length>=3){
    var submitted=opps.filter(function(o){ return o.status==='Submitted'||o.status==='Result'; }).length;
    var pct=Math.round(submitted/opps.length*100);
    insights.push({ icon:'📊', text: pct+'% of applications submitted ('+submitted+' of '+opps.length+')', cta:'Track', view:'opportunities' });
  }

  // Writing streak
  if(briefs.length>=2){
    var recent=briefs.filter(function(b){ return b.createdAt&&(Date.now()-b.createdAt)<7*24*3600*1000; });
    if(recent.length>=2){
      insights.push({ icon:'🔥', text:'You\'ve built '+recent.length+' brief'+(recent.length>1?'s':'')+' this week — keep the momentum!', cta:null });
    }
  }

  if(!insights.length) return '';

  return '<div class="insight-cards">'+
    insights.map(function(ins){
      return '<div class="insight-card">'+
        '<span class="insight-icon">'+ins.icon+'</span>'+
        '<span class="insight-text">'+ins.text+'</span>'+
        (ins.cta?'<button class="btn-ghost btn-small" data-insight-view="'+(ins.view||'')+'">'+ins.cta+' →</button>':'')+
      '</div>';
    }).join('')+
  '</div>';
}

function statCard(n,label){ return '<div class="stat-card"><span class="stat-number">'+n+'</span><div class="stat-label">'+label+'</div></div>'; }

function wireDashboard(){
  document.querySelectorAll('.activity-list [data-type]').forEach(function(btn){
    btn.addEventListener('click',function(){ switchView(btn.dataset.type==='opp'?'opportunities':'briefs'); });
  });
  document.querySelectorAll('[data-insight-view]').forEach(function(btn){
    btn.addEventListener('click',function(){ if(btn.dataset.insightView) switchView(btn.dataset.insightView); });
  });
}

/* ═══════════════════════════════════════════════════════
   ⑥ TEMPLATES PANEL
══════════════════════════════════════════════════════════ */
var TEMPLATES = [
  { cat:'Essay', label:'Why I want to study Computer Science', briefType:'College Essay Outline' },
  { cat:'Essay', label:'A challenge I overcame', briefType:'College Essay Outline' },
  { cat:'Essay', label:'Why I want to attend a small liberal arts college', briefType:'College Essay Outline' },
  { cat:'Essay', label:'How a mentor shaped my ambitions', briefType:'College Essay Outline' },
  { cat:'Policy', label:'Should the US lower the voting age to 16?', briefType:'Policy Memo' },
  { cat:'Policy', label:'How should universities address the student mental health crisis?', briefType:'Policy Memo' },
  { cat:'Policy', label:'Should standardized testing be eliminated in college admissions?', briefType:'Policy Memo' },
  { cat:'Debate', label:'Social media does more harm than good to teenagers', briefType:'Debate Case' },
  { cat:'Debate', label:'Universal basic income would benefit society', briefType:'Debate Case' },
  { cat:'Debate', label:'AI in education threatens academic integrity', briefType:'Debate Case' },
  { cat:'Debate', label:'The US should abolish the Electoral College', briefType:'Debate Case' },
  { cat:'Debate', label:'Affirmative action in college admissions is justified', briefType:'Debate Case' },
];

function renderTemplates(){
  var bycat={};
  TEMPLATES.forEach(function(t){ (bycat[t.cat]=bycat[t.cat]||[]).push(t); });
  return '<div class="templates-panel" id="templates-panel" style="display:none">'+
    '<p class="section-heading" style="margin-bottom:10px">Quick-start templates</p>'+
    Object.keys(bycat).map(function(cat){
      return '<div class="templates-group"><span class="template-cat">'+cat+'</span>'+
        bycat[cat].map(function(t){
          return '<button class="template-btn" data-tpl-label="'+escHtml(t.label)+'" data-tpl-type="'+escHtml(t.briefType)+'">'+escHtml(t.label)+'</button>';
        }).join('')+
      '</div>';
    }).join('')+
  '</div>';
}

/* ═══════════════════════════════════════════════════════
   BRIEF BUILDER
══════════════════════════════════════════════════════════ */
function renderBriefs(){
  var briefs=loadBriefs();
  return '<div class="brief-builder">'+
    '<div class="card">'+
      '<h2>Brief Builder</h2>'+
      '<p class="subtitle">Generate a structured argument, memo, or essay outline — powered by AI.</p>'+

      /* Templates panel */
      '<button id="btn-toggle-templates" class="btn-ghost btn-small" style="margin-bottom:10px">⚡ Quick prompts</button>'+
      renderTemplates()+

      '<div class="form-group">'+
        '<label for="bb-prompt">Prompt or question <span class="req">*</span></label>'+
        '<textarea id="bb-prompt" rows="3" placeholder="e.g. Argue that end-to-end encryption undermines public safety and should be regulated."></textarea>'+
      '</div>'+
      '<div class="form-group">'+
        '<label for="bb-notes">Source notes <span class="opt">(optional)</span></label>'+
        '<textarea id="bb-notes" rows="2" placeholder="Paste key facts, quotes, or research you want the AI to use."></textarea>'+
      '</div>'+
      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">'+
        '<div style="flex:1;min-width:140px"><label for="bb-type">Type</label>'+
          '<select id="bb-type"><option>College Essay Outline</option><option>Policy Memo</option><option>Debate Case</option></select></div>'+
        '<div style="flex:1;min-width:140px"><label for="bb-tone">Tone</label>'+
          '<select id="bb-tone"><option>Neutral Analytic</option><option>Advocacy</option><option>Academic Formal</option></select></div>'+
        '<button id="btn-generate" class="btn-primary" style="padding:9px 22px;white-space:nowrap;height:36px">Generate →</button>'+
      '</div>'+
    '</div>'+

    '<div class="brief-builder-split">'+

      /* Output panel */
      '<div class="card" style="margin-bottom:0">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
          '<p class="section-heading" style="margin:0">Output</p>'+
          '<span id="gen-source" class="gen-source-badge" style="visibility:hidden"></span>'+
        '</div>'+
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your brief will appear here after generation.</span></div>'+
        /* ② Score bars */
        '<div id="score-bars" style="display:none" class="score-bars"></div>'+
        /* ③ Readability */
        '<div id="readability-row" style="display:none" class="readability-row"></div>'+
        /* Action buttons */
        '<div class="btn-row" id="output-actions" style="display:none">'+
          '<button id="btn-copy" class="btn-secondary btn-small">Copy</button>'+
          '<button id="btn-save" class="btn-primary btn-small">Save</button>'+
          '<button id="btn-polish" class="btn-secondary btn-small">✦ Polish</button>'+
          '<button id="btn-share" class="btn-secondary btn-small">Share →</button>'+
          '<button id="btn-pdf" class="btn-secondary btn-small">PDF ↓</button>'+
        '</div>'+
        /* ⑧ Share panel */
        '<div id="share-panel" class="share-panel" style="display:none">'+
          '<input id="share-url" type="text" readonly style="flex:1" />'+
          '<button id="btn-copy-share" class="btn-primary btn-small">Copy link</button>'+
        '</div>'+
        /* Brief summary */
        '<div id="brief-summary" class="brief-summary" style="display:none"></div>'+
      '</div>'+

      /* History panel */
      '<div class="card" style="margin-bottom:0">'+
        '<p class="section-heading">'+(currentUser?'☁ Saved briefs':'Recent briefs')+'</p>'+
        '<div id="brief-history">'+renderHistoryList(briefs)+'</div>'+
      '</div>'+

    '</div>'+
  '</div>';
}

/* ─── Wire brief builder ──────────────────────────────── */
function wireBriefs(){

  /* Templates toggle */
  document.getElementById('btn-toggle-templates').addEventListener('click',function(){
    var p=document.getElementById('templates-panel');
    p.style.display=p.style.display==='none'?'block':'none';
  });
  document.querySelectorAll('.template-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      document.getElementById('bb-prompt').value=btn.dataset.tplLabel;
      document.getElementById('bb-type').value=btn.dataset.tplType;
      document.getElementById('templates-panel').style.display='none';
    });
  });

  /* Generate */
  document.getElementById('btn-generate').addEventListener('click',function(){ runGenerate('generate'); });

  /* Copy */
  document.getElementById('btn-copy').addEventListener('click',function(){
    if(!currentBriefData) return;
    navigator.clipboard.writeText(currentBriefData.plainText).then(function(){
      var b=document.getElementById('btn-copy'); b.textContent='Copied!';
      setTimeout(function(){ b.textContent='Copy'; },1800);
    }).catch(function(){ alert('Please select and copy the text manually.'); });
  });

  /* Save */
  document.getElementById('btn-save').addEventListener('click',function(){
    if(!currentBriefData) return;
    var prompt=document.getElementById('bb-prompt').value.trim();
    var entry={ id:uid(), title:prompt.slice(0,80), briefType:document.getElementById('bb-type').value,
      tone:document.getElementById('bb-tone').value, createdAt:Date.now(),
      outlineText:currentBriefData.plainText, sections:currentBriefData.sections||[],
      score:currentBriefData.score||null, summary:currentBriefData.summary||'' };
    var briefs=loadBriefs(); briefs.unshift(entry);
    if(briefs.length>30) briefs=briefs.slice(0,30);
    saveBriefs(briefs); cloudSaveBrief(entry);
    var b=document.getElementById('btn-save'); b.textContent='Saved!';
    setTimeout(function(){ b.textContent='Save'; },1800);
    document.getElementById('brief-history').innerHTML=renderHistoryList(loadBriefs());
    wireHistoryButtons(); updateSidebarStats();
  });

  /* ⑦ Polish */
  document.getElementById('btn-polish').addEventListener('click',function(){
    if(!currentBriefData||!currentBriefData.plainText) return;
    runGenerate('polish');
  });

  /* ⑧ Share */
  document.getElementById('btn-share').addEventListener('click',function(){
    if(!currentBriefData) return;
    var panel=document.getElementById('share-panel');
    var isOpen=panel.style.display!=='none';
    if(isOpen){ panel.style.display='none'; return; }
    var encoded=encodeShareData(currentBriefData);
    var url=window.location.origin+window.location.pathname+'#brief='+encoded;
    document.getElementById('share-url').value=url;
    panel.style.display='flex';
  });

  document.getElementById('btn-copy-share').addEventListener('click',function(){
    var inp=document.getElementById('share-url');
    navigator.clipboard.writeText(inp.value).then(function(){
      var b=document.getElementById('btn-copy-share'); b.textContent='Copied!';
      setTimeout(function(){ b.textContent='Copy link'; },2000);
    }).catch(function(){ inp.select(); document.execCommand('copy'); });
  });

  /* ④ PDF export */
  document.getElementById('btn-pdf').addEventListener('click',exportPDF);

  wireHistoryButtons();
}

/* ─── Run generation (generate or polish mode) ────────── */
async function runGenerate(mode){
  var promptVal, sourceNotes, briefType, tone;
  if(mode==='polish'){
    promptVal   = currentBriefData&&currentBriefData.plainText ? currentBriefData.plainText : '';
    sourceNotes = '';
    briefType   = currentBriefData&&currentBriefData.briefType ? currentBriefData.briefType : 'College Essay Outline';
    tone        = currentBriefData&&currentBriefData.tone      ? currentBriefData.tone      : 'Neutral Analytic';
  } else {
    promptVal   = document.getElementById('bb-prompt').value.trim();
    sourceNotes = document.getElementById('bb-notes').value.trim();
    briefType   = document.getElementById('bb-type').value;
    tone        = document.getElementById('bb-tone').value;
    if(!promptVal){ alert('Please enter a prompt or question.'); return; }
  }

  var btn        = document.getElementById('btn-generate')||document.getElementById('btn-polish');
  var outputEl   = document.getElementById('brief-output');
  var actionsEl  = document.getElementById('output-actions');
  var badgeEl    = document.getElementById('gen-source');
  var scoreBars  = document.getElementById('score-bars');
  var readRow    = document.getElementById('readability-row');
  var summaryEl  = document.getElementById('brief-summary');
  var sharePanel = document.getElementById('share-panel');

  if(scoreBars) scoreBars.style.display='none';
  if(readRow)   readRow.style.display='none';
  if(summaryEl) summaryEl.style.display='none';
  if(sharePanel) sharePanel.style.display='none';

  var genBtn=document.getElementById('btn-generate');
  if(genBtn){ genBtn.textContent=mode==='polish'?'Polishing…':'Generating…'; genBtn.disabled=true; }
  var polBtn=document.getElementById('btn-polish');
  if(polBtn) polBtn.disabled=true;

  outputEl.innerHTML='<div class="gen-loading"><span class="gen-dot"></span><span class="gen-dot"></span><span class="gen-dot"></span></div>';
  if(actionsEl) actionsEl.style.display='none';

  try {
    var data=await callGenerateBriefAPI(promptVal, sourceNotes, briefType, tone, mode);

    if(data.quality==='filler'){
      outputEl.innerHTML='<div class="filler-msg">'+
        '<div style="font-size:28px;margin-bottom:8px">🤔</div>'+
        '<strong>That doesn\'t look like a brief topic.</strong>'+
        '<p>'+escHtml(data.message||'Please enter a more specific prompt.')+'</p>'+
      '</div>';
      if(badgeEl){ badgeEl.style.visibility='hidden'; }
    } else {
      var plainText=sectionsToPlainText(data.sections||[]);
      currentBriefData={ sections:data.sections||[], score:data.score||null, summary:data.summary||'',
        plainText:plainText, briefType:briefType, tone:tone, title:(promptVal||'').slice(0,80) };

      outputEl.innerHTML=renderSections(data.sections||[]);
      if(actionsEl) actionsEl.style.display='flex';
      if(badgeEl){ badgeEl.textContent=mode==='polish'?'✦ Polished':'✦ AI'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }

      /* ② Score bars */
      if(data.score&&scoreBars){
        scoreBars.innerHTML=renderScoreBars(data.score);
        scoreBars.style.display='block';
        requestAnimationFrame(function(){
          document.querySelectorAll('.score-bar-fill').forEach(function(el){
            el.style.width=el.dataset.target+'%';
          });
        });
      }

      /* ③ Readability */
      if(readRow){
        readRow.innerHTML=renderReadability(plainText);
        readRow.style.display='flex';
      }

      /* Brief summary */
      if(data.summary&&summaryEl){
        summaryEl.textContent='"'+data.summary+'"';
        summaryEl.style.display='block';
      }
    }
  } catch(err){
    console.warn('AI failed, fallback:',err.message);
    var result=generateBrief(promptVal||'', sourceNotes, briefType, tone);
    if(result){
      var plainFallback=result.sections.map(function(s){ return s.heading+'\n'+s.lines.map(function(l){ return stripTags(l); }).join('\n'); }).join('\n\n');
      currentBriefData={ sections:null, score:null, summary:'', plainText:plainFallback, briefType:briefType, tone:tone, title:(promptVal||'').slice(0,80) };
      outputEl.innerHTML=renderFallbackSections(result.sections);
      if(actionsEl) actionsEl.style.display='flex';
      if(badgeEl){ badgeEl.textContent='⚡ Offline'; badgeEl.className='gen-source-badge badge-offline'; badgeEl.style.visibility='visible'; }
      if(readRow){ readRow.innerHTML=renderReadability(plainFallback); readRow.style.display='flex'; }
    } else {
      outputEl.innerHTML='<span class="output-placeholder">Could not generate a brief. Please try a more specific prompt.</span>';
    }
  } finally {
    if(genBtn){ genBtn.textContent='Generate →'; genBtn.disabled=false; }
    if(polBtn) polBtn.disabled=false;
  }
}

/* ─── API call ────────────────────────────────────────── */
async function callGenerateBriefAPI(prompt, sourceNotes, briefType, tone, mode){
  var res=await fetch('/api/generate-brief',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({prompt:prompt, sourceNotes:sourceNotes, briefType:briefType, tone:tone, mode:mode||'generate'})
  });
  var data=await res.json();
  if(!res.ok) throw new Error(data.error||('Server error '+res.status));
  return data;
}

/* ─── Render structured sections ─────────────────────── */
function renderSections(sections){
  if(!sections||!sections.length) return '<span class="output-placeholder">No content returned. Try a more specific prompt.</span>';
  return sections.map(function(s){
    var bullets=(s.bullets||[]).filter(function(b){ return b&&b.trim(); });
    return '<div class="brief-section-block">'+
      '<h3 class="brief-section-heading">'+escHtml(s.heading||'')+'</h3>'+
      '<ul class="brief-bullets">'+
        bullets.map(function(b){ return '<li>'+escHtml(b)+'</li>'; }).join('')+
      '</ul>'+
    '</div>';
  }).join('');
}

function renderFallbackSections(sections){
  return sections.map(function(s){
    return '<div class="brief-section-block">'+
      '<h3 class="brief-section-heading">'+escHtml(s.heading||'')+'</h3>'+
      '<ul class="brief-bullets">'+s.lines.map(function(l){ return '<li>'+escHtml(stripTags(l))+'</li>'; }).join('')+'</ul>'+
    '</div>';
  }).join('');
}

function sectionsToPlainText(sections){
  return sections.map(function(s){
    return s.heading+'\n'+(s.bullets||[]).join('\n');
  }).join('\n\n');
}

/* ② Score bars ──────────────────────────────────────────── */
function renderScoreBars(score){
  var dims=[['Argument Strength',score.strength],['Clarity',score.clarity],['Evidence Use',score.evidence]];
  return '<div class="score-bars-title">Brief quality score</div>'+
    dims.map(function(d){
      var label=d[0], val=d[1];
      var pct=Math.round((val/10)*100);
      var color=val>=8?'#22c55e':val>=6?'#3b82f6':val>=4?'#f59e0b':'#ef4444';
      return '<div class="score-bar-row">'+
        '<span class="score-bar-label">'+label+'</span>'+
        '<div class="score-bar-track">'+
          '<div class="score-bar-fill" data-target="'+pct+'" style="width:0%;background:'+color+'"></div>'+
        '</div>'+
        '<span class="score-bar-num">'+val+'/10</span>'+
      '</div>';
    }).join('');
}

/* ③ Readability ─────────────────────────────────────────── */
function renderReadability(text){
  var words=text.trim().split(/\s+/).filter(Boolean);
  var wc=words.length;
  var sentences=(text.match(/[.!?]+/g)||[]).length||1;
  var avgWPS=wc/sentences;
  var syllables=words.reduce(function(sum,w){ return sum+countSyllables(w); },0);
  var avgSPW=wc>0?syllables/wc:1;
  var fkgl=Math.max(1,Math.min(18,Math.round(0.39*avgWPS+11.8*avgSPW-15.59)));
  var level=fkgl<=6?'Elementary':fkgl<=9?'Middle School':fkgl<=12?'High School':fkgl<=16?'College':'Graduate';
  var readMins=Math.max(1,Math.round(wc/200));
  return '<span class="read-pill">'+wc+' words</span>'+
    '<span class="read-pill">~'+readMins+' min read</span>'+
    '<span class="read-pill">Grade '+fkgl+' ('+level+')</span>';
}

function countSyllables(word){
  word=word.toLowerCase().replace(/[^a-z]/g,'');
  if(!word) return 1;
  var count=(word.match(/[aeiouy]+/g)||[]).length;
  if(word.match(/[^aeiou]e$/)) count--;
  return Math.max(1,count);
}

/* ④ PDF export ──────────────────────────────────────────── */
function exportPDF(){
  if(!currentBriefData) return;
  var frame=document.getElementById('print-frame');
  var sections=currentBriefData.sections;
  var html='<h1 style="font-size:20px;font-weight:700;margin-bottom:8px">'+escHtml(currentBriefData.title||'College Brief')+'</h1>'+
    '<p style="color:#6b7280;font-size:13px;margin-bottom:20px">'+escHtml(currentBriefData.briefType)+' · '+escHtml(currentBriefData.tone)+'</p>';
  if(sections&&sections.length){
    html+=sections.map(function(s){
      return '<div style="margin-bottom:18px"><h2 style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">'+escHtml(s.heading)+'</h2>'+
        '<ul style="margin:0;padding-left:18px">'+(s.bullets||[]).map(function(b){ return '<li style="margin-bottom:5px;line-height:1.6;font-size:14px">'+escHtml(b)+'</li>'; }).join('')+'</ul></div>';
    }).join('');
  } else {
    html+='<pre style="font-size:13px;line-height:1.7;white-space:pre-wrap">'+escHtml(currentBriefData.plainText)+'</pre>';
  }
  frame.innerHTML=html;
  window.print();
  setTimeout(function(){ frame.innerHTML=''; },2000);
}

/* ⑧ Share link encoding/decoding ────────────────────────── */
function encodeShareData(data){
  try {
    var obj={ title:data.title, sections:data.sections, summary:data.summary, score:data.score, briefType:data.briefType, tone:data.tone };
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  } catch(e){ return ''; }
}

function decodeShareData(encoded){
  try { return JSON.parse(decodeURIComponent(escape(atob(encoded)))); } catch(e){ return null; }
}

function checkShareHash(){
  var hash=window.location.hash;
  if(!hash.startsWith('#brief=')) return;
  var encoded=hash.slice(7);
  var data=decodeShareData(encoded);
  if(!data) return;
  var banner=document.getElementById('share-banner');
  if(banner) banner.classList.remove('hidden');
  // Switch to briefs view and display the shared brief
  switchView('briefs');
  setTimeout(function(){
    var outputEl=document.getElementById('brief-output');
    var actionsEl=document.getElementById('output-actions');
    var badgeEl=document.getElementById('gen-source');
    if(!outputEl) return;
    currentBriefData={ sections:data.sections||[], score:data.score||null, summary:data.summary||'',
      plainText:sectionsToPlainText(data.sections||[]), briefType:data.briefType||'College Essay Outline',
      tone:data.tone||'Neutral Analytic', title:data.title||'Shared Brief' };
    if(data.sections&&data.sections.length){
      outputEl.innerHTML=renderSections(data.sections);
    }
    if(actionsEl) actionsEl.style.display='flex';
    if(badgeEl){ badgeEl.textContent='☁ Shared'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
    var prompt=document.getElementById('bb-prompt');
    if(prompt) prompt.value=data.title||'';
    if(data.score){
      var scoreBars=document.getElementById('score-bars');
      if(scoreBars){ scoreBars.innerHTML=renderScoreBars(data.score); scoreBars.style.display='block';
        requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); }
    }
    if(data.summary){
      var s=document.getElementById('brief-summary');
      if(s){ s.textContent='"'+data.summary+'"'; s.style.display='block'; }
    }
  },100);

  var closeBanner=document.getElementById('btn-close-banner');
  if(closeBanner) closeBanner.addEventListener('click',function(){
    var b=document.getElementById('share-banner');
    if(b) b.classList.add('hidden');
    window.location.hash='';
  });
  var importBtn=document.getElementById('btn-import-shared');
  if(importBtn) importBtn.addEventListener('click',function(){
    if(!currentUser){ alert('Sign in to save this brief to your account.'); return; }
    if(!currentBriefData) return;
    var entry={ id:uid(), title:data.title||'Shared Brief', briefType:data.briefType||'College Essay Outline',
      tone:data.tone||'Neutral Analytic', createdAt:Date.now(),
      outlineText:currentBriefData.plainText, sections:currentBriefData.sections||[],
      score:currentBriefData.score||null, summary:currentBriefData.summary||'' };
    var briefs=loadBriefs(); briefs.unshift(entry); if(briefs.length>30) briefs=briefs.slice(0,30);
    saveBriefs(briefs); cloudSaveBrief(entry);
    importBtn.textContent='Saved!';
    setTimeout(function(){ var b=document.getElementById('share-banner'); if(b) b.classList.add('hidden'); window.location.hash=''; },1500);
    updateSidebarStats();
  });
}

/* ─── History ──────────────────────────────────────────── */
function renderHistoryList(briefs){
  if(!briefs.length) return '<div class="empty-state">No saved briefs yet.</div>';
  return '<ul class="brief-history">'+
    briefs.slice(0,10).map(function(b){
      var date=b.createdAt?new Date(b.createdAt).toLocaleDateString():'';
      var scoreHtml='';
      if(b.score&&b.score.strength){ var avg=Math.round((b.score.strength+b.score.clarity+b.score.evidence)/3); scoreHtml='<span class="history-score">'+avg+'/10</span>'; }
      return '<li>'+
        '<span class="bh-title">'+escHtml(b.title||b.briefType)+'</span>'+
        scoreHtml+
        '<span class="bh-meta">'+escHtml(b.briefType)+(date?' · '+date:'')+'</span>'+
        '<button class="btn-ghost btn-small" data-brief-id="'+b.id+'">Load</button>'+
      '</li>';
    }).join('')+
  '</ul>';
}

function wireHistoryButtons(){
  document.querySelectorAll('[data-brief-id]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var brief=loadBriefs().find(function(b){ return b.id===btn.dataset.briefId; });
      if(!brief) return;
      var outputEl=document.getElementById('brief-output');
      var actionsEl=document.getElementById('output-actions');
      var badgeEl=document.getElementById('gen-source');
      var scoreBars=document.getElementById('score-bars');
      var readRow=document.getElementById('readability-row');
      var summaryEl=document.getElementById('brief-summary');
      if(!outputEl) return;
      currentBriefData={ sections:brief.sections||[], score:brief.score||null, summary:brief.summary||'',
        plainText:brief.outlineText, briefType:brief.briefType, tone:brief.tone||'Neutral Analytic', title:brief.title };
      if(brief.sections&&brief.sections.length){
        outputEl.innerHTML=renderSections(brief.sections);
      } else {
        outputEl.innerHTML='<pre class="brief-pre">'+escHtml(brief.outlineText)+'</pre>';
      }
      if(actionsEl) actionsEl.style.display='flex';
      if(badgeEl){ badgeEl.textContent='☁ Saved'; badgeEl.className='gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
      if(scoreBars){
        if(brief.score){ scoreBars.innerHTML=renderScoreBars(brief.score); scoreBars.style.display='block';
          requestAnimationFrame(function(){ document.querySelectorAll('.score-bar-fill').forEach(function(el){ el.style.width=el.dataset.target+'%'; }); }); }
        else scoreBars.style.display='none';
      }
      if(readRow&&brief.outlineText){ readRow.innerHTML=renderReadability(brief.outlineText); readRow.style.display='flex'; }
      if(summaryEl&&brief.summary){ summaryEl.textContent='"'+brief.summary+'"'; summaryEl.style.display='block'; } else if(summaryEl) summaryEl.style.display='none';
      var prompt=document.getElementById('bb-prompt');
      if(prompt) prompt.value=brief.title||'';
      document.getElementById('share-panel').style.display='none';
    });
  });
}

/* ═══════════════════════════════════════════════════════
   OPPORTUNITIES + ⑤ DEADLINE URGENCY + ⑨ CHECKLIST
══════════════════════════════════════════════════════════ */
var OPP_STATUSES=['Not started','Brainstorming','Drafting','Polishing','Submitted','Result'];
var OPP_CATS=['College','Scholarship','Program','Competition','Other'];

var CHECKLIST_ITEMS=[
  { key:'essay',       label:'Essay Draft' },
  { key:'rec',         label:'Rec Letters' },
  { key:'scores',      label:'Test Scores' },
  { key:'resume',      label:'Resume / CV' },
  { key:'activities',  label:'Activity List' },
];

function getDaysUntil(deadline){
  if(!deadline) return 9999;
  var d=new Date(deadline); d.setHours(23,59,59);
  return Math.ceil((d-Date.now())/(1000*60*60*24));
}

function urgencyBadge(deadline){
  var days=getDaysUntil(deadline);
  if(days<0)   return '<span class="urgency-badge urgency-past">Passed</span>';
  if(days<=7)  return '<span class="urgency-badge urgency-red">'+days+'d left</span>';
  if(days<=30) return '<span class="urgency-badge urgency-amber">'+days+'d left</span>';
  return '<span class="urgency-badge urgency-green">'+days+'d</span>';
}

function renderOpps(){
  var opps=loadOpps();
  /* Sort: soonest deadline first */
  opps=opps.slice().sort(function(a,b){ return getDaysUntil(a.deadline)-getDaysUntil(b.deadline); });
  return '<div class="opp-intro-bar"><div>'+
    '<h2>Applications &amp; Programs</h2>'+
    '<p class="subtitle">Track deadlines, link essays, and monitor your progress — sorted by deadline.</p>'+
  '</div></div>'+
  '<div class="card">'+
    '<p class="section-heading">Add new</p>'+
    '<div class="opp-form-grid">'+
      '<div class="form-group"><label for="opp-name">Name <span class="req">*</span></label><input type="text" id="opp-name" placeholder="e.g. Dartmouth ED, QuestBridge, Gates Scholarship"></div>'+
      '<div class="form-group"><label for="opp-cat">Category</label><select id="opp-cat">'+OPP_CATS.map(function(c){ return '<option>'+c+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label for="opp-deadline">Deadline <span class="req">*</span></label><input type="date" id="opp-deadline"></div>'+
      '<div class="form-group"><label for="opp-status">Status</label><select id="opp-status">'+OPP_STATUSES.map(function(s){ return '<option>'+s+'</option>'; }).join('')+'</select></div>'+
      '<div class="form-group"><label for="opp-link">Link</label><input type="url" id="opp-link" placeholder="https://"></div>'+
      '<div class="form-group"><label for="opp-strategy">Strategy note</label><input type="text" id="opp-strategy" placeholder="Angle or story you want to emphasize"></div>'+
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

    /* Checklist completion */
    var cl=loadChecklist(o.id);
    var done=CHECKLIST_ITEMS.filter(function(i){ return cl[i.key]; }).length;
    var total=CHECKLIST_ITEMS.length;
    var clPct=Math.round(done/total*100);

    return '<div class="opp-card">'+
      '<div class="opp-card-top">'+
        '<div>'+
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
      (o.strategy?'<div class="opp-strategy">'+escHtml(o.strategy)+'</div>':'')+
      /* ⑨ Checklist */
      '<div class="opp-checklist">'+
        '<button class="checklist-toggle btn-ghost btn-small" data-cl-opp="'+o.id+'">'+
          '☑ Checklist ('+done+'/'+total+') · '+clPct+'%'+
        '</button>'+
        '<div class="checklist-items" id="cl-'+o.id+'" style="display:none">'+
          CHECKLIST_ITEMS.map(function(item){
            return '<label class="checklist-item">'+
              '<input type="checkbox" data-cl-id="'+o.id+'" data-cl-key="'+item.key+'"'+(cl[item.key]?' checked':'')+' />'+
              item.label+
            '</label>';
          }).join('')+
        '</div>'+
      '</div>'+
      '<div class="opp-card-actions">'+
        '<button class="btn-primary btn-small" data-opp-id="'+o.id+'">Open in Brief Builder →</button>'+
      '</div>'+
    '</div>';
  }).join('')+'</div>';
}

function wireOpps(){
  document.getElementById('btn-add-opp').addEventListener('click',function(){
    var name=document.getElementById('opp-name').value.trim();
    var deadline=document.getElementById('opp-deadline').value;
    if(!name){ alert('Please enter a name.'); return; }
    if(!deadline){ alert('Please enter a deadline.'); return; }
    var opp={ id:uid(), name:name, category:document.getElementById('opp-cat').value,
      deadline:deadline, status:document.getElementById('opp-status').value,
      link:document.getElementById('opp-link').value.trim(),
      strategy:document.getElementById('opp-strategy').value.trim(), createdAt:Date.now() };
    var opps=loadOpps(); opps.unshift(opp); saveOpps(opps); cloudSaveOpp(opp);
    ['opp-name','opp-deadline','opp-link','opp-strategy'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('opp-status').value='Not started';
    document.getElementById('opp-list').innerHTML=renderOppCards(loadOpps());
    wireOppButtons(); updateSidebarStats();
  });
  wireOppButtons();
}

function wireOppButtons(){
  /* Open in brief builder */
  document.querySelectorAll('[data-opp-id]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var opp=loadOpps().find(function(o){ return o.id===btn.dataset.oppId; });
      if(!opp) return;
      var prompt='Write a College Essay Outline for: '+opp.name+' ('+( opp.category||'College')+').'+
        (opp.strategy?' Strategy: '+opp.strategy+'.':'');
      switchView('briefs');
      document.getElementById('bb-prompt').value=prompt;
      document.getElementById('bb-type').value='College Essay Outline';
    });
  });
  /* Status change */
  document.querySelectorAll('[data-status-id]').forEach(function(sel){
    sel.addEventListener('change',function(){
      var opps=loadOpps(); var opp=opps.find(function(o){ return o.id===sel.dataset.statusId; });
      if(!opp) return;
      opp.status=sel.value; saveOpps(opps); cloudUpdateOpp(opp.id,{status:opp.status});
      sel.className='status-select '+statusClass(sel.value);
    });
  });
  /* Checklist toggles */
  document.querySelectorAll('.checklist-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      var div=document.getElementById('cl-'+btn.dataset.clOpp);
      if(div) div.style.display=div.style.display==='none'?'flex':'none';
    });
  });
  /* Checklist checkboxes */
  document.querySelectorAll('[data-cl-id]').forEach(function(cb){
    cb.addEventListener('change',function(){
      var cl=loadChecklist(cb.dataset.clId);
      cl[cb.dataset.clKey]=cb.checked;
      saveChecklist(cb.dataset.clId,cl);
      /* Update toggle label */
      var done=CHECKLIST_ITEMS.filter(function(i){ return cl[i.key]; }).length;
      var total=CHECKLIST_ITEMS.length;
      var toggle=document.querySelector('[data-cl-opp="'+cb.dataset.clId+'"]');
      if(toggle) toggle.textContent='☑ Checklist ('+done+'/'+total+') · '+Math.round(done/total*100)+'%';
    });
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
  var map={ thesis:{'Neutral Analytic':'This analysis finds','Advocacy':'This brief argues','Academic Formal':'This paper contends'},
    evidence:{'Neutral Analytic':'The evidence suggests','Advocacy':'We must recognize','Academic Formal':'The available evidence indicates'},
    conclude:{'Neutral Analytic':'The brief finds','Advocacy':'It is urgent that','Academic Formal':'Consequently, this analysis finds'} };
  return (map[base]&&map[base][tone])||base;
}

function generateBrief(prompt,sourceNotes,briefType,tone){
  var trimmed=prompt.trim(); if(!trimmed) return null;
  var m=trimmed.match(/^([^.!?]{5,})[.!?]/);
  var topic=m?m[1].trim():(trimmed.length<=80?trimmed:trimmed.slice(0,trimmed.lastIndexOf(' ',80)));
  var kw=extractKeywords(sourceNotes); if(!kw.length) kw=extractKeywords(trimmed).slice(0,3);
  if(!kw.length) kw=[topic.split(' ').filter(function(w){return w.length>3;})[0]||topic.split(' ')[0]];
  var sections=briefType==='Debate Case'?buildDebateCase(topic,kw,tone):briefType==='Policy Memo'?buildPolicyMemo(topic,kw,tone):buildEssayOutline(topic,kw,tone);
  var plainText=sections.map(function(s){ return s.heading+'\n'+s.lines.map(function(l){ return stripTags(l); }).join('\n'); }).join('\n\n');
  return { sections:sections, plainText:plainText };
}

function buildDebateCase(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0,k2=kw[2]||k0;
  var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [
    {heading:'Thesis',lines:[th+' that '+topic+' — supported by convergent social, institutional, and empirical evidence.',ev+' that the totality of these arguments compels a clear judgment.']},
    {heading:'Contention 1 — Social consequences',lines:['The ramifications of '+topic+' extend beyond abstract principle.',ev+' that data on '+k0+' shows inaction widens inequality.']},
    {heading:'Contention 2 — Systemic implications',lines:[k1+' operates as a systemic variable — changes reverberate across legal, economic, and social systems.',ev+' that the scale of this issue demands a proportionate response.']},
    {heading:'Contention 3 — Democratic stakes',lines:['When governing bodies defer on '+k2+', they erode public trust.',th+' that historical precedent shows deferral consistently produces worse results.']},
    {heading:'Counterargument 1 + Response',lines:['Objection: The harms are overstated. Response: '+ev+' that even conservative estimates support action.']},
    {heading:'Counterargument 2 + Response',lines:['Objection: Incremental reform is better. Response: Incremental reform has failed in analogous contexts.']},
    {heading:'Conclusion',lines:[co+' that the evidence supports action on '+k0+' — not as ideology, but as a principled response to what the data shows.']}
  ];
}

function buildPolicyMemo(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0;
  var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [
    {heading:'Executive Summary',lines:[th+' that the current approach to '+topic+' is insufficient.',ev+' that a phased intervention targeting '+k0+' offers the strongest path to reform.']},
    {heading:'Background',lines:['The debate over '+topic+' has seen repeated calls for action met by fragmented responses.',ev+' that data shows absent coordinated intervention, disparities widen.']},
    {heading:'Problem Statement',lines:[topic+' lacks an enforceable framework. As a result, '+k0+' continues to produce harms that fall disproportionately on those least equipped to absorb them.']},
    {heading:'Policy Options',lines:['Option A — Status quo: low cost, fails to address structural drivers.','Option B — Targeted reform: binding standards on '+k0+'; high accountability, significant capacity required.','Option C — Hybrid framework: incentives plus baseline regulatory requirements; balances flexibility and accountability.']},
    {heading:'Recommendation',lines:[th+' that Option C provides the strongest foundation.',co+' that comparable frameworks achieved durable results within 3–5 years.']},
    {heading:'Next Steps',lines:['Commission a 30-day landscape assessment of current practices.','Convene a cross-sector working group to refine the framework.','Establish measurable success criteria and a 12-month review cycle.']}
  ];
}

function buildEssayOutline(topic,kw,tone){
  var k0=kw[0]||'this experience',k1=kw[1]||k0;
  return [
    {heading:'Hook',lines:['Open with a small, precise moment directly connected to '+topic+'.','One vivid detail about '+k0+' will do more than a paragraph of explanation.']},
    {heading:'Core Story',lines:['Establish the situation: where you were, what you were doing, what was at stake in relation to '+topic+'.','Ground the narrative in '+k0+'. Introduce the central tension or question.']},
    {heading:'Key Moment 1',lines:['Describe the first time you engaged seriously with '+topic+'. What did you notice that others might have missed?']},
    {heading:'Key Moment 2',lines:['Introduce the moment when your initial understanding proved incomplete or was challenged.']},
    {heading:'Key Moment 3',lines:['Describe the decision or realization that marked a shift in how you approached '+topic+'.']},
    {heading:'Reflection',lines:['What changed internally — in beliefs, habits of mind, or understanding of '+k1+'?','The strongest reflections are honest about ambiguity.']},
    {heading:'Takeaway',lines:['The strongest endings are quiet and specific.','Connect your experience with '+topic+' to who you are becoming — as an ongoing project, not a completed achievement.']}
  ];
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════ */
function statusClass(s){
  return {'Not started':'status-neutral','Brainstorming':'status-purple','Drafting':'status-blue',
    'Polishing':'status-amber','Submitted':'status-green','Result':'status-result'}[s]||'status-neutral';
}

function formatDate(str){
  if(!str) return '';
  var p=str.split('-'); if(p.length!==3) return str;
  return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2])).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function escHtml(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripTags(s){ return s.replace(/<[^>]*>/g,''); }

/* ═══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
document.querySelector('.sb-nav-item[data-view="dashboard"]').classList.add('active');
checkShareHash();
renderSidebar();
renderView();
