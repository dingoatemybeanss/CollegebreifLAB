/* ═══════════════════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════════════════════ */

var currentUser        = null;
var userProfile        = null;
var currentView        = 'dashboard';
var currentBriefOutput = null;
var _unsubBriefs       = null;
var _unsubOpps         = null;

/* ═══════════════════════════════════════════════════════
   LOCALSTORAGE
══════════════════════════════════════════════════════════ */

var KEY_BRIEFS = 'cbl-briefs';
var KEY_OPPS   = 'cbl-opportunities';

function loadBriefs() {
  try { return JSON.parse(localStorage.getItem(KEY_BRIEFS) || '[]'); } catch(e) { return []; }
}
function saveBriefs(arr) { localStorage.setItem(KEY_BRIEFS, JSON.stringify(arr)); }

function loadOpps() {
  try { return JSON.parse(localStorage.getItem(KEY_OPPS) || '[]'); } catch(e) { return []; }
}
function saveOpps(arr) { localStorage.setItem(KEY_OPPS, JSON.stringify(arr)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ═══════════════════════════════════════════════════════
   FIRESTORE SYNC
══════════════════════════════════════════════════════════ */

function getDB() { try { return firebase.firestore(); } catch(e) { return null; } }

function startFirestoreSync() {
  if (!currentUser) return;
  var db  = getDB(); if (!db) return;
  var uid = currentUser.uid;
  migrateLocalToFirestore(db, uid);
  _unsubBriefs = db.collection('users').doc(uid).collection('briefs')
    .orderBy('createdAt','desc')
    .onSnapshot(function(snap) {
      saveBriefs(snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
      softRefresh('briefs');
    }, function(e){ console.warn('Briefs sync:', e.message); });
  _unsubOpps = db.collection('users').doc(uid).collection('opportunities')
    .orderBy('createdAt','desc')
    .onSnapshot(function(snap) {
      saveOpps(snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }));
      softRefresh('opportunities');
    }, function(e){ console.warn('Opps sync:', e.message); });
}

function stopFirestoreSync() {
  if (_unsubBriefs) { _unsubBriefs(); _unsubBriefs = null; }
  if (_unsubOpps)   { _unsubOpps();   _unsubOpps   = null; }
}

function migrateLocalToFirestore(db, userId) {
  var col = db.collection('users').doc(userId);
  loadBriefs().forEach(function(b){ col.collection('briefs').doc(b.id).set(b,{merge:true}).catch(function(){}); });
  loadOpps().forEach(function(o){ col.collection('opportunities').doc(o.id).set(o,{merge:true}).catch(function(){}); });
}

function cloudSaveBrief(brief) {
  var db = getDB(); if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('briefs').doc(brief.id)
    .set(brief).catch(function(e){ console.warn(e.message); });
}

function cloudSaveOpp(opp) {
  var db = getDB(); if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(opp.id)
    .set(opp).catch(function(e){ console.warn(e.message); });
}

function cloudUpdateOpp(id, data) {
  var db = getDB(); if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(id)
    .update(data).catch(function(e){ console.warn(e.message); });
}

function softRefresh(changed) {
  updateSidebarStats();
  if (currentView === 'dashboard') { renderView(); return; }
  if (currentView === 'briefs' && changed === 'briefs') {
    var el = document.getElementById('brief-history');
    if (el) { el.innerHTML = renderHistoryList(loadBriefs()); wireHistoryButtons(); }
    return;
  }
  if (currentView === 'opportunities' && changed === 'opportunities') {
    var el2 = document.getElementById('opp-list');
    if (el2) { el2.innerHTML = renderOppCards(loadOpps()); wireOppButtons(); }
  }
}

/* ═══════════════════════════════════════════════════════
   AUTH STATE
══════════════════════════════════════════════════════════ */

function handleAuthState(event) {
  currentUser = event.detail.user    || null;
  userProfile = event.detail.profile || null;
  if (currentUser) { startFirestoreSync(); } else { stopFirestoreSync(); }
  renderSidebar();
  renderView();
}
document.addEventListener('ne-auth-state', handleAuthState);

/* ═══════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════ */

function renderSidebar() {
  renderSidebarUser();
  updateSidebarStats();
}

function renderSidebarUser() {
  var container = document.getElementById('sb-user');
  if (!container) return;
  if (currentUser) {
    var dn    = (userProfile && userProfile.displayName) ? userProfile.displayName : (currentUser.displayName || currentUser.email || 'Signed in');
    var photo = (userProfile && userProfile.photoURL) || currentUser.photoURL || '';
    var img   = photo ? '<img src="' + escHtml(photo) + '" alt="" />' : '';
    container.innerHTML =
      '<div class="sb-user-row">' +
        img +
        '<span class="sb-user-name">' + escHtml(dn) + '</span>' +
        '<button class="btn-sb-signout" id="btn-sign-out">Out</button>' +
      '</div>';
    document.getElementById('btn-sign-out').addEventListener('click', function() {
      if (typeof logOut === 'function') logOut();
    });
  } else {
    container.innerHTML = '<button class="btn-signin-sidebar" id="btn-sign-in">Sign in with Google</button>';
    document.getElementById('btn-sign-in').addEventListener('click', function() {
      if (typeof signInGoogle === 'function') signInGoogle();
    });
  }
}

function updateSidebarStats() {
  var footer = document.getElementById('sb-footer');
  if (!footer) return;
  if (!currentUser) { footer.innerHTML = ''; return; }
  var briefs = loadBriefs();
  var opps   = loadOpps();
  footer.innerHTML =
    '<div class="sb-stat-row"><span class="sb-stat-label">Briefs</span><span class="sb-stat-value">' + briefs.length + '</span></div>' +
    '<div class="sb-stat-row"><span class="sb-stat-label">Applications</span><span class="sb-stat-value">' + opps.length + '</span></div>' +
    '<div class="sb-sync-dot">☁ Synced across devices</div>';
}

/* ─── Nav items ───────────────────────────────────── */

document.querySelectorAll('.sb-nav-item').forEach(function(btn) {
  btn.addEventListener('click', function() { switchView(btn.dataset.view); });
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.sb-nav-item').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  renderView();
}

function renderView() {
  var main = document.getElementById('app-main');
  if (!main) return;
  if (currentView === 'dashboard')          { main.innerHTML = renderDashboard(); wireDashboard(); }
  else if (currentView === 'briefs')        { main.innerHTML = renderBriefs();    wireBriefs(); }
  else if (currentView === 'opportunities') { main.innerHTML = renderOpps();      wireOpps(); }
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */

function renderDashboard() {
  if (!currentUser) {
    return '<div class="signed-out-msg">' +
      '<div class="signed-out-icon">✦</div>' +
      '<strong>College Brief Lab</strong>' +
      '<p>Sign in with Google to create and sync briefs and track your applications across devices.</p>' +
    '</div>';
  }

  var briefs     = loadBriefs();
  var opps       = loadOpps();
  var firstName  = (userProfile && userProfile.displayName) ? userProfile.displayName.split(' ')[0] : '';
  var inProgress = opps.filter(function(o) {
    return o.status === 'Brainstorming' || o.status === 'Drafting' || o.status === 'Polishing';
  }).length;

  var activity = [];
  briefs.forEach(function(b){ activity.push({ type:'brief', title: b.title||b.briefType, id: b.id, createdAt: b.createdAt }); });
  opps.forEach(function(o){   activity.push({ type:'opp',   title: o.name,              id: o.id, createdAt: o.createdAt }); });
  activity.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  activity = activity.slice(0,5);

  var actHtml = activity.length === 0
    ? '<div class="empty-state">No recent activity. Build a brief or add an application to get started.</div>'
    : '<ul class="activity-list">' + activity.map(function(item) {
        var cls = item.type==='opp' ? 'chip chip-opp' : 'chip chip-brief';
        var lbl = item.type==='opp' ? 'Application' : 'Brief';
        return '<li>' +
          '<span class="' + cls + '">' + lbl + '</span>' +
          '<span class="activity-title">' + escHtml(item.title) + '</span>' +
          '<button class="btn-ghost btn-small" data-type="' + item.type + '" data-id="' + item.id + '">Open →</button>' +
        '</li>';
      }).join('') + '</ul>';

  return '<div class="hero-card">' +
    '<h2>Good to see you' + (firstName ? ', ' + escHtml(firstName) : '') + '.</h2>' +
    '<p>Build arguments, essay outlines, and policy memos — then link them to your college applications.</p>' +
  '</div>' +

  '<div class="stat-grid">' +
    statCard(briefs.length, 'Briefs created') +
    statCard(opps.length,   'Applications tracked') +
    statCard(inProgress,    'In progress') +
  '</div>' +

  '<div class="card">' +
    '<p class="section-heading">Recent activity</p>' +
    actHtml +
  '</div>';
}

function statCard(n, label) {
  return '<div class="stat-card"><span class="stat-number">' + n + '</span><div class="stat-label">' + label + '</div></div>';
}

function wireDashboard() {
  document.querySelectorAll('.activity-list [data-type]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(btn.dataset.type === 'opp' ? 'opportunities' : 'briefs');
    });
  });
}

/* ═══════════════════════════════════════════════════════
   BRIEF BUILDER
══════════════════════════════════════════════════════════ */

function renderBriefs() {
  var briefs = loadBriefs();

  return '<div class="brief-builder">' +

    '<div class="card">' +
      '<h2>Brief Builder</h2>' +
      '<p class="subtitle">Generate a structured argument, memo, or essay outline — powered by AI.</p>' +

      '<div class="form-group">' +
        '<label for="bb-prompt">Prompt or question <span class="req">*</span></label>' +
        '<textarea id="bb-prompt" rows="3" placeholder="e.g. Argue that end-to-end encryption undermines public safety and should be regulated."></textarea>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="bb-notes">Source notes <span class="opt">(optional)</span></label>' +
        '<textarea id="bb-notes" rows="2" placeholder="Paste key facts, quotes, or research notes."></textarea>' +
      '</div>' +

      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:140px">' +
          '<label for="bb-type">Type</label>' +
          '<select id="bb-type">' +
            '<option value="College Essay Outline">College Essay Outline</option>' +
            '<option value="Policy Memo">Policy Memo</option>' +
            '<option value="Debate Case">Debate Case</option>' +
          '</select>' +
        '</div>' +
        '<div style="flex:1;min-width:140px">' +
          '<label for="bb-tone">Tone</label>' +
          '<select id="bb-tone">' +
            '<option value="Neutral Analytic">Neutral Analytic</option>' +
            '<option value="Advocacy">Advocacy</option>' +
            '<option value="Academic Formal">Academic Formal</option>' +
          '</select>' +
        '</div>' +
        '<button id="btn-generate" class="btn-primary" style="padding:9px 22px;white-space:nowrap;height:36px">Generate →</button>' +
      '</div>' +
    '</div>' +

    '<div class="brief-builder-split">' +

      '<div class="card" style="margin-bottom:0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<p class="section-heading" style="margin:0">Output</p>' +
          '<span id="gen-source" class="gen-source-badge" style="visibility:hidden"></span>' +
        '</div>' +
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your brief will appear here after generation.</span></div>' +
        '<div class="btn-row" id="output-actions" style="display:none">' +
          '<button id="btn-copy" class="btn-secondary btn-small">Copy</button>' +
          '<button id="btn-save" class="btn-primary btn-small">Save</button>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:0">' +
        '<p class="section-heading">' + (currentUser ? '☁ Saved briefs' : 'Recent briefs') + '</p>' +
        '<div id="brief-history">' + renderHistoryList(briefs) + '</div>' +
      '</div>' +

    '</div>' +
  '</div>';
}

function wireBriefs() {
  document.getElementById('btn-generate').addEventListener('click', function() {
    var prompt    = document.getElementById('bb-prompt').value.trim();
    var notes     = document.getElementById('bb-notes').value.trim();
    var briefType = document.getElementById('bb-type').value;
    var tone      = document.getElementById('bb-tone').value;

    if (!prompt) { alert('Please enter a prompt or question.'); return; }

    var btn       = document.getElementById('btn-generate');
    var outputEl  = document.getElementById('brief-output');
    var actionsEl = document.getElementById('output-actions');
    var badgeEl   = document.getElementById('gen-source');

    btn.textContent = 'Generating…'; btn.disabled = true;
    outputEl.innerHTML = '<span class="output-placeholder">Thinking…</span>';

    callGenerateBriefAPI(prompt, notes, briefType, tone).then(function(result) {
      currentBriefOutput = result;
      outputEl.innerHTML = '<div class="brief-ai-text">' + result.html + '</div>';
      actionsEl.style.display = 'flex';
      if (badgeEl) { badgeEl.textContent = '✦ AI'; badgeEl.className = 'gen-source-badge badge-ai'; badgeEl.style.visibility='visible'; }
    }).catch(function(err) {
      console.warn('AI failed, fallback:', err.message);
      var result = generateBrief(prompt, notes, briefType, tone);
      currentBriefOutput = result;
      outputEl.innerHTML = renderBriefHtml(result);
      actionsEl.style.display = 'flex';
      if (badgeEl) { badgeEl.textContent = '⚡ Offline'; badgeEl.className = 'gen-source-badge badge-offline'; badgeEl.style.visibility='visible'; }
    }).finally(function() {
      btn.textContent = 'Generate →'; btn.disabled = false;
    });
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    navigator.clipboard.writeText(currentBriefOutput.plainText).then(function() {
      var b = document.getElementById('btn-copy'); b.textContent = 'Copied!';
      setTimeout(function() { b.textContent = 'Copy'; }, 1800);
    }).catch(function() { alert('Please select and copy the text manually.'); });
  });

  document.getElementById('btn-save').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    var briefs = loadBriefs();
    var prompt  = document.getElementById('bb-prompt').value.trim();
    var entry   = { id: uid(), title: prompt.slice(0,80), briefType: document.getElementById('bb-type').value, createdAt: Date.now(), outlineText: currentBriefOutput.plainText };
    briefs.unshift(entry);
    if (briefs.length > 20) briefs = briefs.slice(0, 20);
    saveBriefs(briefs);
    cloudSaveBrief(entry);
    var b = document.getElementById('btn-save'); b.textContent = 'Saved!';
    setTimeout(function() { b.textContent = 'Save'; }, 1800);
    document.getElementById('brief-history').innerHTML = renderHistoryList(loadBriefs());
    wireHistoryButtons();
    updateSidebarStats();
  });

  wireHistoryButtons();
}

function wireHistoryButtons() {
  document.querySelectorAll('[data-brief-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var brief = loadBriefs().find(function(b){ return b.id === btn.dataset.briefId; });
      if (!brief) return;
      document.getElementById('brief-output').innerHTML = '<div class="brief-ai-text"><pre class="brief-pre">' + escHtml(brief.outlineText) + '</pre></div>';
      document.getElementById('output-actions').style.display = 'flex';
      currentBriefOutput = { plainText: brief.outlineText };
      document.getElementById('bb-prompt').value = brief.title;
      var badgeEl = document.getElementById('gen-source');
      if (badgeEl) { badgeEl.style.visibility = 'hidden'; }
    });
  });
}

function renderHistoryList(briefs) {
  if (briefs.length === 0) return '<div class="empty-state">No saved briefs yet.</div>';
  return '<ul class="brief-history">' +
    briefs.slice(0,8).map(function(b) {
      var date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';
      return '<li>' +
        '<span class="bh-title">' + escHtml(b.title||b.briefType) + '</span>' +
        '<span class="bh-meta">' + escHtml(b.briefType) + (date?' · '+date:'') + '</span>' +
        '<button class="btn-ghost btn-small" data-brief-id="' + b.id + '">Load</button>' +
      '</li>';
    }).join('') +
  '</ul>';
}

function renderBriefHtml(result) {
  return result.sections.map(function(s) {
    return '<div class="brief-section"><h3 class="brief-heading">' + escHtml(s.heading) + '</h3>' +
      s.lines.map(function(l){ return '<p class="brief-para">' + l + '</p>'; }).join('') + '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   AI GENERATION — server proxied
══════════════════════════════════════════════════════════ */

async function callGenerateBriefAPI(prompt, sourceNotes, briefType, tone) {
  var res = await fetch('/api/generate-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt, sourceNotes: sourceNotes, briefType: briefType, tone: tone })
  });
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || ('Server error ' + res.status));
  var text = data.text || '';
  if (!text.trim()) throw new Error('Empty response');
  return { plainText: text, html: aiTextToHtml(text), sections: null };
}

function aiTextToHtml(text) {
  var lines = text.split('\n');
  var html  = '';
  var inSec = false;
  lines.forEach(function(line) {
    var t = line.trim();
    if (!t) { if (inSec) { html += '</div>'; inSec = false; } return; }
    if (/^(Thesis|Executive Summary|Background|Problem Statement|Policy Options|Recommendation|Next Steps|Research Plan|Hook|Core Story|Reflection|Takeaway|Contention \d|Counterargument \d|Key Moment \d)/i.test(t) || /^[A-Z][^a-z]{1,}.*:$/.test(t)) {
      if (inSec) html += '</div>';
      html += '<div class="brief-section"><h3 class="brief-heading">' + escHtml(t.replace(/:$/, '')) + '</h3>';
      inSec = true;
    } else {
      html += '<p class="brief-para">' + escHtml(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') + '</p>';
    }
  });
  if (inSec) html += '</div>';
  return html;
}

/* ═══════════════════════════════════════════════════════
   OPPORTUNITIES
══════════════════════════════════════════════════════════ */

var OPP_STATUSES = ['Not started','Brainstorming','Drafting','Polishing','Submitted','Result'];
var OPP_CATS     = ['College','Scholarship','Program','Competition','Other'];

function renderOpps() {
  var opps = loadOpps();
  return '<div class="opp-intro-bar"><div>' +
    '<h2>Applications &amp; Programs</h2>' +
    '<p class="subtitle">Track colleges, scholarships, and programs — and link each one to a brief or essay outline.</p>' +
  '</div></div>' +

  '<div class="card">' +
    '<p class="section-heading">Add new</p>' +
    '<div class="opp-form-grid">' +
      '<div class="form-group"><label for="opp-name">Name <span class="req">*</span></label><input type="text" id="opp-name" placeholder="e.g. Dartmouth ED, John Locke Essay, Questbridge"></div>' +
      '<div class="form-group"><label for="opp-cat">Category</label><select id="opp-cat">' + OPP_CATS.map(function(c){ return '<option>'+c+'</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label for="opp-deadline">Deadline <span class="req">*</span></label><input type="date" id="opp-deadline"></div>' +
      '<div class="form-group"><label for="opp-status">Status</label><select id="opp-status">' + OPP_STATUSES.map(function(s){ return '<option>'+s+'</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label for="opp-link">Link</label><input type="url" id="opp-link" placeholder="https://"></div>' +
      '<div class="form-group"><label for="opp-strategy">Strategy note</label><input type="text" id="opp-strategy" placeholder="Angle or story you want to emphasize"></div>' +
    '</div>' +
    '<button id="btn-add-opp" class="btn-primary">Add application</button>' +
  '</div>' +

  '<div id="opp-list">' + renderOppCards(opps) + '</div>';
}

function renderOppCards(opps) {
  if (opps.length === 0) return '<div class="empty-state" style="margin-top:8px">No applications tracked yet. Add one above.</div>';
  return '<div class="opp-cards">' +
    opps.map(function(o) {
      var dl = o.deadline ? formatDate(o.deadline) : 'No deadline';
      var catHtml = '<span class="chip chip-cat">' + escHtml(o.category||'Other') + '</span>';
      var linkHtml = o.link ? '<a href="'+escHtml(o.link)+'" target="_blank" rel="noopener" class="opp-link">Website ↗</a>' : '';
      var statusOpts = OPP_STATUSES.map(function(s){ return '<option'+(s===o.status?' selected':'')+'>'+s+'</option>'; }).join('');
      return '<div class="opp-card">' +
        '<div class="opp-card-top">' +
          '<div>' +
            '<div class="opp-card-name">' + escHtml(o.name) + '</div>' +
            '<div class="opp-card-meta">' + catHtml + '<span class="opp-deadline">Due ' + escHtml(dl) + '</span>' + linkHtml + '</div>' +
          '</div>' +
          '<select class="status-select '+statusClass(o.status)+'" data-status-id="'+o.id+'">' + statusOpts + '</select>' +
        '</div>' +
        (o.strategy ? '<div class="opp-strategy">' + escHtml(o.strategy) + '</div>' : '') +
        '<div class="opp-card-actions"><button class="btn-primary btn-small" data-opp-id="'+o.id+'">Open in Brief Builder →</button></div>' +
      '</div>';
    }).join('') + '</div>';
}

function wireOpps() {
  document.getElementById('btn-add-opp').addEventListener('click', function() {
    var name     = document.getElementById('opp-name').value.trim();
    var deadline = document.getElementById('opp-deadline').value;
    if (!name)     { alert('Please enter a name.'); return; }
    if (!deadline) { alert('Please enter a deadline.'); return; }
    var opp = { id: uid(), name: name, category: document.getElementById('opp-cat').value, deadline: deadline, status: document.getElementById('opp-status').value, link: document.getElementById('opp-link').value.trim(), strategy: document.getElementById('opp-strategy').value.trim(), createdAt: Date.now() };
    var opps = loadOpps(); opps.unshift(opp); saveOpps(opps); cloudSaveOpp(opp);
    ['opp-name','opp-deadline','opp-link','opp-strategy'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('opp-status').value = 'Not started';
    document.getElementById('opp-list').innerHTML = renderOppCards(loadOpps());
    wireOppButtons(); updateSidebarStats();
  });
  wireOppButtons();
}

function wireOppButtons() {
  document.querySelectorAll('[data-opp-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var opp = loadOpps().find(function(o){ return o.id===btn.dataset.oppId; });
      if (!opp) return;
      var prompt = 'Write a College Essay Outline for: ' + opp.name + ' (' + (opp.category||'College') + ').' + (opp.strategy?' Strategy: '+opp.strategy+'.':'');
      switchView('briefs');
      document.getElementById('bb-prompt').value = prompt;
      document.getElementById('bb-type').value   = 'College Essay Outline';
    });
  });
  document.querySelectorAll('[data-status-id]').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var opps = loadOpps(); var opp = opps.find(function(o){ return o.id===sel.dataset.statusId; });
      if (!opp) return;
      opp.status = sel.value; saveOpps(opps); cloudUpdateOpp(opp.id, {status: opp.status});
      sel.className = 'status-select ' + statusClass(sel.value);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   LOCAL BRIEF GENERATION ENGINE (fallback)
══════════════════════════════════════════════════════════ */

var STOPWORDS = new Set(['the','this','that','with','from','about','into','there','which','would','could','should','have','been','being','because','against','between','under','each','other','such','only','very','over','after','before','again','further','then','once','also','both','does','more','most','some','than','when','where','while','your','their','they','them','will','were','what','just','here','even','still','well','back','many','much','too','our','and','but','for','not','you','all','can','her','was','one','has','his','him','any','its','how','who','did','get','may','own','out','use','now','way','new','see']);

function extractKeywords(text) {
  if (!text||!text.trim()) return [];
  var freq={};
  text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w){ if(w.length>=4&&!STOPWORDS.has(w)) freq[w]=(freq[w]||0)+1; });
  return Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; }).slice(0,5);
}

function tonePhrase(base,tone) {
  var map={ thesis:{'Neutral Analytic':'This analysis finds','Advocacy':'This brief argues','Academic Formal':'This paper contends'}, evidence:{'Neutral Analytic':'The evidence suggests','Advocacy':'We must recognize','Academic Formal':'The available evidence indicates'}, conclude:{'Neutral Analytic':'The brief finds','Advocacy':'It is urgent that','Academic Formal':'Consequently, this analysis finds'} };
  return (map[base]&&map[base][tone])||base;
}

function generateBrief(prompt, sourceNotes, briefType, tone) {
  var trimmed=prompt.trim(); if(!trimmed) return null;
  var topic; var m=trimmed.match(/^([^.!?]{5,})[.!?]/);
  if(m){topic=m[1].trim();}else{var cut=trimmed.slice(0,80);var sp=cut.lastIndexOf(' ');topic=(sp>20?cut.slice(0,sp):cut).trim();}
  var kw=extractKeywords(sourceNotes);
  if(!kw.length) kw=extractKeywords(trimmed).slice(0,3);
  if(!kw.length) kw=[topic.split(' ').filter(function(w){return w.length>3;})[0]||topic.split(' ')[0]];
  var sections=briefType==='Debate Case'?buildDebateCase(topic,kw,tone):briefType==='Policy Memo'?buildPolicyMemo(topic,kw,tone):buildEssayOutline(topic,kw,tone);
  var plainText=sections.map(function(s){return s.heading+'\n'+s.lines.map(function(l){return stripTags(l);}).join('\n');}).join('\n\n');
  return { sections:sections, plainText:plainText };
}

function buildDebateCase(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0,k2=kw[2]||k0;
  var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  var ts=topic.length>60?topic.slice(0,57)+'…':topic;
  return [
    {heading:'Thesis',lines:[th+' that '+ts+' — a position supported by convergent social, institutional, and empirical evidence.',ev+' that the totality of these arguments compels a clear judgment.']},
    {heading:'Contention 1 — Social consequences',lines:['<b>'+cap(k0)+' as a driver of measurable harm.</b>',th+' that the ramifications of '+topic+' extend beyond abstract principle. When '+k0+' goes unaddressed, downstream effects accumulate in ways difficult to reverse.',ev+' that data on '+k0+' shows inaction widens inequality. Affected populations bear disproportionate costs.']},
    {heading:'Contention 2 — Systemic implications of '+cap(k1),lines:['<b>How '+k1+' shapes the broader landscape.</b>',ev+' that '+k1+' operates as a systemic variable — changes reverberate across legal, economic, and social systems simultaneously.',th+' that the scale of this issue demands a proportionate response.']},
    {heading:'Contention 3 — Democratic stakes',lines:['<b>Accountability and legitimacy depend on resolving '+k2+'.</b>',th+' that when governing bodies defer on '+k2+', they erode trust. Historical precedent shows deferral consistently produces worse results than early engagement.']},
    {heading:'Counterargument 1 + Response',lines:['<b>Objection:</b> The harms of '+topic+' are overstated.','<b>Response:</b> '+ev+' that even conservative estimates support action. The burden of proof lies with those defending the status quo.']},
    {heading:'Counterargument 2 + Response',lines:['<b>Objection:</b> Incremental reform offers a better path.','<b>Response:</b> Incremental reform has failed in analogous contexts. '+th+' that half-measures delay and entrench structural problems.']},
    {heading:'Conclusion',lines:[co+' that a decision-maker who weighs this evidence should find for the position — not as ideology, but as a principled response to what the evidence shows about '+k0+'.']}
  ];
}

function buildPolicyMemo(topic,kw,tone){
  var k0=kw[0]||topic.split(' ')[0],k1=kw[1]||k0;
  var th=tonePhrase('thesis',tone),ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [
    {heading:'Executive Summary',lines:['This memo addresses the policy dimension of '+topic+'. '+th+' that the current approach is insufficient given the urgency of the problem.',ev+' that a phased hybrid intervention targeting '+k0+' and '+k1+' offers the strongest path to durable reform.']},
    {heading:'Background',lines:['The debate over '+topic+' has been ongoing with repeated calls for action met by fragmented responses.',ev+' that data on '+k0+' shows a consistent pattern: absent coordinated intervention, disparities widen over time.']},
    {heading:'Problem Statement',lines:[topic+' lacks an enforceable framework. As a result, '+k0+' continues to produce harms that fall disproportionately on those least equipped to absorb them.',ev+' that the costs of inaction exceed the projected costs of reform over a 5–10 year horizon.']},
    {heading:'Policy Options',lines:['<b>Option A — Status quo:</b> Continue existing policies; low cost, fails to address structural drivers.','<b>Option B — Targeted reform:</b> Binding standards governing '+k0+'. High accountability; significant capacity required.','<b>Option C — Hybrid framework:</b> Combine incentives with baseline regulatory requirements. Balances flexibility and accountability.']},
    {heading:'Recommendation',lines:[th+' that Option C provides the strongest foundation. '+ev+' that comparable frameworks achieved durable results within 3–5 years. '+co+' that Option C is the most defensible choice.']},
    {heading:'Next Steps',lines:['- Commission a 30-day landscape assessment of current practices related to '+k0+'.','- Convene a cross-sector working group to refine the Option C framework.','- Establish measurable success criteria and a 12-month review cycle.']}
  ];
}

function buildEssayOutline(topic,kw,tone){
  var k0=kw[0]||'this experience',k1=kw[1]||k0;
  var ev=tonePhrase('evidence',tone),co=tonePhrase('conclude',tone);
  return [
    {heading:'Hook',lines:['Open with a small, precise moment directly connected to '+topic+'. The reader should feel present before they understand what the essay is about.','One vivid detail about '+k0+' will do more than a paragraph of explanation.']},
    {heading:'Core Story',lines:['Establish the situation: where you were, what you were doing, what was at stake in relation to '+topic+'.','Ground the narrative in '+k0+'. Introduce the central tension or question, connected to '+k1+'.']},
    {heading:'Key Moment 1 — First encounter',lines:['Describe the first time you engaged seriously with '+topic+'. What did you notice that others might have missed?',ev+' that concrete particulars are more persuasive than general claims. Show the texture — the details that made it real.']},
    {heading:'Key Moment 2 — Complication',lines:['Introduce the moment when your initial understanding of '+k1+' proved incomplete or was challenged.','Sit with the complication briefly. The reader needs to feel its weight before appreciating the turn.']},
    {heading:'Key Moment 3 — Turning point',lines:['Describe the decision or realization that marked a shift in how you approached '+topic+'.','This turning point should be earned by the story that precedes it — shown through a precise moment, not announced.']},
    {heading:'Reflection',lines:['Step back and articulate what changed internally — in beliefs, habits of mind, or understanding of '+k0+'.','The strongest reflections are honest about ambiguity. Connect the change to something concrete: a habit developed, a perspective revised.']},
    {heading:'Takeaway',lines:[co+' that the strongest endings are quiet and specific. Connect your experience with '+topic+' to who you are becoming — as an ongoing project, not a completed achievement.']}
  ];
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════ */

function statusClass(s) {
  return {
    'Not started':'status-neutral','Brainstorming':'status-purple','Drafting':'status-blue',
    'Polishing':'status-amber','Submitted':'status-green','Result':'status-result'
  }[s]||'status-neutral';
}

function formatDate(str) {
  if(!str) return '';
  var p=str.split('-'); if(p.length!==3) return str;
  return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2])).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

function cap(s) { return s?s.charAt(0).toUpperCase()+s.slice(1):''; }

function escHtml(s) {
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripTags(s) { return s.replace(/<[^>]*>/g,''); }

/* ═══════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */

// Set initial active tab
document.querySelector('.sb-nav-item[data-view="dashboard"]').classList.add('active');

// Initial render (auth hasn't fired yet, so show signed-out state)
renderSidebar();
renderView();
