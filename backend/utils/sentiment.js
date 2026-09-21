const Sentiment = require('sentiment');
const analyzer = new Sentiment();

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ');
}

// Returns { score, label } from a raw comparative score, or nulls for empty text.
// This is intentionally isolated so a contributor can swap in a smarter
// model (e.g. an ML-based sentiment API) without touching route logic.
function analyzeSentiment(bodyHtml) {
  const text = stripHtml(bodyHtml).trim();
  if (!text) return { score: null, label: null };

  const result = analyzer.analyze(text);
  const comparative = result.comparative; // normalized by word count

  let label = 'neutral';
  if (comparative > 0.15) label = 'positive';
  else if (comparative < -0.15) label = 'negative';

  return { score: comparative, label };
}

module.exports = { analyzeSentiment };
