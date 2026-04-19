let venues = [];
let selectedVenueId = null;

async function loadVenues() {
  venues = await fetch('/api/venues').then(r => r.json());
  renderVenueList();
}

function renderVenueList() {
  const ul = document.getElementById('venue-list');
  const noVenues = document.getElementById('no-venues');
  ul.innerHTML = '';
  noVenues.style.display = venues.length === 0 ? '' : 'none';

  venues.forEach(v => {
    const li = document.createElement('li');
    li.className = v.id === selectedVenueId ? 'selected' : '';
    li.innerHTML = `
      <span>${v.name}</span>
      <button class="btn btn-sm btn-danger del-btn" onclick="deleteVenue(event,${v.id})">✕</button>
    `;
    li.addEventListener('click', () => selectVenue(v.id));
    ul.appendChild(li);
  });
}

async function selectVenue(id) {
  selectedVenueId = id;
  renderVenueList();

  const venue = await fetch(`/api/venues/${id}`).then(r => r.json());
  document.getElementById('venue-title').textContent = venue.name;

  if (venue.markdown_file) {
    document.getElementById('markdown-link-wrap').innerHTML =
      `<span style="font-size:.75rem;color:var(--gray-400);">📄 ${venue.markdown_file}</span>`;
  } else {
    document.getElementById('markdown-link-wrap').innerHTML = '';
  }

  renderScorecardTable(venue.holes || []);
  document.getElementById('scorecard-panel').style.display = '';
  document.getElementById('empty-panel').style.display = 'none';
}

function renderScorecardTable(holes) {
  const tbody = document.getElementById('scorecard-body');
  tbody.innerHTML = '';

  for (let i = 1; i <= 18; i++) {
    const h = holes.find(x => x.hole === i) || { hole: i, yards: '', par: 4, si: '' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${i}</strong></td>
      <td><input type="number" min="0" max="700" value="${h.yards ?? ''}" data-field="yards" data-hole="${i}" placeholder="—"></td>
      <td><input type="number" min="3" max="6" value="${h.par ?? 4}" data-field="par" data-hole="${i}"></td>
      <td><input type="number" min="1" max="18" value="${h.si ?? ''}" data-field="si" data-hole="${i}" placeholder="—"></td>
    `;
    tbody.appendChild(tr);
  }

  updateTotals();
  tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateTotals));
}

function getHoleValues() {
  return Array.from({ length: 18 }, (_, i) => {
    const hole = i + 1;
    const yards = parseInt(document.querySelector(`[data-field="yards"][data-hole="${hole}"]`)?.value) || 0;
    const par = parseInt(document.querySelector(`[data-field="par"][data-hole="${hole}"]`)?.value) || 0;
    const si = parseInt(document.querySelector(`[data-field="si"][data-hole="${hole}"]`)?.value) || null;
    return { hole, yards: yards || null, par, si };
  });
}

function updateTotals() {
  const vals = getHoleValues();
  const front9 = vals.slice(0, 9);
  const back9 = vals.slice(9, 18);
  const sum = (arr, f) => arr.reduce((s, h) => s + (h[f] || 0), 0);

  document.getElementById('out-yards').textContent = sum(front9, 'yards') || '—';
  document.getElementById('out-par').textContent = sum(front9, 'par') || '—';
  document.getElementById('in-yards').textContent = sum(back9, 'yards') || '—';
  document.getElementById('in-par').textContent = sum(back9, 'par') || '—';
  const totalYards = sum(vals, 'yards');
  const totalPar = sum(vals, 'par');
  document.getElementById('total-yards').innerHTML = `<strong>${totalYards || '—'}</strong>`;
  document.getElementById('total-par').innerHTML = `<strong>${totalPar || '—'}</strong>`;
  document.getElementById('par-total-label').textContent = totalPar ? `Par ${totalPar}` : '';
}

document.getElementById('save-scorecard-btn').addEventListener('click', async () => {
  if (!selectedVenueId) return;
  const holes = getHoleValues().filter(h => h.par > 0);
  const res = await fetch(`/api/venues/${selectedVenueId}/holes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ holes }),
  });
  if (res.ok) {
    const venue = await res.json();
    if (venue.markdown_file) {
      document.getElementById('markdown-link-wrap').innerHTML =
        `<span style="font-size:.75rem;color:var(--gray-400);">📄 ${venue.markdown_file}</span>`;
    }
    const status = document.getElementById('save-status');
    status.style.display = 'inline';
    setTimeout(() => { status.style.display = 'none'; }, 2500);
    // Refresh venue list (markdown_file updated)
    venues = await fetch('/api/venues').then(r => r.json());
    renderVenueList();
  } else {
    alert('Save failed');
  }
});

document.getElementById('add-venue-btn').addEventListener('click', async () => {
  const name = prompt('Venue name:');
  if (!name?.trim()) return;
  const res = await fetch('/api/venues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (res.ok) {
    const venue = await res.json();
    await loadVenues();
    selectVenue(venue.id);
  } else {
    const err = await res.json();
    alert(err.error || 'Error creating venue');
  }
});

async function deleteVenue(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this venue and its scorecard?')) return;
  await fetch(`/api/venues/${id}`, { method: 'DELETE' });
  if (selectedVenueId === id) {
    selectedVenueId = null;
    document.getElementById('scorecard-panel').style.display = 'none';
    document.getElementById('empty-panel').style.display = '';
  }
  await loadVenues();
}

loadVenues();
