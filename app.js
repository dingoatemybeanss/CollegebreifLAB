/* ─── Global State ────────────────────────────────────── */

var currentUser = null;
var userProfile = null;
var currentView = 'dashboard';
var currentBriefOutput = null;

/* ─── LocalStorage Keys ───────────────────────────────── */

var KEY_BRIEFS = 'cbl-briefs';
var KEY_OPPS   = 'cbl-opportunities';

/* ─── LocalStorage Helpers ────────────────────────────── */

function loadBriefs() {
  try { return JSON.parse(localStorage.getItem(KEY_BRIEFS) || '[]'); }
  catch(e) { return []; }
}
function saveBriefs(arr) { localStorage.setItem(KEY_BRIEFS, JSON.stringify(arr)); }

function loadOpps() {
  try { return JSON.parse(localStorage.getItem(KEY_OPPS) || '[]'); }
  catch(e) { return []; }
}
function saveOpps(arr) { localStorage.setItem(KEY_OPPS, JSON.stringify(arr)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ─── Auth State ──────────────────────────────────────── */

function handleAuthState(event) {
  currentUser  = event.detail.user    || null;
  userProfile  = event.detail.profile || null;
  renderNav();
  renderView();
}
document.addEventListener('ne-auth-state', handleAuthState);

/* ─── Nav ─────────────────────────────────────────────── */

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
    if (photo && avatarEl) { avatarEl.src = photo; avatarEl.style.display = 'inline-block'; }
    else if (avatarEl)     { avatarEl.style.display = 'none'; }
  } else {
    btnSignIn.classList.remove('hidden');
    userDisplay.classList.add('hidden');
    if (avatarEl) avatarEl.style.display = 'none';
  }
}

/* ─── Tab Bar ─────────────────────────────────────────── */

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchView(btn.dataset.view);
  });
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.view === currentView);
  });
  renderView();
}

/* ─── Render Dispatcher ───────────────────────────────── */

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
      '<p>Sign in to create and save briefs and track your applications.</p>' +
    '</div>';
  }

  var briefs = loadBriefs();
  var opps   = loadOpps();
  var firstName = (userProfile && userProfile.displayName)
    ? userProfile.displayName.split(' ')[0]
    : '';

  var inProgress = opps.filter(function(o) {
    return o.status === 'Brainstorming' || o.status === 'Drafting' || o.status === 'Polishing';
  }).length;

  var activity = [];
  briefs.forEach(function(b) { activity.push({ type: 'brief', title: b.title || b.briefType, id: b.id, createdAt: b.createdAt }); });
  opps.forEach(function(o)   { activity.push({ type: 'opp',   title: o.name,  id: o.id, createdAt: o.createdAt }); });
  activity.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  activity = activity.slice(0, 5);

  var activityHtml = activity.length === 0
    ? '<div class="empty-state">No recent activity. Build a brief or add an application to get started.</div>'
    : '<ul class="activity-list">' + activity.map(function(item) {
        var cls  = item.type === 'opp' ? 'chip chip-opp' : 'chip chip-brief';
        var lbl  = item.type === 'opp' ? 'Application' : 'Brief';
        return '<li>' +
          '<span class="' + cls + '">' + lbl + '</span>' +
          '<span class="activity-title">' + escHtml(item.title) + '</span>' +
          '<button class="btn-ghost btn-small" data-type="' + item.type + '" data-id="' + item.id + '">Open →</button>' +
        '</li>';
      }).join('') + '</ul>';

  return '<div class="card hero-card">' +
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
      '<p class="subtitle">Generate a structured argument, memo, or essay outline from your prompt.</p>' +

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
        '<p class="section-heading">Output</p>' +
        '<div id="brief-output" class="brief-output"><span class="output-placeholder">Your brief will appear here after generation.</span></div>' +
        '<div class="btn-row" id="output-actions" style="display:none">' +
          '<button id="btn-copy" class="btn-secondary btn-small">Copy</button>' +
          '<button id="btn-save" class="btn-primary btn-small">Save to history</button>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<p class="section-heading">Recent briefs on this device</p>' +
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

    var btn = document.getElementById('btn-generate');
    btn.textContent = 'Generating…';
    btn.disabled = true;

    setTimeout(function() {
      var result = generateBrief(prompt, notes, briefType, tone);
      currentBriefOutput = result;
      document.getElementById('brief-output').innerHTML = renderBriefHtml(result);
      document.getElementById('output-actions').style.display = 'flex';
      btn.textContent = 'Generate brief';
      btn.disabled = false;
    }, 120);
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    navigator.clipboard.writeText(currentBriefOutput.plainText).then(function() {
      var b = document.getElementById('btn-copy');
      b.textContent = 'Copied!';
      setTimeout(function() { b.textContent = 'Copy'; }, 1800);
    }).catch(function() {
      alert('Could not access clipboard — please select and copy the text manually.');
    });
  });

  document.getElementById('btn-save').addEventListener('click', function() {
    if (!currentBriefOutput) return;
    var briefs = loadBriefs();
    var prompt  = document.getElementById('bb-prompt').value.trim();
    briefs.unshift({
      id:          uid(),
      title:       prompt.slice(0, 80),
      briefType:   document.getElementById('bb-type').value,
      createdAt:   Date.now(),
      outlineText: currentBriefOutput.plainText
    });
    if (briefs.length > 10) briefs = briefs.slice(0, 10);
    saveBriefs(briefs);
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
        '<pre class="brief-pre">' + escHtml(brief.outlineText) + '</pre>';
      document.getElementById('output-actions').style.display = 'flex';
      currentBriefOutput = { plainText: brief.outlineText };
      document.getElementById('bb-prompt').value = brief.title;
    });
  });
}

function renderHistoryList(briefs) {
  if (briefs.length === 0) return '<div class="empty-state">No saved briefs yet.</div>';
  return '<ul class="brief-history">' +
    briefs.slice(0, 5).map(function(b) {
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
    var h = '<h3 class="brief-heading">' + escHtml(s.heading) + '</h3>';
    var body = s.lines.map(function(line) {
      return '<p class="brief-para">' + line + '</p>';
    }).join('');
    return '<div class="brief-section">' + h + body + '</div>';
  }).join('');
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
      '<p class="subtitle">Track colleges, scholarships, and programs — and link each one to a brief or essay outline.</p>' +
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
        '<select id="opp-cat">' +
          OPP_CATS.map(function(c) { return '<option>' + c + '</option>'; }).join('') +
        '</select>' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-deadline">Deadline <span class="req">*</span></label>' +
        '<input type="date" id="opp-deadline">' +
      '</div>' +

      '<div class="form-group">' +
        '<label for="opp-status">Status</label>' +
        '<select id="opp-status">' +
          OPP_STATUSES.map(function(s) { return '<option>' + s + '</option>'; }).join('') +
        '</select>' +
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
  if (opps.length === 0) {
    return '<div class="empty-state" style="margin-top:8px">No applications tracked yet. Add one above.</div>';
  }

  return '<div class="opp-cards">' +
    opps.map(function(o) {
      var statusCls = statusClass(o.status);
      var dl = o.deadline ? formatDate(o.deadline) : 'No deadline';
      var linkHtml = o.link
        ? '<a href="' + escHtml(o.link) + '" target="_blank" rel="noopener" class="opp-link">Website ↗</a>'
        : '';
      var catHtml = '<span class="chip chip-cat">' + escHtml(o.category || o.type || 'Other') + '</span>';

      var statusOptions = OPP_STATUSES.map(function(s) {
        return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>';
      }).join('');

      return '<div class="opp-card">' +
        '<div class="opp-card-top">' +
          '<div>' +
            '<div class="opp-card-name">' + escHtml(o.name) + '</div>' +
            '<div class="opp-card-meta">' + catHtml + '<span class="opp-deadline">Due ' + escHtml(dl) + '</span>' + linkHtml + '</div>' +
          '</div>' +
          '<select class="status-select ' + statusCls + '" data-status-id="' + o.id + '">' + statusOptions + '</select>' +
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

    var opps = loadOpps();
    opps.unshift({ id: uid(), name: name, category: cat, deadline: deadline, status: status, link: link, strategy: strategy, createdAt: Date.now() });
    saveOpps(opps);

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
      document.getElementById('bb-type').value = 'College Essay Outline';
    });
  });

  document.querySelectorAll('[data-status-id]').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var opps = loadOpps();
      var opp  = opps.find(function(o) { return o.id === sel.dataset.statusId; });
      if (!opp) return;
      opp.status = sel.value;
      saveOpps(opps);
      sel.className = 'status-select ' + statusClass(sel.value);
    });
  });
}

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
   BRIEF GENERATION ENGINE
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
  text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).forEach(function(w) {
    if (w.length >= 4 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  return Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; }).slice(0, 5);
}

function tonePhrase(base, tone) {
  var map = {
    'thesis': {
      'Neutral Analytic': 'This analysis finds',
      'Advocacy':         'This brief argues',
      'Academic Formal':  'This paper contends'
    },
    'evidence': {
      'Neutral Analytic': 'The evidence suggests',
      'Advocacy':         'We must recognize',
      'Academic Formal':  'The available evidence indicates'
    },
    'conclude': {
      'Neutral Analytic': 'The brief finds',
      'Advocacy':         'It is urgent that',
      'Academic Formal':  'Consequently, this analysis finds'
    }
  };
  return (map[base] && map[base][tone]) || base;
}

function generateBrief(prompt, sourceNotes, briefType, tone) {
  var trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return null;

  var topic;
  var sentenceMatch = trimmedPrompt.match(/^([^.!?]{5,})[.!?]/);
  if (sentenceMatch) {
    topic = sentenceMatch[1].trim();
  } else {
    var cut = trimmedPrompt.slice(0, 80);
    var lastSpace = cut.lastIndexOf(' ');
    topic = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
  }

  var kw = extractKeywords(sourceNotes);
  if (kw.length === 0) kw = extractKeywords(trimmedPrompt).slice(0, 3);
  if (kw.length === 0) kw = [topic.split(' ').filter(function(w){ return w.length > 3; })[0] || topic.split(' ')[0]];

  var sections, plainText;

  if (briefType === 'Debate Case') {
    sections = buildDebateCase(topic, kw, tone);
  } else if (briefType === 'Policy Memo') {
    sections = buildPolicyMemo(topic, kw, tone);
  } else {
    sections = buildEssayOutline(topic, kw, tone);
  }

  plainText = sections.map(function(s) {
    return s.heading + '\n' + s.lines.map(function(l) { return stripTags(l); }).join('\n');
  }).join('\n\n');

  return { sections: sections, plainText: plainText };
}

/* ── Debate Case ── */

function buildDebateCase(topic, kw, tone) {
  var k0 = kw[0] || topic.split(' ')[0];
  var k1 = kw[1] || k0;
  var k2 = kw[2] || k0;

  var thesisStart = tonePhrase('thesis', tone);
  var evidStart   = tonePhrase('evidence', tone);
  var concStart   = tonePhrase('conclude', tone);

  var topicShort = topic.length > 60 ? topic.slice(0, 57) + '…' : topic;

  return [
    {
      heading: 'Thesis',
      lines: [
        thesisStart + ' that ' + topicShort + ' — a position supported by a convergence of social, institutional, and empirical evidence. ' +
        'The question is not merely academic: decisions on this matter directly shape policy, public discourse, and lived outcomes related to ' + k0 + '.',
        'The strongest case for this position rests on three independent contentions, each grounded in distinct reasoning. ' +
        evidStart + ' that the totality of these arguments, when considered together, compels a clear judgment.'
      ]
    },
    {
      heading: 'Contention 1 — The social consequences of ' + cap(topic),
      lines: [
        '<b>' + cap(k0) + ' as a driver of measurable harm.</b>',
        thesisStart + ' that the social ramifications of ' + topic + ' extend well beyond abstract principle. When ' + k0 + ' goes unaddressed, the downstream effects accumulate across communities and institutions in ways that are difficult to reverse.',
        evidStart + ' that data on ' + k0 + (kw[1] ? ' and ' + k1 : '') + ' consistently shows a correlation between inaction and widening inequality in outcomes. Affected populations bear disproportionate costs while decision-makers remain insulated from consequences.',
        'This asymmetry is not incidental — it is structural. ' + concStart + ' that any serious engagement with ' + topicShort + ' must begin by taking the social harm dimension seriously, not as a side consideration but as the central stake.'
      ]
    },
    {
      heading: 'Contention 2 — Systemic implications of ' + cap(k1),
      lines: [
        '<b>The systemic dimension: how ' + k1 + ' shapes the broader landscape.</b>',
        'Debates about ' + topic + ' are rarely contained within a single domain. ' + evidStart + ' that ' + k1 + ' operates as a systemic variable — changes to how we handle it reverberate across legal, economic, and social systems simultaneously.',
        'Critics who argue for a narrow or incremental approach underestimate how deeply ' + k1 + ' is entangled with adjacent policy areas. A change in one domain without corresponding reform in others creates contradictions that prove costly over time.',
        thesisStart + ' that the systemic scale of this issue demands a proportionate response. Judges or decision-makers who confine their analysis to surface-level effects will miss the more consequential long-term risks that ' + topic + ' poses.'
      ]
    },
    {
      heading: 'Contention 3 — Democratic and institutional stakes of ' + cap(k2),
      lines: [
        '<b>Accountability and legitimacy depend on how we resolve ' + k2 + '.</b>',
        'At its core, the debate over ' + topic + ' is a question of institutional integrity. ' + thesisStart + ' that when governing bodies fail to act decisively on ' + k2 + ', they erode the trust of those whose lives are shaped by these decisions.',
        'Historical precedent supports this view: deferral of similar issues has consistently produced worse outcomes than early, structured engagement. ' + evidStart + ' that the cost of delay, measured in both material and democratic terms, justifies decisive action now.',
        'This is not a partisan argument — it is an institutional one. The long-term legitimacy of the relevant bodies depends on their willingness to confront ' + topicShort + ' directly.'
      ]
    },
    {
      heading: 'Counterargument 1 + Response',
      lines: [
        '<b>Objection:</b> Opponents argue that the harms associated with ' + topic + ' are overstated, and that the proposed stance is disproportionate to the actual evidence.',
        '<b>Response:</b> This objection conflates contested empirical claims with the underlying structural reality. ' + evidStart + ' that even conservative estimates of the impact of ' + k0 + ' support the claim that inaction is more costly than action. The burden of proof lies with those who would maintain the status quo in the face of accumulating evidence.'
      ]
    },
    {
      heading: 'Counterargument 2 + Response',
      lines: [
        '<b>Objection:</b> Some contend that alternative approaches — incremental reform or delegated authority — offer a better path than the position advanced in Contention 2.',
        '<b>Response:</b> Incremental reform has been attempted in analogous contexts and has repeatedly failed to address the systemic character of ' + k1 + '. ' + thesisStart + ' that half-measures in the face of a structural problem do not solve it — they delay and often entrench it. The evidence from Contention 2 directly rebuts the feasibility of this alternative.'
      ]
    },
    {
      heading: 'Conclusion',
      lines: [
        'The three contentions establish a mutually reinforcing case: the social harms of ' + topic + ' are real and measurable, the systemic implications demand more than surface-level reform, and the democratic stakes make delay costly in ways that compound over time.',
        concStart + ' that a judge or decision-maker who weighs this evidence seriously should side with the position advanced here — not as a matter of ideology, but as a principled response to what the evidence about ' + (kw[0] || topic) + ' actually shows.'
      ]
    }
  ];
}

/* ── Policy Memo ── */

function buildPolicyMemo(topic, kw, tone) {
  var k0 = kw[0] || topic.split(' ')[0];
  var k1 = kw[1] || k0;
  var k2 = kw[2] || k0;

  var thesisStart = tonePhrase('thesis', tone);
  var evidStart   = tonePhrase('evidence', tone);
  var concStart   = tonePhrase('conclude', tone);

  return [
    {
      heading: 'Executive Summary',
      lines: [
        'This memo addresses the policy question of ' + topic + '. ' + thesisStart + ' that the current approach is insufficient given the scale and urgency of the problem.',
        evidStart + ' that a structured, phased intervention targeting ' + k0 + ' and ' + k1 + ' offers the strongest path to durable reform. This memo recommends Option C — a hybrid approach — as the most defensible policy position, balancing feasibility with meaningful impact.',
        'Immediate action is warranted. Further delay risks locking in conditions that will prove significantly more expensive to remedy.'
      ]
    },
    {
      heading: 'Background',
      lines: [
        'The debate over ' + topic + ' has been ongoing for several years, with repeated calls for action met by procedural delay or fragmented responses.',
        evidStart + ' that data on ' + k0 + ' shows a consistent pattern: absent coordinated intervention, disparities in outcomes widen rather than narrow over time.',
        'Relevant prior efforts — including those focused on ' + k1 + ' — have demonstrated both the potential and the limits of piecemeal approaches. A more integrated framework is needed.',
        'International comparisons offer additional context: jurisdictions that addressed ' + k0 + ' systematically have seen measurably better results on downstream indicators relevant to ' + topic + '.'
      ]
    },
    {
      heading: 'Problem Statement',
      lines: [
        'The core problem is that ' + topic + ' lacks a coherent, enforceable framework. As a result, ' + k0 + ' continues to produce harms that fall disproportionately on the populations least equipped to absorb them.',
        evidStart + ' that the costs of inaction — measured in both direct expenditures and opportunity costs — exceed the projected costs of reform across a 5–10 year horizon.',
        'Without structured intervention, the status quo will persist or worsen. ' + concStart + ' that the policy window for effective action is narrow and should not be squandered.'
      ]
    },
    {
      heading: 'Policy Options',
      lines: [
        '<b>Option A — Maintain status quo with monitoring:</b> Continue existing policies while investing in data collection on ' + k0 + ' and ' + k1 + '. Low implementation cost; fails to address structural drivers; likely to produce incrementally worse outcomes.',
        '<b>Option B — Targeted regulatory reform:</b> Implement binding standards specifically governing ' + k0 + '. Pros: high accountability, clear enforcement mechanism. Cons: narrow scope may displace the problem rather than resolve it; requires significant administrative capacity.',
        '<b>Option C — Hybrid incentive and regulatory framework:</b> Combine structured incentives for voluntary adoption of best practices with baseline regulatory requirements tied to ' + k1 + ' and ' + k2 + '. Balances flexibility and accountability; scalable across diverse contexts; precedent exists in adjacent policy domains.'
      ]
    },
    {
      heading: 'Recommendation',
      lines: [
        thesisStart + ' that Option C provides the strongest foundation for sustainable reform on ' + topic + '.',
        'The hybrid model addresses the core tension between enforceability and adaptability. By anchoring the framework in ' + k0 + ' while allowing contextual variation on ' + k1 + ', it avoids the brittleness of a purely regulatory approach while setting a floor that prevents the weakest performers from defecting.',
        evidStart + ' that comparable frameworks in analogous policy areas have achieved durable results within three to five years of full implementation. ' + concStart + ' that Option C represents the most defensible choice given the evidence and the policy environment.'
      ]
    },
    {
      heading: 'Next Steps',
      lines: [
        '• Commission a 30-day landscape assessment of current practices and gaps related to ' + k0 + ', with a focus on jurisdictions where ' + topic + ' is most acute.',
        '• Convene a cross-sector working group — including representatives from affected communities, legal experts, and practitioners — to refine the Option C framework before formal adoption.',
        '• Establish measurable success criteria and a 12-month review cycle, with public reporting on progress against benchmarks tied to outcomes on ' + k1 + ' and ' + k2 + '.'
      ]
    }
  ];
}

/* ── College Essay Outline ── */

function buildEssayOutline(topic, kw, tone) {
  var k0 = kw[0] || 'this experience';
  var k1 = kw[1] || k0;
  var k2 = kw[2] || k0;

  var thesisStart = tonePhrase('thesis', tone);
  var evidStart   = tonePhrase('evidence', tone);
  var concStart   = tonePhrase('conclude', tone);

  return [
    {
      heading: 'Hook',
      lines: [
        'Open with a small, precise moment — a specific place, object, or exchange — that connects directly to ' + topic + '. The reader should feel present before they understand what the essay is about.',
        'Resist the urge to start with a summary or a statement of intent. A single vivid detail about ' + k0 + ' will do more work than a paragraph of explanation.'
      ]
    },
    {
      heading: 'Core Story',
      lines: [
        'Establish the situation: where you were, what you were working on or experiencing, and what was at stake for you personally in relation to ' + topic + '.',
        'Ground the narrative in ' + k0 + ' — not as a theme to be analyzed, but as the texture of the experience itself. The reader should understand your context before they understand your conclusion.',
        evidStart + ' that the most effective college essays stay close to the concrete. Resist the pull toward abstraction; let the story carry the meaning.',
        'Introduce the central tension or question that the experience raised for you. This doesn\'t need to be a dramatic conflict — it can be a quiet contradiction or an unexpected discovery connected to ' + k1 + '.',
        'By the end of the core story, the reader should know what you were up against and why it mattered.'
      ]
    },
    {
      heading: 'Moment 1 — First encounter with ' + cap(k0),
      lines: [
        'Describe the first time you engaged directly and seriously with ' + topic + '. What did you notice that others might have missed? What did you do, and why?',
        'Show the texture of the experience — the specific details that made it real. ' + evidStart + ' that concrete particulars are more persuasive than general claims about growth or impact.'
      ]
    },
    {
      heading: 'Moment 2 — Complication or challenge',
      lines: [
        'Introduce the moment when something didn\'t go as planned, or when your initial understanding of ' + k1 + ' proved incomplete.',
        'The most compelling essays don\'t resolve difficulty quickly. Sit with the complication for a sentence or two before showing how you responded — the reader needs to feel the weight of it before they can appreciate the turn.'
      ]
    },
    {
      heading: 'Moment 3 — Turning point',
      lines: [
        'Describe the decision, realization, or action that marked a shift in how you approached ' + topic + ' or understood ' + k2 + '.',
        'Be specific: what changed, when, and because of what? A vague epiphany is less persuasive than a precise moment of recalibration. ' + thesisStart + ' that this turning point should be earned by the story that precedes it, not announced or explained.'
      ]
    },
    {
      heading: 'Reflection',
      lines: [
        'Step back from the narrative and articulate what changed internally — in your beliefs, habits of mind, or understanding of ' + k0 + ' — as a result of the experience.',
        'Reflection should follow naturally from the story, not feel appended to it. The goal is not to explain what the reader should think, but to show what you now see differently.',
        evidStart + ' that the strongest reflections are honest about ambiguity. You don\'t need to have resolved every question about ' + topic + ' — you need to have thought about it with genuine seriousness.',
        'Connect the internal change to something concrete: a habit you developed, a perspective you revised, a question you continue to carry about ' + k1 + ' or ' + k2 + '.'
      ]
    },
    {
      heading: 'Takeaway',
      lines: [
        'Close by connecting your experience with ' + topic + ' to who you are becoming — not as a destination but as an ongoing project.',
        'Be specific about what you will bring to a college community: a way of engaging with ideas, a set of skills refined through working on ' + k0 + ', or a commitment that the experience helped clarify.',
        concStart + ' that the strongest endings are quiet and specific, not grand. Let the story do the persuading — the final lines only need to leave the reader with a clear sense of you.'
      ]
    }
  ];
}

/* ─── Utilities ───────────────────────────────────────── */

function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

/* ─── Auth Buttons ────────────────────────────────────── */

document.getElementById('btn-sign-in').addEventListener('click', function() {
  if (typeof signInGoogle === 'function') signInGoogle();
});
document.getElementById('btn-sign-out').addEventListener('click', function() {
  if (typeof logOut === 'function') logOut();
});

/* ─── Initial Render ──────────────────────────────────── */

renderNav();
renderView();
