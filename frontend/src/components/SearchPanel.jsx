import { useEffect, useState } from 'react';
import api from '../api/client';
import { MOODS, moodEmoji } from './MoodPicker';

function plainText(html = '') {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
}

function makeSnippet(html, query) {
  const text = plainText(html);
  if (!text) return '';
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const lowerText = text.toLocaleLowerCase();
  const positions = terms.map((term) => lowerText.indexOf(term.toLocaleLowerCase())).filter((position) => position >= 0);
  if (positions.length === 0) return `${text.slice(0, 170)}${text.length > 170 ? '…' : ''}`;
  const start = Math.max(0, Math.min(...positions) - 48);
  const snippet = text.slice(start, start + 170);
  return `${start > 0 ? '…' : ''}${snippet}${start + 170 < text.length ? '…' : ''}`;
}

function highlight(text, query) {
  const terms = [...new Set(query.trim().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!terms.length) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`(${escaped.join('|')})`, 'ig');
  return text.split(expression).map((part, index) => (
    terms.some((term) => term.toLocaleLowerCase() === part.toLocaleLowerCase())
      ? <mark key={index}>{part}</mark>
      : part
  ));
}

export default function SearchPanel({ onSelectDate }) {
  const [q, setQ] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = q.trim();
    const hasFilters = Boolean(query || mood || tag.trim());
    if (!hasFilters) {
      setResults(null);
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/entries/search', {
          params: {
            q: query || undefined,
            mood: mood || undefined,
            tag: tag.trim() || undefined
          },
          signal: controller.signal
        });
        setResults(res.data.entries);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setError('Search could not be completed. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 300 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q, mood, tag]);

  function handleSearch(e) {
    e.preventDefault();
  }

  function clearSearch() {
    setQ('');
    setMood('');
    setTag('');
    setResults(null);
    setError('');
  }

  return (
    <div className="search-panel">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search entry text, titles, tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search journal entries"
        />
        <div className="search-filters">
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">Any mood</option>
            {MOODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label="Filter by tag"
          />
        </div>
        <div className="search-actions">
          <span className="search-status" aria-live="polite">
            {loading ? 'Searching…' : results ? `${results.length} results` : 'Searches titles, journal text & tags'}
          </span>
          <button type="button" onClick={clearSearch} disabled={!q && !mood && !tag}>
            Clear
          </button>
        </div>
      </form>

      {error && <p className="search-error" role="alert">{error}</p>}
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="no-results">No entries found.</li>}
          {results.map((entry) => (
                <li key={entry.date} onClick={() => onSelectDate(entry.date)}>
                  <span className="result-date">{entry.date}</span>
                  {entry.mood && <span>{moodEmoji(entry.mood)}</span>}
                  <span className="search-result-copy">
                    <span className="result-title">{entry.title || '(untitled)'}</span>
                    {q.trim() && entry.body && <span className="result-snippet">{highlight(makeSnippet(entry.body, q), q)}</span>}
                    {entry.tags?.length > 0 && <span className="result-tags">{entry.tags.map((item) => `#${item}`).join(' ')}</span>}
                  </span>
                </li>
          ))}
        </ul>
      )}
    </div>
  );
}
