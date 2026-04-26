let chartMode = 'score';
let chart = null;

async function loadSummary() {
  const s = await fetch('/api/stats/summary').then(r => r.json());

  document.getElementById('stat-rounds').textContent = s.total_rounds ?? '—';
  document.getElementById('stat-range').textContent = s.range_sessions ?? '—';
  document.getElementById('stat-best').textContent = s.best_score ?? '—';
  document.getElementById('stat-avg').textContent = s.avg_score ?? '—';

  const vp = s.avg_vs_par;
  const vpEl = document.getElementById('stat-vspar');
  if (vp != null) {
    vpEl.textContent = (vp >= 0 ? '+' : '') + vp;
    vpEl.style.color = vp <= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    vpEl.textContent = '—';
  }

  const trendEl = document.getElementById('stat-trend');
  const trendSub = document.getElementById('stat-trend-sub');
  if (s.trend) {
    const icons = { improving: '↗', declining: '↘', stable: '→' };
    const cls = { improving: 'trend-improving', declining: 'trend-declining', stable: '' };
    trendEl.textContent = icons[s.trend.direction];
    trendEl.className = `value ${cls[s.trend.direction]}`;
    const delta = s.trend.delta;
    trendSub.textContent = `${delta >= 0 ? '+' : ''}${delta} strokes (last 5 vs prev 5)`;
  } else {
    trendEl.textContent = '—';
  }
}

async function loadChart() {
  const data = await fetch(`/api/stats/chart?mode=${chartMode}&type=round`).then(r => r.json());

  const ctx = document.getElementById('progress-chart');
  const empty = document.getElementById('chart-empty');

  if (!data.labels || data.labels.length < 2) {
    ctx.style.display = 'none';
    empty.style.display = '';
    return;
  }

  ctx.style.display = '';
  empty.style.display = 'none';

  const labels = {
    score: 'Score',
    vspar: 'vs Par',
    vs100: 'vs 100',
  };

  const color = chartMode === 'score' ? '#2d6a4f' : '#2563eb';

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: labels[chartMode],
        data: data.data,
        borderColor: color,
        backgroundColor: color + '18',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              if (chartMode === 'score') return `Score: ${val}`;
              return (val >= 0 ? '+' : '') + val;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          reverse: chartMode === 'score',
          grid: { color: '#e5e7eb' },
          ticks: {
            callback: v => chartMode === 'score' ? v : (v >= 0 ? '+' : '') + v,
          },
        },
      },
    },
  });
}

document.querySelectorAll('[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    chartMode = btn.dataset.mode;
    loadChart();
  });
});

loadSummary();
loadChart();
