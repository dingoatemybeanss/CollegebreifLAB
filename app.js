/* ─── Global State ────────────────────────────────────── */

var currentUser = null;
var userProfile = null;
var currentView = 'dashboard';

var currentBriefOutput = null; // { plainText, sections }

/* ─── Local Storage Keys ──────────────────────────────── */

var KEY_BRIEFS = 'cbl-briefs';
var KEY_OPPS   = 'cbl-opportunities';

/* ─── LocalStorage Helpers ────────────────────────────── */

function loadBriefs() {
  try { return JSON.parse(localStorage.getItem(KEY_BRIEFS) || '[]'); }
  catch(e) { return []; }
}

function saveBriefs(arr) {
  localStorage.setItem(KEY_BRIEFS, JSON.stringify(arr));
}

function loadOpps() {
  try { return JSON.parse(localStorage.getItem(KEY_OPPS) || '[]'); }
  catch(e) { return []; }
}

function saveOpps(arr) {
  localStorage.setItem(KEY_OPPS, JSON.stringify(arr));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ─── Auth State ──────────────────────────────────────── */

function handleAuthState(event) {
  currentUser  = event.detail.user    || null;
  userProfile  = event.detail.profile || null;
  renderNav();
  renderView();
}

document.addEventListener('ne-auth-state', handleAuthState);

/* ─── Nav Rendering ───────────────────────────────────── */

function renderNav() {
  var btnSignIn   = document.getElementById('btn-sign-in');
  var userDisplay = document.getElementById('user-display');
  var userNameEl  = document.getElementById('user-name');
  var avatarEl    = document.getElementById('user-avatar');

  if (currentUser) {
    btnSignIn.classList.add('hidden');
    userDisplay.classList.remove('hidden');

    var displayName = (userProfile && userProfile.displayName)
      ? userProfile.displayName
      : (currentUser.displayName || currentUser.email || 'Signed in');
    userNameEl.textContent = displayName;

    var photo = (userProfile && userProfile.photoURL) || currentUser.photoURL || '';
    if (photo && avatarEl) {
      avatarEl.src = photo;
      avatarEl.style.display = 'inline-block';
    } else if (avatarEl) {
      avatarEl.style.display = 'none';
    }
  } else {
    btnSignIn.classList.remove('hidden');
    userDisplay.classList.add('hidden');
    if (avatarEl) avatarEl.style.display = 'none';
  }
}

/* ─── Tab Bar Wiring ──────────────────────────────────── */

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    currentView = btn.dataset.view;
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.view === currentView);
    });
    renderView();
  });
});

/* ─── Main Render Dispatcher ──────────────────────────── */

function renderView() {
  var app = document.getElementById('app');
  if (currentView === 'dashboard')     { app.innerHTML = renderDashboard(); wireDashboard(); }
  else if (currentView === 'briefs')   { app.innerHTML = renderBriefs();    wireBriefs(); }
  else if (currentView === 'opportunities') { app.innerHTML = renderOpps(); wireOpps(); }
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD VIEW
══════════════════════════════════════════════════════════ */

function renderDashboard() {
  if (!currentUser) {
    return '<div class="signed-out-msg"><strong>Welcome to College Brief Lab</strong>Sign in to create and save briefs and opportunities.</div>';
  }

  var briefs = loadBriefs();
  var opps   = loadOpps();

  // Recent activity: merge briefs + opps, sort by createdAt desc, take 5
  var activity = [];
  briefs.forEach(function(b) { activity.push({ type: 'brief', title: b.title || b.briefType, id: b.id, createdAt: b.createdAt }); });
  opps.forEach(function(o)   { activity.push({ type: 'opp',   title: o.name, id: o.id, createdAt: o.createdAt }); });
  activity.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  activity = activity.slice(0, 5);

  var activityHtml = '';
  if (activity.length === 0) {
    activityHtml = '<div class="empty-state">No recent activity yet. Start by building a brief or adding an opportunity.</div>';
  } else {
    activityHtml = '<ul class="activity-list">' +
      activity.map(function(item) {
        var labelClass = item.type === 'opp' ? 'activity-label opp' : 'activity-label';
        var labelText  = item.type === 'opp' ? 'Opportunity' : 'Brief';
        return '<li>' +
          '<span class="' + labelClass + '">' + labelText + '</span>' +
          '<span class="activity-title">' + escHtml(item.title) + '</span>' +
          '<button class="btn-secondary btn-small" data-type="' + item.type + '" data-id="' + item.id + '">Open</button>' +
          '</li>';
      }).join('') +
    '</ul>';
  }

  return '<div class="card">' +
    '<h2>Welcome back' + (userProfile && userProfile.displayName ? ', ' + escHtml(userProfile.displayName.split(' ')[0]) : '') + '.</h2>' +
    '<p>Build structured academic briefs and track application opportunities.</p>' +
  '</div>' +

  '<div class="stat-grid">' +
    '<div class="stat-card"><span class="stat-number">' + briefs.length + '</span><div class="stat-label">Briefs created</div></div>' +
    '<div class="stat-card"><span class="stat-number">' + opps.length + '</span><div class="stat-label">Opportunities tracked</div></div>' +
    '<div class="stat-card"><span class="stat-number">' + opps.filter(function(o){ return o.status === 'in-progress'; }).length + '</span><div class="stat-label">Active projects</div></div>' +
  '</div>' +

  '<div class="card">' +
    '<p class="section-heading">Recent activity</p>' +
    activityHtml +
  '</div>';
}

function wireDashboard() {
  document.querySelectorAll('.activity-list [data-type]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var type = btn.dataset.type;
      currentView = (type === 'opp') ? 'opportunities' : 'briefs';
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.view === currentView);
      });
      renderView();
    });
  });
}

/* ═══════════════════════════════════════════════════════
   BRIEF BUILDER VIEW
══════════════════════════════════════════════════════════ */

function renderBriefs() {
  var briefs = loadBriefs();

  var historyHtml = '';
  if (briefs.length === 0) {
    historyHtml = '<div class="empty-state">No briefs yet on this device.</div>';
  } else {
    historyHtml = '<ul class="brief-history">' +
      briefs.slice(0, 5).map(function(b) {
        var date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';
        return '<li>' +
          '<span class="bh-title">' + escHtml(b.title || b.briefType) + '</span>' +
          '<span class="bh-meta">' + escHtml(b.briefType) + (date ? ' · ' + date : '') + '</span>' +
          '<button class="btn-secondary btn-small" data-brief-id="' + b.id + '">Load</button>' +
        '</li>';
      }).join('') +
    '</ul>';
  }

  return '<div class="brief-builder">' +

    /* ── Left column: inputs ── */
    '<div class="card">' +
      '<h2 style="margin-bottom:18px;">Brief Builder</h2>' +

      '<div class="form-group">' +
        '<label for="bb-prompt">Prompt or Question <span style="color:#c0392b">*</span></label>' +
        '<textarea id="bb-prompt" placeholder="e.g. Argue that federal student loan forgiveness is justified on grounds of economic justice."></textarea>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="bb-notes">Source / Reading notes <span style="color:#999;font-weight:400">(optional)</span></label>' +
        '<textarea id="bb-notes" placeholder="Paste key facts, quotes, or notes from your research here."></textarea>' +
      '</div>' +

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

      '<button id="btn-generate" class="btn-primary">Generate brief</button>' +
    '</div>' +

    /* ── Right column: output ── */
    '<div>' +
      '<div class="card">' +
        '<p class="section-heading">Output</p>' +
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your generated brief will appear here.</span></div>' +
        '<div class="btn-row" id="output-actions" style="display:none">' +
          '<button id="btn-copy" class="btn-secondary btn-small">Copy brief</button>' +
          '<button id="btn-save" class="btn-primary btn-small">Save brief</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<p class="section-heading">Recent briefs on this device</p>' +
        '<div id="brief-history">' + historyHtml + '</div>' +
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

    if (!prompt) {
      alert('Please enter a prompt or question.');
      return;
    }

    var result = generateBrief(prompt, notes, briefType, tone);
    currentBriefOutput = result;

    document.getElementById('brief-output').innerHTML = renderBriefHtml(result);
    document.getElementById('output-actions').style.display = 'flex';
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    navigator.clipboard.writeText(currentBriefOutput.plainText).then(function() {
      var btn = document.getElementById('btn-copy');
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = 'Copy brief'; }, 1800);
    }).catch(function() {
      alert('Could not access clipboard. Please copy manually.');
    });
  });

  document.getElementById('btn-save').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    var briefs = loadBriefs();
    var prompt = document.getElementById('bb-prompt').value.trim();
    var entry = {
      id:          uid(),
      title:       prompt.slice(0, 80),
      briefType:   document.getElementById('bb-type').value,
      createdAt:   Date.now(),
      outlineText: currentBriefOutput.plainText
    };
    briefs.unshift(entry);
    if (briefs.length > 10) briefs = briefs.slice(0, 10);
    saveBriefs(briefs);

    var btn = document.getElementById('btn-save');
    btn.textContent = 'Saved!';
    setTimeout(function() { btn.textContent = 'Save brief'; }, 1800);

    // refresh history list
    document.getElementById('brief-history').innerHTML = renderHistoryList(loadBriefs());
    wireHistoryButtons();
  });

  wireHistoryButtons();
}

function wireHistoryButtons() {
  document.querySelectorAll('[data-brief-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id     = btn.dataset.briefId;
      var briefs = loadBriefs();
      var brief  = briefs.find(function(b) { return b.id === id; });
      if (!brief) return;
      var outputEl = document.getElementById('brief-output');
      outputEl.innerHTML = '<pre style="white-space:pre-wrap;font-size:13px;line-height:1.7">' + escHtml(brief.outlineText) + '</pre>';
      document.getElementById('output-actions').style.display = 'flex';
      currentBriefOutput = { plainText: brief.outlineText };
      document.getElementById('bb-prompt').value = brief.title;
    });
  });
}

function renderHistoryList(briefs) {
  if (briefs.length === 0) {
    return '<div class="empty-state">No briefs yet on this device.</div>';
  }
  return '<ul class="brief-history">' +
    briefs.slice(0, 5).map(function(b) {
      var date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';
      return '<li>' +
        '<span class="bh-title">' + escHtml(b.title || b.briefType) + '</span>' +
        '<span class="bh-meta">' + escHtml(b.briefType) + (date ? ' · ' + date : '') + '</span>' +
        '<button class="btn-secondary btn-small" data-brief-id="' + b.id + '">Load</button>' +
      '</li>';
    }).join('') +
  '</ul>';
}

function renderBriefHtml(result) {
  return result.sections.map(function(section) {
    var heading = '<h3>' + escHtml(section.heading) + '</h3>';
    var body = section.lines.map(function(line) {
      return '<p>' + line + '</p>';
    }).join('');
    return heading + body;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   OPPORTUNITIES VIEW
══════════════════════════════════════════════════════════ */

function renderOpps() {
  var opps = loadOpps();

  var tableHtml = '';
  if (opps.length === 0) {
    tableHtml = '<div class="empty-state">No opportunities yet. Add one above.</div>';
  } else {
    tableHtml = '<div class="opp-table-wrap"><table class="opp-table">' +
      '<thead><tr>' +
        '<th>Name</th><th>Type</th><th>Deadline</th><th>Status</th><th>Goal</th><th></th>' +
      '</tr></thead>' +
      '<tbody>' +
      opps.map(function(o) {
        var statusKey = (o.status || '').toLowerCase().replace(/\s+/g, '-');
        return '<tr>' +
          '<td>' + escHtml(o.name) + (o.link ? ' <a href="' + escHtml(o.link) + '" target="_blank" style="color:#1f3b73;font-size:12px" rel="noopener">[link]</a>' : '') + '</td>' +
          '<td>' + escHtml(o.type) + '</td>' +
          '<td>' + escHtml(o.deadline || '—') + '</td>' +
          '<td><span class="status-badge ' + statusKey + '">' + escHtml(o.status || '—') + '</span></td>' +
          '<td>' + escHtml(o.goal || '—') + '</td>' +
          '<td><button class="btn-secondary btn-small" data-opp-id="' + o.id + '">Open brief</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  return '<div class="card">' +
    '<h2 style="margin-bottom:18px;">Add Opportunity</h2>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
      '<div class="form-group"><label for="opp-name">Name</label><input type="text" id="opp-name" placeholder="e.g. Harvard Crimson Fellowship"></div>' +
      '<div class="form-group"><label for="opp-type">Type</label>' +
        '<select id="opp-type">' +
          '<option>Scholarship</option>' +
          '<option>Fellowship</option>' +
          '<option>Internship</option>' +
          '<option>College Application</option>' +
          '<option>Essay Contest</option>' +
          '<option>Program</option>' +
          '<option>Other</option>' +
        '</select></div>' +
      '<div class="form-group"><label for="opp-deadline">Deadline</label><input type="date" id="opp-deadline"></div>' +
      '<div class="form-group"><label for="opp-status">Status</label>' +
        '<select id="opp-status">' +
          '<option value="not-started">Not started</option>' +
          '<option value="in-progress">In progress</option>' +
          '<option value="submitted">Submitted</option>' +
          '<option value="accepted">Accepted</option>' +
          '<option value="rejected">Rejected</option>' +
        '</select></div>' +
      '<div class="form-group"><label for="opp-link">Link (URL)</label><input type="url" id="opp-link" placeholder="https://"></div>' +
      '<div class="form-group"><label for="opp-goal">Goal / angle</label><input type="text" id="opp-goal" placeholder="e.g. Emphasize community leadership angle"></div>' +
    '</div>' +

    '<button id="btn-add-opp" class="btn-primary">Add opportunity</button>' +
  '</div>' +

  '<div class="card">' +
    '<p class="section-heading">All opportunities</p>' +
    '<div id="opp-table">' + tableHtml + '</div>' +
  '</div>';
}

function wireOpps() {
  document.getElementById('btn-add-opp').addEventListener('click', function() {
    var name     = document.getElementById('opp-name').value.trim();
    var type     = document.getElementById('opp-type').value;
    var deadline = document.getElementById('opp-deadline').value;
    var status   = document.getElementById('opp-status').value;
    var link     = document.getElementById('opp-link').value.trim();
    var goal     = document.getElementById('opp-goal').value.trim();

    if (!name) { alert('Please enter an opportunity name.'); return; }

    var opps = loadOpps();
    opps.unshift({ id: uid(), name: name, type: type, deadline: deadline, status: status, link: link, goal: goal, linkedBriefId: null, createdAt: Date.now() });
    saveOpps(opps);

    // Clear fields
    ['opp-name','opp-deadline','opp-link','opp-goal'].forEach(function(id) { document.getElementById(id).value = ''; });
    document.getElementById('opp-status').value = 'not-started';

    // Re-render table
    document.getElementById('opp-table').innerHTML = renderOppTable(loadOpps());
    wireOppButtons();
  });

  wireOppButtons();
}

function renderOppTable(opps) {
  if (opps.length === 0) return '<div class="empty-state">No opportunities yet. Add one above.</div>';
  return '<div class="opp-table-wrap"><table class="opp-table">' +
    '<thead><tr><th>Name</th><th>Type</th><th>Deadline</th><th>Status</th><th>Goal</th><th></th></tr></thead>' +
    '<tbody>' +
    opps.map(function(o) {
      var statusKey = (o.status || '').toLowerCase().replace(/\s+/g, '-');
      return '<tr>' +
        '<td>' + escHtml(o.name) + (o.link ? ' <a href="' + escHtml(o.link) + '" target="_blank" style="color:#1f3b73;font-size:12px" rel="noopener">[link]</a>' : '') + '</td>' +
        '<td>' + escHtml(o.type) + '</td>' +
        '<td>' + escHtml(o.deadline || '—') + '</td>' +
        '<td><span class="status-badge ' + statusKey + '">' + escHtml(o.status || '—') + '</span></td>' +
        '<td>' + escHtml(o.goal || '—') + '</td>' +
        '<td><button class="btn-secondary btn-small" data-opp-id="' + o.id + '">Open brief</button></td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

function wireOppButtons() {
  document.querySelectorAll('[data-opp-id]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id   = btn.dataset.oppId;
      var opps = loadOpps();
      var opp  = opps.find(function(o) { return o.id === id; });
      if (!opp) return;

      var prefill = 'Write a brief for this opportunity: ' + opp.name + ' — ' + opp.type + '.' + (opp.goal ? ' Goal: ' + opp.goal + '.' : '');

      currentView = 'briefs';
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.view === 'briefs');
      });
      renderView();

      document.getElementById('bb-prompt').value = prefill;
    });
  });
}

/* ═══════════════════════════════════════════════════════
   BRIEF GENERATION ENGINE
══════════════════════════════════════════════════════════ */

function generateBrief(prompt, sourceNotes, briefType, tone) {
  // --- Preprocess ---
  var trimmedPrompt = prompt.trim();
  var topic = trimmedPrompt.split(/[.!?]/)[0].slice(0, 80).trim();

  var keywords = extractKeywords(sourceNotes);
  var kw = keywords.length > 0 ? keywords : [topic.split(' ')[0]];

  var sections = [];

  if (briefType === 'Debate Case') {
    sections = buildDebateCase(topic, kw, tone);
  } else if (briefType === 'Policy Memo') {
    sections = buildPolicyMemo(topic, kw, tone);
  } else {
    sections = buildEssayOutline(topic, kw, tone);
  }

  var plainText = sections.map(function(s) {
    return s.heading.toUpperCase() + '\n' + s.lines.join('\n');
  }).join('\n\n');

  return { sections: sections, plainText: plainText };
}

/* ── Keyword Extractor ── */

var STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','that','this','these','those','it','its','they','them','their','we','our','you','your','i','my','me','he','she','his','her','not','no','so','if','then','than','also','about','after','before','while','during','through','between','into','over','under','all','any','each','every','more','most','other','some','such','there','when','where','which','who','whom','how','what','why']);

function extractKeywords(text) {
  if (!text) return [];
  var freq = {};
  text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).forEach(function(w) {
    if (w.length > 3 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  return Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; }).slice(0, 5);
}

/* ── Tone Helpers ── */

function tonePhrase(tone) {
  if (tone === 'Advocacy') return { assert: 'We must recognize', evidence: 'The evidence compels us to conclude', conclude: 'Action on this front is imperative.' };
  if (tone === 'Academic Formal') return { assert: 'Scholarly analysis indicates', evidence: 'Empirical findings suggest', conclude: 'This warrants further scholarly inquiry.' };
  return { assert: 'Evidence indicates', evidence: 'Analysis shows', conclude: 'This conclusion follows from the evidence presented.' };
}

function weave(topic, kw, tone, template) {
  var tp = tonePhrase(tone);
  return template
    .replace(/\{ASSERT\}/g,   tp.assert)
    .replace(/\{EVIDENCE\}/g, tp.evidence)
    .replace(/\{CONCLUDE\}/g, tp.conclude)
    .replace(/\{TOPIC\}/g,    topic)
    .replace(/\{KW1\}/g,      kw[0] || topic)
    .replace(/\{KW2\}/g,      kw[1] || kw[0] || topic)
    .replace(/\{KW3\}/g,      kw[2] || kw[0] || topic);
}

/* ── Debate Case ── */

function buildDebateCase(topic, kw, tone) {
  var tp = tonePhrase(tone);
  return [
    {
      heading: 'Thesis',
      lines: [
        weave(topic, kw, tone, '{ASSERT} that {TOPIC} represents a pressing matter demanding careful examination. {EVIDENCE} that a principled stance on {KW1} is both justified and necessary.')
      ]
    },
    {
      heading: 'Contention 1 — The Case for ' + cap(kw[0] || topic),
      lines: [
        '<b>' + cap(kw[0] || topic) + ' as a foundational concern.</b>',
        weave(topic, kw, tone, '{ASSERT} that the dimension of {KW1} lies at the core of this debate. {EVIDENCE} that ignoring {KW1} undermines the integrity of any proposed resolution on {TOPIC}.'),
        'When stakeholders examine the full context, the centrality of ' + (kw[0] || topic) + ' becomes undeniable.'
      ]
    },
    {
      heading: 'Contention 2 — ' + cap(kw[1] || topic) + ' and Systemic Impact',
      lines: [
        '<b>Systemic consequences hinge on ' + (kw[1] || kw[0] || topic) + '.</b>',
        weave(topic, kw, tone, '{EVIDENCE} that {KW2} functions as a systemic lever within {TOPIC}. Failure to address it produces cascading effects that extend beyond the immediate scope of the debate.'),
        'A thorough cost-benefit analysis supports this contention on multiple levels.'
      ]
    },
    {
      heading: 'Contention 3 — Precedent and ' + cap(kw[2] || kw[0] || topic),
      lines: [
        '<b>Historical and comparative precedent affirms this position.</b>',
        weave(topic, kw, tone, '{ASSERT} that precedent around {KW3} demonstrates the viability of the approach advanced here. Past outcomes reinforce the case for principled action on {TOPIC}.'),
        'Dismissing this precedent would require ignoring a significant body of evidence.'
      ]
    },
    {
      heading: 'Counterargument 1 + Response',
      lines: [
        '<b>Objection:</b> Critics argue that addressing ' + topic + ' may produce unintended consequences or impose undue costs.',
        '<b>Response:</b> ' + weave(topic, kw, tone, '{EVIDENCE} that these concerns, while worth acknowledging, are outweighed by the demonstrated benefits of engaging seriously with {KW1} in the context of {TOPIC}.')
      ]
    },
    {
      heading: 'Counterargument 2 + Response',
      lines: [
        '<b>Objection:</b> Some contend that alternative framings of ' + topic + ' better serve the goals at stake.',
        '<b>Response:</b> ' + weave(topic, kw, tone, '{ASSERT} that alternative framings neglect the structural role of {KW2}, rendering them insufficient for resolving the core tensions within {TOPIC}.')
      ]
    },
    {
      heading: 'Conclusion',
      lines: [
        weave(topic, kw, tone, 'The foregoing analysis establishes a compelling case on {TOPIC}. {ASSERT} that the convergence of {KW1}, {KW2}, and {KW3} justifies the position advanced.'),
        tp.conclude
      ]
    }
  ];
}

/* ── Policy Memo ── */

function buildPolicyMemo(topic, kw, tone) {
  return [
    {
      heading: 'Executive Summary',
      lines: [
        weave(topic, kw, tone, 'This memo addresses the policy dimension of {TOPIC}. {ASSERT} that structured intervention around {KW1} is both timely and warranted. A clear recommendation follows from the analysis below.')
      ]
    },
    {
      heading: 'Background',
      lines: [
        weave(topic, kw, tone, '{EVIDENCE} that {TOPIC} has emerged as a significant area of concern. Factors including {KW1} and {KW2} have shaped the current landscape, creating conditions that demand a coordinated policy response.'),
        'Prior efforts have addressed adjacent concerns, but a focused approach targeting ' + (kw[0] || topic) + ' remains absent from the policy toolkit.'
      ]
    },
    {
      heading: 'Problem Statement',
      lines: [
        weave(topic, kw, tone, 'The core challenge is that {TOPIC} lacks adequate mechanisms to address {KW1} in a systematic way. {ASSERT} that without deliberate action, the gap between current conditions and desired outcomes will widen.'),
        'Key stakeholders — including those most directly affected by ' + (kw[1] || kw[0] || topic) + ' — bear a disproportionate burden under the status quo.'
      ]
    },
    {
      heading: 'Policy Options',
      lines: [
        '<b>Option A — Regulatory Approach:</b> Implement binding standards that directly govern how ' + (kw[0] || topic) + ' is managed within relevant institutions. Pros: clear accountability. Cons: potential for implementation friction.',
        '<b>Option B — Incentive-Based Approach:</b> Create structured incentives to encourage voluntary adoption of best practices around ' + (kw[1] || kw[0] || topic) + '. Pros: flexible and scalable. Cons: uneven uptake without strong monitoring.',
        '<b>Option C — Hybrid Approach:</b> Combine targeted regulation with incentives to balance compliance and adaptability across contexts involving ' + (kw[2] || kw[0] || topic) + '.'
      ]
    },
    {
      heading: 'Recommendation',
      lines: [
        weave(topic, kw, tone, '{ASSERT} that Option C best addresses the complexity of {TOPIC}. The hybrid approach leverages the strengths of both regulatory clarity and incentive flexibility, while mitigating the risks associated with either strategy in isolation.')
      ]
    },
    {
      heading: 'Next Steps',
      lines: [
        '1. Commission a rapid landscape assessment of current practices related to ' + (kw[0] || topic) + ' within 30 days.',
        '2. Convene a cross-sector working group to refine the hybrid framework before implementation.',
        '3. Establish clear metrics for success and a timeline for review, with checkpoints at 6 and 12 months post-launch.'
      ]
    }
  ];
}

/* ── College Essay Outline ── */

function buildEssayOutline(topic, kw, tone) {
  return [
    {
      heading: 'Hook',
      lines: [
        'Open with a specific, sensory moment connected to ' + topic + '. Avoid clichés — place the reader inside the experience, not above it.',
        weave(topic, kw, tone, 'Consider anchoring the hook around {KW1}, since this theme recurs throughout the essay and grounds the narrative immediately.')
      ]
    },
    {
      heading: 'Core Story',
      lines: [
        weave(topic, kw, tone, 'Establish the central narrative arc: your relationship to {TOPIC} and why it matters to you personally. {ASSERT} that the specificity of {KW1} and {KW2} will distinguish this essay from generic responses.'),
        'Avoid explaining your significance — let the story carry the argument.'
      ]
    },
    {
      heading: 'Moment 1 — Encounter',
      lines: [
        '1. Describe the first time you engaged directly with ' + topic + '. What were the concrete details — who was there, what was at stake, what did you notice?',
        weave(topic, kw, tone, '{EVIDENCE} that this moment reshaped how you understood {KW1}. Show the shift, do not state it.')
      ]
    },
    {
      heading: 'Moment 2 — Challenge or Complication',
      lines: [
        '2. Introduce a tension, obstacle, or contradiction that tested your initial understanding of ' + topic + '.',
        weave(topic, kw, tone, 'How did {KW2} complicate or deepen your perspective? The most compelling essays don\'t resolve conflict quickly — sit with the difficulty briefly before moving forward.')
      ]
    },
    {
      heading: 'Moment 3 — Turning Point',
      lines: [
        '3. Describe the moment of change — a decision made, a realization arrived at, or an action taken in response to the challenge.',
        weave(topic, kw, tone, '{ASSERT} that this moment crystallized something essential about {KW1} and your relationship to {TOPIC}. Be precise; broad statements here lose the reader.')
      ]
    },
    {
      heading: 'Reflection',
      lines: [
        weave(topic, kw, tone, '{EVIDENCE} that your engagement with {TOPIC} has changed how you think, relate to others, or approach problems. Reflection should be earned by the story — not appended to it.'),
        'Reference ' + (kw[0] || topic) + ' specifically to tie the reflection back to the narrative thread.'
      ]
    },
    {
      heading: 'Takeaway',
      lines: [
        'End with a forward-looking sentence that connects your past experience to who you are becoming — not who you want to be in a vague sense, but what you will bring to college, your field, or your community.',
        weave(topic, kw, tone, 'Ground the closing in {KW1} or {KW2} so it feels specific, not generic. {CONCLUDE}')
      ]
    }
  ];
}

/* ─── Utility ─────────────────────────────────────────── */

function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── Auth Button Wiring ──────────────────────────────── */

document.getElementById('btn-sign-in').addEventListener('click', function() {
  if (typeof signInGoogle === 'function') signInGoogle();
});

document.getElementById('btn-sign-out').addEventListener('click', function() {
  if (typeof logOut === 'function') logOut();
});

/* ─── Initial Render ──────────────────────────────────── */

renderNav();
renderView();
