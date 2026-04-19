const params = new URLSearchParams(location.search);
const editId = params.get('id');

let sessionType = 'round';
let scoreMode = 'vs100';
let rating = 0;
let venues = [];
let currentVenueHoles = [];

// --- Init ---
async function init() {
  // Set today's date
  document.getElementById('date').value = new Date().toISOString().slice(0, 10);

  // Load venues
  venues = await fetch('/api/venues').then(r => r.json());
  const sel = document.getElementById('venue');
  venues.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    sel.appendChild(opt);
  });

  if (editId) {
    document.getElementById('page-title').textContent = 'Edit Session';
    await loadEdit();
  }
}

async function loadEdit() {
  const session = await fetch(`/api/sessions/${editId}`).then(r => r.json());

  setType(session.type);
  document.getElementById('date').value = session.date;
  document.getElementById('note').value = session.note || '';
  setRating(session.rating);

  if (session.venue_id) {
    document.getElementById('venue').value = session.venue_id;
    await onVenueChange(session.venue_id, session.holes);
  } else if (session.venue_name) {
    document.getElementById('venue').value = '';
    document.getElementById('manual-venue-wrap').style.display = 'block';
    document.getElementById('venue-name').value = session.venue_name;
  }

  if (session.type === 'round') {
    document.getElementById('score').value = session.score || '';
    if (session.course_par != null) {
      setScoreMode('vspar');
      document.getElementById('course-par').value = session.course_par;
    }
  }
}

// --- Type toggle ---
function setType(type) {
  sessionType = type;
  document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('round-fields').style.display = type === 'round' ? '' : 'none';
  if (type === 'range') document.getElementById('hole-section').style.display = 'none';
}

document.querySelectorAll('[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    setType(btn.dataset.type);
    if (sessionType === 'round') {
      const vid = document.getElementById('venue').value;
      if (vid) onVenueChange(vid);
    }
  });
});

// --- Score mode toggle ---
function setScoreMode(mode) {
  scoreMode = mode;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('par-wrap').style.display = mode === 'vspar' ? '' : 'none';
}

document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => setScoreMode(btn.dataset.mode));
});

// --- Venue select ---
document.getElementById('venue').addEventListener('change', async (e) => {
  const id = e.target.value;
  document.getElementById('manual-venue-wrap').style.display = id ? 'none' : 'block';
  await onVenueChange(id);
});

async function onVenueChange(id, existingHoles = []) {
  currentVenueHoles = [];
  document.getElementById('hole-section').style.display = 'none';
  if (!id || sessionType !== 'round') return;

  const venue = await fetch(`/api/venues/${id}`).then(r => r.json());
  if (!venue.holes || venue.holes.length === 0) return;

  currentVenueHoles = venue.holes;

  // Auto-fill course par
  const totalPar = venue.holes.reduce((s, h) => s + h.par, 0);
  setScoreMode('vspar');
  document.getElementById('course-par').value = totalPar;

  // Build hole grid
  const grid = document.getElementById('hole-grid');
  grid.innerHTML = '';
  venue.holes.forEach(h => {
    const div = document.createElement('div');
    div.className = 'hole-cell';
    const existingHole = existingHoles.find(eh => eh.hole === h.hole);
    div.innerHTML = `
      <label>H${h.hole} (Par ${h.par})</label>
      <input type="number" min="1" max="20" data-hole="${h.hole}" data-par="${h.par}" value="${existingHole ? existingHole.strokes : ''}" placeholder="-">
    `;
    grid.appendChild(div);
  });

  document.getElementById('hole-section').style.display = '';
  updateHoleTotal();

  grid.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateHoleTotal));
}

function updateHoleTotal() {
  const inputs = document.querySelectorAll('#hole-grid input[data-hole]');
  let total = 0;
  inputs.forEach(inp => { if (inp.value) total += parseInt(inp.value); });
  document.getElementById('hole-total').textContent = total;
}

document.getElementById('apply-total').addEventListener('click', () => {
  const total = parseInt(document.getElementById('hole-total').textContent);
  if (total > 0) document.getElementById('score').value = total;
});

// --- Star rating ---
function setRating(val) {
  rating = val;
  document.getElementById('rating').value = val;
  document.querySelectorAll('#star-input span').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

document.querySelectorAll('#star-input span').forEach(s => {
  s.addEventListener('click', () => setRating(parseInt(s.dataset.val)));
  s.addEventListener('mouseover', () => {
    document.querySelectorAll('#star-input span').forEach(st => {
      st.classList.toggle('active', parseInt(st.dataset.val) <= parseInt(s.dataset.val));
    });
  });
  s.addEventListener('mouseout', () => setRating(rating));
});

// --- Form submit ---
document.getElementById('session-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const ratingVal = parseInt(document.getElementById('rating').value);
  if (!ratingVal) { alert('Please select a rating.'); return; }

  const venueId = document.getElementById('venue').value;
  const venueName = venueId
    ? venues.find(v => v.id == venueId)?.name
    : document.getElementById('venue-name').value.trim();

  const score = document.getElementById('score').value;
  const coursePar = scoreMode === 'vspar' ? document.getElementById('course-par').value : null;

  const holes = [];
  document.querySelectorAll('#hole-grid input[data-hole]').forEach(inp => {
    if (inp.value) holes.push({ hole: parseInt(inp.dataset.hole), strokes: parseInt(inp.value) });
  });

  const body = {
    type: sessionType,
    date: document.getElementById('date').value,
    venue_id: venueId ? parseInt(venueId) : null,
    venue_name: venueName || null,
    score: sessionType === 'round' && score ? parseInt(score) : null,
    course_par: sessionType === 'round' && coursePar ? parseInt(coursePar) : null,
    rating: ratingVal,
    note: document.getElementById('note').value.trim() || null,
    holes,
    regenerate_ai: editId ? true : undefined,
  };

  document.getElementById('save-btn').disabled = true;
  document.getElementById('saving-msg').style.display = 'inline';

  const url = editId ? `/api/sessions/${editId}` : '/api/sessions';
  const method = editId ? 'PUT' : 'POST';

  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.ok) {
    location.href = '/';
  } else {
    const err = await res.json();
    alert('Error: ' + (err.error || 'Unknown error'));
    document.getElementById('save-btn').disabled = false;
    document.getElementById('saving-msg').style.display = 'none';
  }
});

init();
