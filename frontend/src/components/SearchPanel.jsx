import { useState } from 'react';
import api from '../api/client';
import { moodEmoji } from './MoodPicker';

export default function SearchPanel({ onSelectDate }) {
  const [q, setQ] = useState('');
  const [mood, setMood] = useState('');
  const [tag, setTag] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.get('/entries/search', {
        params: {
          q: q || undefined,
          mood: mood || undefined,
          tag: tag || undefined
        }
      });
      setResults(res.data.entries);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-panel">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search entries…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="search-filters">
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">Any mood</option>
            <option value="great">Great</option>
            <option value="good">Good</option>
            <option value="okay">Okay</option>
            <option value="bad">Bad</option>
            <option value="terrible">Terrible</option>
          </select>
          <input
            type="text"
            placeholder="Tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="no-results">No entries found.</li>}
          {results.map((entry) => (
            <li key={entry.date} onClick={() => onSelectDate(entry.date)}>
              <span className="result-date">{entry.date}</span>
              {entry.mood && <span>{moodEmoji(entry.mood)}</span>}
              <span className="result-title">{entry.title || '(untitled)'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
