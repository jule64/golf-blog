const id = new URLSearchParams(location.search).get('id');
let aiEnabled = false;

function stars(n) {
  if (!n) return '';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

function vsPar(score, course_par) {
  if (score == null) return null;
  const diff = course_par != null ? score - course_par : score - 100;
  const label = course_par != null ? 'vs par' : 'vs 100';
  const cls = diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';
  const sign = diff > 0 ? '+' : '';
  return `<span class="vs-par ${cls}">${sign}${diff} ${label}</span>`;
}

function diffClass(d) {
  if (d == null) return '';
  return d < 0 ? 'diff-under' : d > 0 ? 'diff-over' : 'diff-even';
}

function diffLabel(d) {
  if (d == null) return '—';
  if (d === 0) return 'E';
  return (d > 0 ? '+' : '') + d;
}

function renderHolesTable(sessionHoles, scorecardHoles) {
  if (!sessionHoles || sessionHoles.length === 0) return '';

  const scMap = {};
  (scorecardHoles || []).forEach(h => { scMap[h.hole] = h; });

  const hasPar = scorecardHoles && scorecardHoles.length > 0;

  let totalStrokes = 0, totalPar = 0, outStrokes = 0, outPar = 0, inStrokes = 0, inPar = 0;
  sessionHoles.forEach(h => {
    if (h.strokes != null) {
      totalStrokes += h.strokes;
      if (h.hole <= 9) outStrokes += h.strokes; else inStrokes += h.strokes;
    }
    const sc = scMap[h.hole];
    if (hasPar && sc?.par) {
      totalPar += sc.par;
      if (h.hole <= 9) outPar += sc.par; else inPar += sc.par;
    }
  });

  const front9 = sessionHoles.filter(h => h.hole <= 9);
  const back9 = sessionHoles.filter(h => h.hole > 9);

  function headerRow() {
    return `<tr>
      <th>Hole</th>
      ${hasPar ? '<th>Par</th>' : ''}
      ${hasPar ? '<th>S.I.</th>' : ''}
      <th>Score</th>
      ${hasPar ? '<th>+/−</th>' : ''}
    </tr>`;
  }

  function holeRow(h) {
    const sc = scMap[h.hole];
    const diff = hasPar && sc?.par && h.strokes != null ? h.strokes - sc.par : null;
    return `<tr>
      <td>${h.hole}</td>
      ${hasPar ? `<td>${sc?.par ?? '—'}</td>` : ''}
      ${hasPar ? `<td>${sc?.si ?? '—'}</td>` : ''}
      <td>${h.strokes ?? '—'}</td>
      ${hasPar ? `<td class="${diffClass(diff)}">${diffLabel(diff)}</td>` : ''}
    </tr>`;
  }

  function subtotalRow(label, strokes, par) {
    const diff = hasPar && par ? strokes - par : null;
    return `<tr class="sep-row">
      <td>${label}</td>
      ${hasPar ? `<td>${par || '—'}</td>` : ''}
      ${hasPar ? '<td></td>' : ''}
      <td>${strokes || '—'}</td>
      ${hasPar ? `<td class="${diffClass(diff)}">${diffLabel(diff)}</td>` : ''}
    </tr>`;
  }

  const rows = [];
  if (front9.length > 0) {
    rows.push(...front9.map(holeRow));
    if (back9.length > 0) rows.push(subtotalRow('OUT', outStrokes, outPar));
  }
  if (back9.length > 0) {
    rows.push(...back9.map(holeRow));
    rows.push(subtotalRow('IN', inStrokes, inPar));
  }
  const totalDiff = hasPar && totalPar ? totalStrokes - totalPar : null;
  rows.push(`<tr class="total-row">
    <td>TOTAL</td>
    ${hasPar ? `<td>${totalPar || '—'}</td>` : ''}
    ${hasPar ? '<td></td>' : ''}
    <td>${totalStrokes || '—'}</td>
    ${hasPar ? `<td class="${diffClass(totalDiff)}">${diffLabel(totalDiff)}</td>` : ''}
  </tr>`);

  return `
    <div class="section">
      <div class="section-label">Hole by hole</div>
      <div class="card" style="padding:0;overflow:auto;">
        <table class="holes-table">
          <thead>${headerRow()}</thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function render(s, scorecardHoles) {
  const vpHtml = s.type === 'round' ? (vsPar(s.score, s.course_par) || '') : '';

  return `
    <a href="/" style="font-size:.85rem;color:var(--gray-600);text-decoration:none;display:inline-flex;align-items:center;gap:.3rem;margin-bottom:1rem;">← Back to History</a>
    <div class="card session-header">
      <div class="session-meta-row">
        <span class="badge badge-${s.type}">${s.type}</span>
        <span class="meta">${formatDate(s.date)}</span>
        ${s.rating ? `<span class="stars" title="${s.rating}/5">${stars(s.rating)}</span>` : ''}
      </div>
      <h1>${s.venue_name || 'Unknown venue'}</h1>
      ${s.type === 'round' && s.score != null ? `
        <div class="score-block">
          <span class="big-score">${s.score}</span>
          ${vpHtml}
        </div>` : ''}
      <div class="action-bar">
        <a href="/add-session.html?id=${s.id}" class="btn btn-secondary btn-sm">Edit</a>
        ${aiEnabled && !s.ai_summary ? `<button class="btn btn-sm btn-secondary" onclick="regenerate()">✨ Generate AI summary</button>` : ''}
        ${aiEnabled && s.ai_summary ? `<button class="btn btn-sm btn-secondary" onclick="regenerate()">↺ Regenerate summary</button>` : ''}
        <button class="btn btn-sm btn-danger" onclick="deleteSession()">Delete</button>
      </div>
    </div>

    ${s.ai_summary ? `
    <div class="section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">
        <div class="section-label" style="margin-bottom:0;" id="summary-label">AI Summary</div>
        ${s.note ? `<button class="btn btn-sm btn-secondary" id="toggle-summary-btn" onclick="toggleSummary()">Show original notes</button>` : ''}
      </div>
      <div class="ai-summary-full" id="ai-summary-text">${s.ai_summary}</div>
      ${s.note ? `<div class="card" id="note-text" style="display:none;"><p class="note-text">${s.note}</p></div>` : ''}
    </div>` : ''}

    ${s.note && !s.ai_summary ? `
    <div class="section">
      <div class="section-label">My Notes</div>
      <div class="card"><p class="note-text">${s.note}</p></div>
    </div>` : ''}

    ${renderHolesTable(s.holes, scorecardHoles)}
  `;
}

async function regenerate() {
  const btn = document.querySelector('button[onclick="regenerate()"]');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  const res = await fetch(`/api/sessions/${id}/regenerate-summary`, { method: 'POST' });
  if (res.ok) {
    const { ai_summary } = await res.json();
    const el = document.getElementById('ai-summary-text');
    if (el) {
      el.textContent = ai_summary;
    } else {
      location.reload();
    }
    btn.textContent = '↺ Regenerate summary';
    btn.disabled = false;
  } else {
    const { error } = await res.json();
    alert('Failed: ' + error);
    btn.textContent = '↺ Regenerate summary';
    btn.disabled = false;
  }
}

async function deleteSession() {
  if (!confirm('Delete this session?')) return;
  await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
  location.href = '/';
}

function toggleSummary() {
  const aiEl = document.getElementById('ai-summary-text');
  const noteEl = document.getElementById('note-text');
  const btn = document.getElementById('toggle-summary-btn');
  const label = document.getElementById('summary-label');
  const showingAI = aiEl.style.display !== 'none';
  aiEl.style.display = showingAI ? 'none' : '';
  noteEl.style.display = showingAI ? '' : 'none';
  btn.textContent = showingAI ? 'Show AI summary' : 'Show original notes';
  label.textContent = showingAI ? 'My Notes' : 'AI Summary';
}

async function load() {
  if (!id) { document.getElementById('content').innerHTML = '<p>No session ID.</p>'; return; }

  const [configRes, sessionRes, statsRes] = await Promise.all([
    fetch('/api/config'),
    fetch(`/api/sessions/${id}`),
    fetch('/api/stats/summary'),
  ]);

  if (!sessionRes.ok) { document.getElementById('content').innerHTML = '<p>Session not found.</p>'; return; }

  const config = await configRes.json();
  aiEnabled = config.aiEnabled;

  if (statsRes.ok) {
    const stats = await statsRes.json();
    const el = document.getElementById('session-counts');
    if (el) el.innerHTML = `<span>Rounds: <strong>${stats.rounds_played}</strong></span><span>Range: <strong>${stats.range_sessions}</strong></span>`;
  }

  const session = await sessionRes.json();

  let scorecardHoles = [];
  if (session.venue_id) {
    const scRes = await fetch(`/api/venues/${session.venue_id}`);
    if (scRes.ok) {
      const sc = await scRes.json();
      scorecardHoles = sc.holes || [];
    }
  }

  document.title = `Golf Blog — ${session.venue_name || 'Session'} ${session.date}`;
  document.getElementById('content').innerHTML = render(session, scorecardHoles);
}

load();
