/* ═══════════════════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════════════════════ */

var currentUser       = null;
var userProfile       = null;
var currentView       = 'dashboard';
var currentBriefOutput = null;
var _unsubBriefs      = null;
var _unsubOpps        = null;

/* ═══════════════════════════════════════════════════════
   LOCALSTORAGE KEYS & HELPERS
══════════════════════════════════════════════════════════ */

var KEY_BRIEFS    = 'cbl-briefs';
var KEY_OPPS      = 'cbl-opportunities';
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

function getDB() {
  try { return firebase.firestore(); } catch(e) { return null; }
}

function startFirestoreSync() {
  if (!currentUser) return;
  var db  = getDB();
  if (!db) return;
  var uid = currentUser.uid;

  migrateLocalToFirestore(db, uid);

  _unsubBriefs = db.collection('users').doc(uid).collection('briefs')
    .orderBy('createdAt', 'desc')
    .onSnapshot(function(snap) {
      var briefs = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      saveBriefs(briefs);
      softRefreshView('briefs');
    }, function(err) { console.warn('Firestore briefs sync error:', err.message); });

  _unsubOpps = db.collection('users').doc(uid).collection('opportunities')
    .orderBy('createdAt', 'desc')
    .onSnapshot(function(snap) {
      var opps = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      saveOpps(opps);
      softRefreshView('opportunities');
    }, function(err) { console.warn('Firestore opps sync error:', err.message); });
}

function stopFirestoreSync() {
  if (_unsubBriefs) { _unsubBriefs(); _unsubBriefs = null; }
  if (_unsubOpps)   { _unsubOpps();   _unsubOpps   = null; }
}

function migrateLocalToFirestore(db, userId) {
  var localBriefs = loadBriefs();
  var localOpps   = loadOpps();
  var col = db.collection('users').doc(userId);
  localBriefs.forEach(function(b) {
    col.collection('briefs').doc(b.id).set(b, { merge: true }).catch(function(){});
  });
  localOpps.forEach(function(o) {
    col.collection('opportunities').doc(o.id).set(o, { merge: true }).catch(function(){});
  });
}

function cloudSaveBrief(brief) {
  var db = getDB();
  if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('briefs').doc(brief.id)
    .set(brief).catch(function(e) { console.warn('Firestore brief save error:', e.message); });
}

function cloudSaveOpp(opp) {
  var db = getDB();
  if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(opp.id)
    .set(opp).catch(function(e) { console.warn('Firestore opp save error:', e.message); });
}

function cloudUpdateOpp(id, data) {
  var db = getDB();
  if (!db || !currentUser) return;
  db.collection('users').doc(currentUser.uid).collection('opportunities').doc(id)
    .update(data).catch(function(e) { console.warn('Firestore opp update error:', e.message); });
}

/* Refresh only the non-interactive parts of the view when Firestore pushes new data */
function softRefreshView(changedCollection) {
  if (currentView === 'dashboard') {
    var app = document.getElementById('app');
    if (app) { app.innerHTML = renderDashboard(); wireDashboard(); }
    return;
  }
  if (currentView === 'briefs' && changedCollection === 'briefs') {
    var histEl = document.getElementById('brief-history');
    if (histEl) { histEl.innerHTML = renderHistoryList(loadBriefs()); wireHistoryButtons(); }
    return;
  }
  if (currentView === 'opportunities' && changedCollection === 'opportunities') {
    var oppEl = document.getElementById('opp-list');
    if (oppEl) { oppEl.innerHTML = renderOppCards(loadOpps()); wireOppButtons(); }
    return;
  }
}

/* ═══════════════════════════════════════════════════════
   AUTH STATE
══════════════════════════════════════════════════════════ */

function handleAuthState(event) {
  currentUser  = event.detail.user    || null;
  userProfile  = event.detail.profile || null;

  if (currentUser) {
    startFirestoreSync();
  } else {
    stopFirestoreSync();
  }

  renderNav();
  renderView();
}
document.addEventListener('ne-auth-state', handleAuthState);

/* ═══════════════════════════════════════════════════════
   NAV
══════════════════════════════════════════════════════════ */

function renderNav() {
  var btnSignIn   = document.getElementById('btn-sign-in');
  var userDisplay = document.getElementById('user-display');
  var userNameEl  = document.getElementById('user-name');
  var avatarEl    = document.getElementById('user-avatar');

  if (currentUser) {
    btnSignIn.classList.add('hidden');
    userDisplay.classList.remove('hidden');
    var dn = (userProfile && userProfile.displayName)
      ? userProfile.displayName
      : (currentUser.displayName || currentUser.email || 'Signed in');
    userNameEl.textContent = dn;
    var photo = (userProfile && userProfile.photoURL) || currentUser.photoURL || '';
    if (photo && avatarEl) { avatarEl.src = photo; avatarEl.style.display = 'inline-block'; }
    else if (avatarEl)     { avatarEl.style.display = 'none'; }
  } else {
    btnSignIn.classList.remove('hidden');
    userDisplay.classList.add('hidden');
    if (avatarEl) avatarEl.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════════════
   TAB BAR & ROUTER
══════════════════════════════════════════════════════════ */

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { switchView(btn.dataset.view); });
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === currentView);
  });
  renderView();
}

function renderView() {
  var app = document.getElementById('app');
  if (currentView === 'dashboard')          { app.innerHTML = renderDashboard(); wireDashboard(); }
  else if (currentView === 'briefs')        { app.innerHTML = renderBriefs();    wireBriefs(); }
  else if (currentView === 'opportunities') { app.innerHTML = renderOpps();      wireOpps(); }
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */

function renderDashboard() {
  if (!currentUser) {
    return '<div class="signed-out-msg">' +
      '<div class="signed-out-icon">✦</div>' +
      '<strong>College Brief Lab</strong>' +
      '<p>Sign in to create and save briefs and track your applications across devices.</p>' +
    '</div>';
  }

  var briefs     = loadBriefs();
  var opps       = loadOpps();
  var firstName  = (userProfile && userProfile.displayName) ? userProfile.displayName.split(' ')[0] : '';
  var inProgress = opps.filter(function(o) {
    return o.status === 'Brainstorming' || o.status === 'Drafting' || o.status === 'Polishing';
  }).length;

  var activity = [];
  briefs.forEach(function(b) { activity.push({ type:'brief', title: b.title || b.briefType, id: b.id, createdAt: b.createdAt }); });
  opps.forEach(function(o)   { activity.push({ type:'opp',   title: o.name, id: o.id, createdAt: o.createdAt }); });
  activity.sort(function(a, b) { return (b.createdAt||0) - (a.createdAt||0); });
  activity = activity.slice(0, 5);

  var activityHtml = activity.length === 0
    ? '<div class="empty-state">No recent activity. Build a brief or add an application to get started.</div>'
    : '<ul class="activity-list">' + activity.map(function(item) {
        var cls = item.type === 'opp' ? 'chip chip-opp' : 'chip chip-brief';
        var lbl = item.type === 'opp' ? 'Application' : 'Brief';
        return '<li>' +
          '<span class="' + cls + '">' + lbl + '</span>' +
          '<span class="activity-title">' + escHtml(item.title) + '</span>' +
          '<button class="btn-ghost btn-small" data-type="' + item.type + '" data-id="' + item.id + '">Open →</button>' +
        '</li>';
      }).join('') + '</ul>';

  var syncBadge = currentUser
    ? '<span class="sync-badge">☁ Synced</span>'
    : '';

  return '<div class="card hero-card">' +
    '<h2>Good to see you' + (firstName ? ', ' + escHtml(firstName) : '') + '. ' + syncBadge + '</h2>' +
    '<p>Build arguments, essay outlines, and policy memos — then link them to your college applications.</p>' +
  '</div>' +

  '<div class="stat-grid">' +
    statCard(briefs.length, 'Briefs created') +
    statCard(opps.length,   'Applications tracked') +
    statCard(inProgress,    'In progress') +
  '</div>' +

  '<div class="card">' +
    '<p class="section-heading">Recent activity</p>' +
    activityHtml +
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

      '<div class="form-group" style="margin-top:18px">' +
        '<label for="bb-prompt">Prompt or question <span class="req">*</span></label>' +
        '<textarea id="bb-prompt" rows="3" placeholder="e.g. Argue that end-to-end encryption undermines public safety and should be regulated."></textarea>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="bb-notes">Source notes <span class="opt">(optional)</span></label>' +
        '<textarea id="bb-notes" rows="3" placeholder="Paste key facts, quotes, or research notes. Keywords will be extracted automatically."></textarea>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label for="bb-type">Brief type</label>' +
          '<select id="bb-type">' +
            '<option value="College Essay Outline">College Essay Outline</option>' +
            '<option value="Policy Memo">Policy Memo</option>' +
            '<option value="Debate Case">Debate Case</option>' +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label for="bb-tone">Tone</label>' +
          '<select id="bb-tone">' +
            '<option value="Neutral Analytic">Neutral Analytic</option>' +
            '<option value="Advocacy">Advocacy</option>' +
            '<option value="Academic Formal">Academic Formal</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<button id="btn-generate" class="btn-primary btn-full">Generate brief</button>' +
    '</div>' +

    '<div class="brief-right-col">' +
      '<div class="card">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<p class="section-heading" style="margin:0">Output</p>' +
          '<span id="gen-source" class="gen-source-badge hidden"></span>' +
        '</div>' +
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your brief will appear here after generation.</span></div>' +
        '<div class="btn-row" id="output-actions" style="display:none">' +
          '<button id="btn-copy" class="btn-secondary btn-small">Copy</button>' +
          '<button id="btn-save" class="btn-primary btn-small">Save to history</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<p class="section-heading">' + (currentUser ? '☁ Your saved briefs' : 'Recent briefs on this device') + '</p>' +
        '<div id="brief-history">' + renderHistoryList(briefs) + '</div>' +
      '</div>' +
    '</div>' +

  '</div>';
}

function wireBriefs() {
  /* ── Generate button ── */
  document.getElementById('btn-generate').addEventListener('click', function() {
    var prompt    = document.getElementById('bb-prompt').value.trim();
    var notes     = document.getElementById('bb-notes').value.trim();
    var briefType = document.getElementById('bb-type').value;
    var tone      = document.getElementById('bb-tone').value;

    if (!prompt) { alert('Please enter a prompt or question.'); return; }

    var btn      = document.getElementById('btn-generate');
    var outputEl  = document.getElementById('brief-output');
    var actionsEl = document.getElementById('output-actions');
    var badgeEl   = document.getElementById('gen-source');

    btn.textContent = 'Generating…';
    btn.disabled    = true;
    outputEl.innerHTML = '<span class="output-placeholder">Thinking…</span>';

    callGenerateBriefAPI(prompt, notes, briefType, tone).then(function(result) {
      currentBriefOutput = result;
      outputEl.innerHTML = '<div class="brief-ai-text">' + result.html + '</div>';
      actionsEl.style.display = 'flex';
      if (badgeEl) { badgeEl.textContent = '✦ AI'; badgeEl.className = 'gen-source-badge badge-ai'; }
    }).catch(function(err) {
      console.warn('AI failed, using offline fallback:', err.message);
      var result = generateBrief(prompt, notes, briefType, tone);
      currentBriefOutput = result;
      outputEl.innerHTML = renderBriefHtml(result);
      actionsEl.style.display = 'flex';
      if (badgeEl) { badgeEl.textContent = '⚡ Offline'; badgeEl.className = 'gen-source-badge badge-offline'; }
    }).finally(function() {
      btn.textContent = 'Generate brief';
      btn.disabled    = false;
    });
  });

  /* ── Copy ── */
  document.getElementById('btn-copy').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    navigator.clipboard.writeText(currentBriefOutput.plainText).then(function() {
      var b = document.getElementById('btn-copy');
      b.textContent = 'Copied!';
      setTimeout(function() { b.textContent = 'Copy'; }, 1800);
    }).catch(function() { alert('Could not access clipboard — please select and copy manually.'); });
  });

  /* ── Save ── */
  document.getElementById('btn-save').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    var briefs = loadBriefs();
    var prompt  = document.getElementById('bb-prompt').value.trim();
    var entry = {
      id:          uid(),
      title:       prompt.slice(0, 80),
      briefType:   document.getElementById('bb-type').value,
      createdAt:   Date.now(),
      outlineText: currentBriefOutput.plainText
    };
    briefs.unshift(entry);
    if (briefs.length > 20) briefs = briefs.slice(0, 20);
    saveBriefs(briefs);
    cloudSaveBrief(entry);
    var b = document.getElementById('btn-save');
    b.textContent = 'Saved!';
    setTimeout(function() { b.textContent = 'Save to history'; }, 1800);
    document.getElementById('brief-history').innerHTML = renderHistoryList(loadBriefs());
    wireHistoryButtons();
  });

  wireHistoryButtons();
}

function wireHistoryButtons() {
  document.querySelectorAll('[data-brief-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var brief = loadBriefs().find(function(b) { return b.id === btn.dataset.briefId; });
      if (!brief) return;
      document.getElementById('brief-output').innerHTML =
        '<div class="brief-ai-text"><pre class="brief-pre">' + escHtml(brief.outlineText) + '</pre></div>';
      document.getElementById('output-actions').style.display = 'flex';
      currentBriefOutput = { plainText: brief.outlineText };
      document.getElementById('bb-prompt').value = brief.title;
      var badgeEl = document.getElementById('gen-source');
      if (badgeEl) { badgeEl.textContent = ''; badgeEl.className = 'gen-source-badge hidden'; }
    });
  });
}

function renderHistoryList(briefs) {
  if (briefs.length === 0) return '<div class="empty-state">No saved briefs yet.</div>';
  return '<ul class="brief-history">' +
    briefs.slice(0, 8).map(function(b) {
      var date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';
      return '<li>' +
        '<span class="bh-title">' + escHtml(b.title || b.briefType) + '</span>' +
        '<span class="bh-meta">' + escHtml(b.briefType) + (date ? ' · ' + date : '') + '</span>' +
        '<button class="btn-ghost btn-small" data-brief-id="' + b.id + '">Load</button>' +
      '</li>';
    }).join('') +
  '</ul>';
}

function renderBriefHtml(result) {
  return result.sections.map(function(s) {
    var h    = '<h3 class="brief-heading">' + escHtml(s.heading) + '</h3>';
    var body = s.lines.map(function(line) { return '<p class="brief-para">' + line + '</p>'; }).join('');
    return '<div class="brief-section">' + h + body + '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   AI GENERATION — server-proxied
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
  if (!text.trim()) throw new Error('Empty response from server');

  var html = aiTextToHtml(text);
  return { plainText: text, html: html, sections: null };
}

function aiTextToHtml(text) {
  var lines = text.split('\n');
  var html   = '';
  var inSection = false;

  lines.forEach(function(line) {
    var trimmed = line.trim();
    if (!trimmed) {
      if (inSection) html += '</div>';
      inSection = false;
      return;
    }

    var headingMatch = trimmed.match(/^([A-Z][^a-z]{2,}.*?):\s*$/);
    if (headingMatch || /^(Thesis|Executive Summary|Background|Problem|Options|Recommendation|Next Steps|Research Plan|Hook|Core Story|Reflection|Takeaway|Contention \d|Counterargument \d|Key Moment \d)/.test(trimmed)) {
      if (inSection) html += '</div>';
      html += '<div class="brief-section"><h3 class="brief-heading">' + escHtml(trimmed.replace(/:$/, '')) + '</h3>';
      inSection = true;
    } else {
      var formatted = escHtml(trimmed).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      html += '<p class="brief-para">' + formatted + '</p>';
    }
  });

  if (inSection) html += '</div>';
  return html;
}

/* ═══════════════════════════════════════════════════════
   OPPORTUNITIES
══════════════════════════════════════════════════════════ */

var OPP_STATUSES = ['Not started','Brainstorming','Drafting','Polishing','Submitted','Result'];
var OPP_CATS     = ['College','Scholarship','Program','Competition','Other'];

function renderOpps() {
  var opps = loadOpps();

  return '<div class="opp-intro-bar">' +
    '<div>' +
      '<h2>Applications &amp; Programs</h2>' +
      '<p class="subtitle">Track colleges, scholarships, and programs — and link each one to a brief or essay outline.' +
      (currentUser ? ' <span class="sync-badge">☁ Synced across devices</span>' : '') + '</p>' +
    '</div>' +
  '</div>' +

  '<div class="card">' +
    '<p class="section-heading">Add new</p>' +
    '<div class="opp-form-grid">' +

      '<div class="form-group">' +
        '<label for="opp-name">Name <span class="req">*</span></label>' +
        '<input type="text" id="opp-name" placeholder="e.g. Dartmouth ED, John Locke Essay, Questbridge">' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-cat">Category</label>' +
        '<select id="opp-cat">' + OPP_CATS.map(function(c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-deadline">Deadline <span class="req">*</span></label>' +
        '<input type="date" id="opp-deadline">' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-status">Status</label>' +
        '<select id="opp-status">' + OPP_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') + '</select>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-link">Link</label>' +
        '<input type="url" id="opp-link" placeholder="https://">' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-strategy">Strategy note</label>' +
        '<input type="text" id="opp-strategy" placeholder="Angle or story you want to emphasize">' +
      '</div>' +

    '</div>' +
    '<button id="btn-add-opp" class="btn-primary">Add</button>' +
  '</div>' +

  '<div id="opp-list">' + renderOppCards(opps) + '</div>';
}

function renderOppCards(opps) {
  if (opps.length === 0) return '<div class="empty-state" style="margin-top:8px">No applications tracked yet. Add one above.</div>';

  return '<div class="opp-cards">' +
    opps.map(function(o) {
      var dl = o.deadline ? formatDate(o.deadline) : 'No deadline';
      var catHtml = '<span class="chip chip-cat">' + escHtml(o.category || o.type || 'Other') + '</span>';
      var linkHtml = o.link
        ? '<a href="' + escHtml(o.link) + '" target="_blank" rel="noopener" class="opp-link">Website ↗</a>' : '';
      var statusOpts = OPP_STATUSES.map(function(s) {
        return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<div class="opp-card">' +
        '<div class="opp-card-top">' +
          '<div>' +
            '<div class="opp-card-name">' + escHtml(o.name) + '</div>' +
            '<div class="opp-card-meta">' + catHtml + '<span class="opp-deadline">Due ' + escHtml(dl) + '</span>' + linkHtml + '</div>' +
          '</div>' +
          '<select class="status-select ' + statusClass(o.status) + '" data-status-id="' + o.id + '">' + statusOpts + '</select>' +
        '</div>' +
        (o.strategy ? '<div class="opp-strategy">' + escHtml(o.strategy) + '</div>' : '') +
        '<div class="opp-card-actions">' +
          '<button class="btn-primary btn-small" data-opp-id="' + o.id + '">Open in Brief Builder →</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function wireOpps() {
  document.getElementById('btn-add-opp').addEventListener('click', function() {
    var name     = document.getElementById('opp-name').value.trim();
    var cat      = document.getElementById('opp-cat').value;
    var deadline = document.getElementById('opp-deadline').value;
    var status   = document.getElementById('opp-status').value;
    var link     = document.getElementById('opp-link').value.trim();
    var strategy = document.getElementById('opp-strategy').value.trim();

    if (!name)     { alert('Please enter a name.'); return; }
    if (!deadline) { alert('Please enter a deadline.'); return; }

    var opp = { id: uid(), name: name, category: cat, deadline: deadline, status: status, link: link, strategy: strategy, createdAt: Date.now() };
    var opps = loadOpps();
    opps.unshift(opp);
    saveOpps(opps);
    cloudSaveOpp(opp);

    ['opp-name','opp-deadline','opp-link','opp-strategy'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('opp-status').value = 'Not started';
    document.getElementById('opp-list').innerHTML = renderOppCards(loadOpps());
    wireOppButtons();
  });

  wireOppButtons();
}

function wireOppButtons() {
  document.querySelectorAll('[data-opp-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var opp = loadOpps().find(function(o) { return o.id === btn.dataset.oppId; });
      if (!opp) return;
      var prompt = 'Write a College Essay Outline for this opportunity: ' + opp.name +
        ' (' + (opp.category || 'College') + ').' +
        (opp.strategy ? ' Strategy: ' + opp.strategy + '.' : '');
      switchView('briefs');
      document.getElementById('bb-prompt').value = prompt;
      document.getElementById('bb-type').value   = 'College Essay Outline';
    });
  });

  document.querySelectorAll('[data-status-id]').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var opps = loadOpps();
      var opp  = opps.find(function(o) { return o.id === sel.dataset.statusId; });
      if (!opp) return;
      opp.status = sel.value;
      saveOpps(opps);
      cloudUpdateOpp(opp.id, { status: opp.status });
      sel.className = 'status-select ' + statusClass(sel.value);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   STATUS / DATE UTILITIES
══════════════════════════════════════════════════════════ */

function statusClass(status) {
  var map = {
    'Not started':  'status-neutral',
    'Brainstorming':'status-purple',
    'Drafting':     'status-blue',
    'Polishing':    'status-amber',
    'Submitted':    'status-green',
    'Result':       'status-result'
  };
  return map[status] || 'status-neutral';
}

function formatDate(str) {
  if (!str) return '';
  var parts = str.split('-');
  if (parts.length !== 3) return str;
  var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════
   LOCAL BRIEF GENERATION ENGINE (fallback)
══════════════════════════════════════════════════════════ */

var STOPWORDS = new Set([
  'the','this','that','with','from','about','into','there','which','would','could','should',
  'have','been','being','because','against','between','under','each','other','such','only',
  'very','over','after','before','again','further','then','once','also','both','does','more',
  'most','some','than','when','where','while','your','their','they','them','will','were',
  'what','just','been','here','even','still','well','back','many','much','too','our',
  'and','but','for','not','you','all','can','her','was','one','has','his','him','any',
  'its','how','who','did','get','may','own','out','use','now','way','new','see'
]);

function extractKeywords(text) {
  if (!text || !text.trim()) return [];
  var freq = {};
  text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(function(w) {
    if (w.length >= 4 && !STOPWORDS.has(w)) freq[w] = (freq[w]||0) + 1;
  });
  return Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; }).slice(0,5);
}

function tonePhrase(base, tone) {
  var map = {
    thesis:   { 'Neutral Analytic':'This analysis finds', 'Advocacy':'This brief argues', 'Academic Formal':'This paper contends' },
    evidence: { 'Neutral Analytic':'The evidence suggests', 'Advocacy':'We must recognize', 'Academic Formal':'The available evidence indicates' },
    conclude: { 'Neutral Analytic':'The brief finds', 'Advocacy':'It is urgent that', 'Academic Formal':'Consequently, this analysis finds' }
  };
  return (map[base] && map[base][tone]) || base;
}

function generateBrief(prompt, sourceNotes, briefType, tone) {
  var trimmed = prompt.trim();
  if (!trimmed) return null;

  var topic;
  var m = trimmed.match(/^([^.!?]{5,})[.!?]/);
  if (m) { topic = m[1].trim(); }
  else { var cut = trimmed.slice(0,80); var sp = cut.lastIndexOf(' '); topic = (sp > 20 ? cut.slice(0,sp) : cut).trim(); }

  var kw = extractKeywords(sourceNotes);
  if (!kw.length) kw = extractKeywords(trimmed).slice(0,3);
  if (!kw.length) kw = [topic.split(' ').filter(function(w){ return w.length>3; })[0] || topic.split(' ')[0]];

  var sections = briefType === 'Debate Case'   ? buildDebateCase(topic, kw, tone)
               : briefType === 'Policy Memo'   ? buildPolicyMemo(topic, kw, tone)
               :                                 buildEssayOutline(topic, kw, tone);

  var plainText = sections.map(function(s) {
    return s.heading + '\n' + s.lines.map(function(l){ return stripTags(l); }).join('\n');
  }).join('\n\n');

  return { sections: sections, plainText: plainText };
}

function buildDebateCase(topic, kw, tone) {
  var k0=kw[0]||topic.split(' ')[0], k1=kw[1]||k0, k2=kw[2]||k0;
  var th=tonePhrase('thesis',tone), ev=tonePhrase('evidence',tone), co=tonePhrase('conclude',tone);
  var ts = topic.length>60 ? topic.slice(0,57)+'…' : topic;
  return [
    { heading:'Thesis', lines:[
      th+' that '+ts+' — a position supported by convergent social, institutional, and empirical evidence. Decisions on this matter directly shape policy and lived outcomes related to '+k0+'.',
      'The case rests on three independent contentions. '+ev+' that their totality compels a clear judgment.'
    ]},
    { heading:'Contention 1 — Social consequences of '+cap(topic), lines:[
      '<b>'+cap(k0)+' as a driver of measurable harm.</b>',
      th+' that the social ramifications of '+topic+' extend well beyond abstract principle. When '+k0+' goes unaddressed, downstream effects accumulate across communities in ways difficult to reverse.',
      ev+' that data on '+k0+(k1!==k0?' and '+k1:'')+' consistently shows inaction widens inequality in outcomes. Affected populations bear disproportionate costs while decision-makers remain insulated.',
      'This asymmetry is structural. '+co+' that any serious engagement with '+ts+' must take this harm dimension as its central stake.'
    ]},
    { heading:'Contention 2 — Systemic implications of '+cap(k1), lines:[
      '<b>How '+k1+' shapes the broader landscape.</b>',
      'Debates about '+topic+' are rarely contained within a single domain. '+ev+' that '+k1+' operates as a systemic variable — changes reverberate across legal, economic, and social systems simultaneously.',
      th+' that the systemic scale of this issue demands a proportionate response. Narrow approaches underestimate how deeply '+k1+' is entangled with adjacent policy areas.'
    ]},
    { heading:'Contention 3 — Democratic stakes of '+cap(k2), lines:[
      '<b>Accountability and legitimacy depend on resolving '+k2+'.</b>',
      th+' that when governing bodies defer on '+k2+', they erode trust among those whose lives are shaped by the outcome. Historical precedent shows deferral consistently produces worse results than early, structured engagement.',
      ev+' that the cost of delay — measured in both material and democratic terms — justifies decisive action.'
    ]},
    { heading:'Counterargument 1 + Response', lines:[
      '<b>Objection:</b> The harms associated with '+topic+' are overstated, and the proposed stance is disproportionate.',
      '<b>Response:</b> '+ev+' that even conservative estimates of the impact of '+k0+' support action. The burden of proof lies with those defending the status quo against accumulating evidence.'
    ]},
    { heading:'Counterargument 2 + Response', lines:[
      '<b>Objection:</b> Incremental reform or delegated authority offers a better path than the position advanced.',
      '<b>Response:</b> Incremental reform has failed in analogous contexts because it misses the systemic character of '+k1+'. '+th+' that half-measures delay and entrench structural problems rather than solve them.'
    ]},
    { heading:'Conclusion', lines:[
      'The three contentions establish a mutually reinforcing case: the social harms of '+topic+' are real, the systemic implications demand more than surface reform, and the democratic stakes make delay costly in ways that compound.',
      co+' that a decision-maker who weighs this evidence seriously should find for the position advanced — not as ideology, but as a principled response to what the evidence shows about '+k0+'.'
    ]}
  ];
}

function buildPolicyMemo(topic, kw, tone) {
  var k0=kw[0]||topic.split(' ')[0], k1=kw[1]||k0, k2=kw[2]||k0;
  var th=tonePhrase('thesis',tone), ev=tonePhrase('evidence',tone), co=tonePhrase('conclude',tone);
  return [
    { heading:'Executive Summary', lines:[
      'This memo addresses the policy dimension of '+topic+'. '+th+' that the current approach is insufficient given the scale and urgency of the problem.',
      ev+' that a phased hybrid intervention targeting '+k0+' and '+k1+' offers the strongest path to durable reform. Option C — described below — is the recommended course.'
    ]},
    { heading:'Background', lines:[
      'The debate over '+topic+' has been ongoing for several years, with repeated calls for action met by procedural delay or fragmented responses.',
      ev+' that data on '+k0+' shows a consistent pattern: absent coordinated intervention, disparities in outcomes widen over time.',
      'Prior efforts focused on '+k1+' have demonstrated the limits of piecemeal approaches. A more integrated framework is needed.'
    ]},
    { heading:'Problem Statement', lines:[
      'The core problem is that '+topic+' lacks an enforceable framework. As a result, '+k0+' continues to produce harms that fall disproportionately on the populations least equipped to absorb them.',
      ev+' that the costs of inaction exceed the projected costs of reform over a 5–10 year horizon. The policy window for effective action is narrow.'
    ]},
    { heading:'Policy Options', lines:[
      '<b>Option A — Status quo with monitoring:</b> Continue existing policies; invest in data collection on '+k0+'. Low cost, but fails to address structural drivers.',
      '<b>Option B — Targeted regulatory reform:</b> Binding standards governing '+k0+'. High accountability; requires significant administrative capacity; may displace rather than resolve the problem.',
      '<b>Option C — Hybrid framework:</b> Combine structured incentives with baseline regulatory requirements tied to '+k1+' and '+k2+'. Balances flexibility and accountability; scalable; precedent exists in adjacent domains.'
    ]},
    { heading:'Recommendation', lines:[
      th+' that Option C provides the strongest foundation. The hybrid model addresses the core tension between enforceability and adaptability.',
      ev+' that comparable frameworks in analogous policy areas achieved durable results within three to five years of full implementation. '+co+' that Option C is the most defensible choice given the evidence.'
    ]},
    { heading:'Next Steps', lines:[
      '- Commission a 30-day landscape assessment of current practices related to '+k0+'.',
      '- Convene a cross-sector working group — including affected communities, legal experts, and practitioners — to refine the Option C framework.',
      '- Establish measurable success criteria and a 12-month review cycle with public reporting on '+k1+' and '+k2+'.'
    ]}
  ];
}

function buildEssayOutline(topic, kw, tone) {
  var k0=kw[0]||'this experience', k1=kw[1]||k0, k2=kw[2]||k0;
  var th=tonePhrase('thesis',tone), ev=tonePhrase('evidence',tone), co=tonePhrase('conclude',tone);
  return [
    { heading:'Hook', lines:[
      'Open with a small, precise moment — a specific place, object, or exchange — connected directly to '+topic+'. The reader should feel present before they understand what the essay is about.',
      'One vivid detail about '+k0+' will do more work than a paragraph of explanation. Resist the urge to begin with a summary or statement of intent.'
    ]},
    { heading:'Core Story', lines:[
      'Establish the situation: where you were, what you were doing, and what was at stake personally in relation to '+topic+'.',
      'Ground the narrative in '+k0+' — not as a theme to analyze, but as the texture of the experience itself.',
      ev+' that the most effective college essays stay close to the concrete. Introduce the central tension or question the experience raised for you, connected to '+k1+'.'
    ]},
    { heading:'Key Moment 1 — First encounter', lines:[
      'Describe the first time you engaged directly and seriously with '+topic+'. What did you notice that others might have missed?',
      ev+' that concrete particulars are more persuasive than general claims about growth. Show the texture — the specific details that made it real.'
    ]},
    { heading:'Key Moment 2 — Complication', lines:[
      'Introduce the moment when your initial understanding of '+k1+' proved incomplete or was challenged.',
      'Sit with the complication briefly before showing how you responded — the reader needs to feel its weight before they can appreciate the turn.'
    ]},
    { heading:'Key Moment 3 — Turning point', lines:[
      'Describe the decision, realization, or action that marked a shift in how you approached '+topic+' or understood '+k2+'.',
      th+' that this turning point should be earned by the story that precedes it — not announced or explained, but shown through a precise moment of recalibration.'
    ]},
    { heading:'Reflection', lines:[
      'Step back and articulate what changed internally — in beliefs, habits of mind, or understanding of '+k0+' — as a result of the experience.',
      ev+' that the strongest reflections are honest about ambiguity. Connect the internal change to something concrete: a habit developed, a perspective revised, a question you continue to carry about '+k1+'.'
    ]},
    { heading:'Takeaway', lines:[
      'Close by connecting your experience with '+topic+' to who you are becoming — not as a vague destination, but as an ongoing project.',
      co+' that the strongest endings are quiet and specific. Let the story do the persuading; the final lines need only leave the reader with a clear, distinct sense of you.'
    ]}
  ];
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════════ */

function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripTags(str) { return str.replace(/<[^>]*>/g, ''); }

/* ═══════════════════════════════════════════════════════
   AUTH BUTTONS
══════════════════════════════════════════════════════════ */

document.getElementById('btn-sign-in').addEventListener('click', function() {
  if (typeof signInGoogle === 'function') signInGoogle();
});
document.getElementById('btn-sign-out').addEventListener('click', function() {
  if (typeof logOut === 'function') logOut();
});

/* ═══════════════════════════════════════════════════════
   INITIAL RENDER
══════════════════════════════════════════════════════════ */

renderNav();
renderView();
