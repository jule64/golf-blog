let currentFilter = 'all';
let aiEnabled = false;

function stars(n) {
  if (!n) return '';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function vsPar(score, course_par) {
  if (score == null) return null;
  const diff = course_par != null ? score - course_par : score - 100;
  return { diff, label: course_par != null ? 'vs par' : 'vs 100' };
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

function renderVsPar(diff, label) {
  if (diff == null) return '';
  const cls = diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';
  const sign = diff > 0 ? '+' : '';
  return `<span class="vs-par ${cls}">${sign}${diff} ${label}</span>`;
}

function renderCard(s) {
  const vp = s.type === 'round' ? vsPar(s.score, s.course_par) : null;
  return `
    <div class="card session-card" id="card-${s.id}" onclick="cardClick(event, ${s.id})" style="cursor:pointer;">
      <div>
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem;">
          <span class="badge badge-${s.type}">${s.type}</span>
          <span class="meta">${formatDate(s.date)}</span>
          ${s.rating ? `<span class="stars" title="${s.rating}/5">${stars(s.rating)}</span>` : ''}
        </div>
        <div class="venue">${s.venue_name || 'Unknown venue'}</div>
        ${s.ai_summary
          ? `<div class="ai-summary" style="margin-top:.75rem;">${s.ai_summary.slice(0,200)}${s.ai_summary.length>200?'…':''}</div>`
          : aiEnabled ? `<div style="margin-top:.75rem;"><button class="btn btn-sm btn-secondary" onclick="regenerateSummary(${s.id}, this)">✨ Generate AI summary</button></div>` : ''
        }
      </div>
      <div style="text-align:right;">
        ${s.type === 'round' && s.score != null ? `<div class="score-badge">${s.score}</div>` : ''}
        ${vp ? renderVsPar(vp.diff, vp.label) : ''}
        <div class="actions" style="margin-top:.75rem;">
          <a href="/add-session.html?id=${s.id}" class="btn btn-sm btn-secondary" onclick="event.stopPropagation()">Edit</a>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSession(${s.id})">Delete</button>
        </div>
      </div>
    </div>`;
}

function cardClick(event, id) {
  if (event.target.closest('button, a')) return;
  location.href = `/session.html?id=${id}`;
}

async function load() {
  const url = currentFilter === 'all' ? '/api/sessions' : `/api/sessions?type=${currentFilter}`;
  const sessions = await fetch(url).then(r => r.json());
  const el = document.getElementById('sessions-list');
  if (sessions.length === 0) {
    el.innerHTML = `<div class="empty"><p>No sessions yet.</p><a href="/add-session.html" class="btn btn-primary">Add your first session</a></div>`;
  } else {
    el.innerHTML = sessions.map(renderCard).join('');
  }
}

async function regenerateSummary(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Generating…';
  const res = await fetch(`/api/sessions/${id}/regenerate-summary`, { method: 'POST' });
  if (res.ok) {
    const { ai_summary } = await res.json();
    btn.closest('.card').querySelector('.ai-summary, button[onclick^="regenerateSummary"]').outerHTML =
      `<div class="ai-summary" style="margin-top:.75rem;">${ai_summary.slice(0,200)}${ai_summary.length>200?'…':''}</div>`;
  } else {
    const { error } = await res.json();
    btn.textContent = '✨ Generate AI summary';
    btn.disabled = false;
    alert('Failed: ' + error);
  }
}

async function deleteSession(id) {
  if (!confirm('Delete this session?')) return;
  await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
  document.getElementById(`card-${id}`)?.remove();
  if (!document.querySelector('.card')) load(); // show empty state
}

document.querySelectorAll('.toggle-group button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-group button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    load();
  });
});

fetch('/api/config').then(r => r.json()).then(c => { aiEnabled = c.aiEnabled; load(); });
