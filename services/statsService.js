export function calcVsPar(score, course_par) {
  if (score == null) return null;
  if (course_par != null) return score - course_par;
  return score - 100;
}

export function calcSummary(sessions) {
  const rounds = sessions.filter(s => s.type === 'round' && s.score != null);
  if (rounds.length === 0) {
    return { rounds_played: 0, range_sessions: sessions.filter(s => s.type === 'range').length, total_rounds: sessions.filter(s => s.type === 'round').length, total_range: sessions.filter(s => s.type === 'range').length, best_score: null, avg_score: null, avg_vs_par: null, trend: null };
  }

  const scores = rounds.map(s => s.score);
  const vsParVals = rounds.map(s => calcVsPar(s.score, s.course_par)).filter(v => v != null);

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  // Trend: compare last 5 vs previous 5
  let trend = null;
  if (rounds.length >= 2) {
    const last5 = rounds.slice(0, Math.min(5, rounds.length)).map(s => s.score);
    const prev5 = rounds.slice(Math.min(5, rounds.length), Math.min(10, rounds.length)).map(s => s.score);
    if (prev5.length > 0) {
      const delta = avg(last5) - avg(prev5);
      trend = { direction: delta < 0 ? 'improving' : delta > 0 ? 'declining' : 'stable', delta: Math.round(delta * 10) / 10 };
    }
  }

  return {
    rounds_played: rounds.length,
    range_sessions: sessions.filter(s => s.type === 'range').length,
    total_rounds: sessions.filter(s => s.type === 'round').length,
    total_range: sessions.filter(s => s.type === 'range').length,
    best_score: Math.min(...scores),
    avg_score: Math.round(avg(scores) * 10) / 10,
    avg_vs_par: vsParVals.length ? Math.round(avg(vsParVals) * 10) / 10 : null,
    trend,
  };
}

export function calcChartData(sessions, mode = 'score') {
  const rounds = sessions
    .filter(s => s.type === 'round' && s.score != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const labels = rounds.map(s => s.date);
  let data;

  if (mode === 'vspar') {
    data = rounds.map(s => s.course_par != null ? s.score - s.course_par : null);
  } else if (mode === 'vs100') {
    data = rounds.map(s => s.score - 100);
  } else {
    data = rounds.map(s => s.score);
  }

  return { labels, data };
}
