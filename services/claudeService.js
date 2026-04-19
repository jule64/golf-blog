import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateSessionSummary(session, venue, holes, scorecard) {
  const parMap = Object.fromEntries((scorecard || []).map(h => [h.hole, h]));
  const vsPar = session.course_par != null && session.score != null
    ? session.score - session.course_par
    : null;

  let venueInfo = '';
  if (venue) {
    const totalPar = scorecard?.reduce((s, h) => s + h.par, 0) || session.course_par;
    const totalYards = scorecard?.reduce((s, h) => s + (h.yards || 0), 0);
    venueInfo = `Venue: ${venue.name}${totalPar ? ` (Par ${totalPar}` : ''}${totalYards ? `, ${totalYards} yards)` : totalPar ? ')' : ''}`;
  } else if (session.venue_name) {
    venueInfo = `Venue: ${session.venue_name}${session.course_par ? ` (Par ${session.course_par})` : ''}`;
  }

  let scoreInfo = '';
  if (session.type === 'round' && session.score != null) {
    scoreInfo = `Score: ${session.score}`;
    if (vsPar != null) scoreInfo += ` (${vsPar >= 0 ? '+' : ''}${vsPar} vs par)`;
    else scoreInfo += ` (${session.score - 100 >= 0 ? '+' : ''}${session.score - 100} vs 100)`;
  }

  let holeBreakdown = '';
  if (holes && holes.length > 0) {
    const rows = holes.map(h => {
      const sc = parMap[h.hole];
      const diff = sc ? h.strokes - sc.par : null;
      return `  Hole ${h.hole}${sc ? ` (Par ${sc.par}, ${sc.yards || '?'}yds, SI ${sc.si || '?'})` : ''}: ${h.strokes} strokes${diff != null ? ` (${diff >= 0 ? '+' : ''}${diff})` : ''}`;
    });
    holeBreakdown = '\n\nHole breakdown:\n' + rows.join('\n');
  }

  const systemPrompt = `You are ghostwriting a personal golf blog entry. Write in first person as if the golfer is writing it themselves — natural, honest, conversational. Use the session data and notes as the raw material. Bring the round to life: how it felt, what happened, the highs and lows. Plain prose only — no bullet points, no headers. 2-3 paragraphs.`;

  const userPrompt = `Write a first-person blog entry for this golf session. Use my notes and the data below as the basis — expand on them naturally, don't just restate them.

Session type: ${session.type}
Date: ${session.date}
${venueInfo}
${scoreInfo}
My rating: ${session.rating}/5
My notes: "${session.note || 'None'}"${holeBreakdown}`;

  const messages = [{ role: 'user', content: userPrompt }];

  // Cache the system prompt to save tokens on repeated calls
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  return response.content[0].text;
}
