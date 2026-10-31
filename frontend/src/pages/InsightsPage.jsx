import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import api from '../api/client';
import { MOODS, moodEmoji } from '../components/MoodPicker';

const MOOD_COLORS = {
  great: '#22c55e', good: '#84cc16', okay: '#eab308', bad: '#f97316', terrible: '#ef4444',
  excited: '#06b6d4', grateful: '#ec4899', calm: '#14b8a6', anxious: '#8b5cf6',
  tired: '#64748b', overwhelmed: '#a855f7', angry: '#dc2626', hopeful: '#10b981'
};
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function monthLabel(year, month, options = { month: 'long', year: 'numeric' }) {
  return new Date(year, month, 1).toLocaleDateString(undefined, options);
}

export default function InsightsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [heatmapMonth, setHeatmapMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    api.get('/entries/analytics')
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load your insights. Please try again.'));
  }, []);

  const entries = data?.entries || [];
  const moodData = Object.entries(data?.moodCounts || {})
    .filter(([, count]) => count > 0)
    .map(([mood, count]) => ({ name: mood, value: count }));

  const sentimentData = (data?.sentimentTrend || []).map((d) => ({
    date: d.date.slice(5), score: Number(d.score.toFixed(2))
  }));

  const monthMoodData = useMemo(() => {
    const byMonth = new Map();
    entries.forEach((entry) => {
      const [year, month] = entry.date.split('-').map(Number);
      const key = monthKey(year, month - 1);
      if (!byMonth.has(key)) byMonth.set(key, { key, label: monthLabel(year, month - 1, { month: 'short' }) });
      if (entry.mood) byMonth.get(key)[entry.mood] = (byMonth.get(key)[entry.mood] || 0) + 1;
    });
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = monthKey(date.getFullYear(), date.getMonth());
      return byMonth.get(key) || { key, label: monthLabel(date.getFullYear(), date.getMonth(), { month: 'short' }) };
    });
  }, [entries]);

  const trendMoods = useMemo(() => {
    const counts = {};
    entries.forEach(({ mood }) => { if (mood) counts[mood] = (counts[mood] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 4);
  }, [entries]);

  const tags = useMemo(() => {
    const counts = new Map();
    entries.forEach((entry) => (entry.tags || []).forEach((tag) => {
      const clean = tag.trim();
      if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
    }));
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [entries]);

  const heatmap = useMemo(() => {
    const { year, month } = heatmapMonth;
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const byDate = new Map(entries.map((entry) => [entry.date, entry]));
    const leading = (first.getDay() + 6) % 7;
    return [
      ...Array.from({ length: leading }, (_, i) => ({ key: `blank-${i}`, blank: true })),
      ...Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = byDate.get(date);
        return { key: date, day, date, entry };
      })
    ];
  }, [entries, heatmapMonth]);

  function shiftHeatmapMonth(delta) {
    setHeatmapMonth(({ year, month }) => {
      const date = new Date(year, month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  if (error) return <div className="centered">{error}</div>;
  if (!data) return <div className="centered">Loading insights…</div>;

  return (
    <div className="insights-page">
      <header><div><span className="insights-eyebrow">YOUR JOURNAL, IN PERSPECTIVE</span><h1>Insights</h1></div><Link to="/">← Back to journal</Link></header>
      <p className="insights-summary">{data.totalEntries} entries analyzed. Patterns can make it easier to notice what shapes your days.</p>

      <section className="insights-card heatmap-card">
        <div className="insights-section-heading">
          <div><h2>Monthly mood map</h2><p className="insights-note">Each day is colored by the mood you recorded.</p></div>
          <div className="heatmap-controls"><button type="button" onClick={() => shiftHeatmapMonth(-1)} aria-label="Previous month">←</button><strong>{monthLabel(heatmapMonth.year, heatmapMonth.month)}</strong><button type="button" onClick={() => shiftHeatmapMonth(1)} aria-label="Next month">→</button></div>
        </div>
        <div className="mood-heatmap" role="grid" aria-label={`Mood map for ${monthLabel(heatmapMonth.year, heatmapMonth.month)}`}>
          {WEEKDAYS.map((day) => <span className="heatmap-weekday" key={day}>{day}</span>)}
          {heatmap.map((cell) => cell.blank ? <span className="heatmap-blank" key={cell.key} /> : (
            <div key={cell.key} className={`heatmap-day ${cell.entry ? 'has-entry' : ''}`} style={cell.entry?.mood ? { backgroundColor: `color-mix(in srgb, ${MOOD_COLORS[cell.entry.mood] || '#94a3b8'} 22%, var(--card-bg))` } : undefined} role="gridcell" title={cell.entry ? `${cell.date}: ${cell.entry.mood || 'entry without mood'}` : cell.date}>
              <span>{cell.day}</span>{cell.entry?.mood && <b aria-label={cell.entry.mood}>{moodEmoji(cell.entry.mood)}</b>}
            </div>
          ))}
        </div>
        <div className="heatmap-legend">{MOODS.filter((mood) => moodData.some((item) => item.name === mood.value)).map((mood) => <span key={mood.value}><i style={{ background: MOOD_COLORS[mood.value] }} />{mood.label}</span>)}</div>
      </section>

      <div className="insights-grid">
        <section className="insights-card">
          <h2>Mood distribution</h2>
          {moodData.length === 0 ? <p>Not enough mood data yet.</p> : <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={moodData} dataKey="value" nameKey="name" outerRadius={90} label>{moodData.map((entry) => <Cell key={entry.name} fill={MOOD_COLORS[entry.name] || '#94a3b8'} />)}</Pie><Tooltip /><Legend formatter={(value) => `${moodEmoji(value)} ${value}`} /></PieChart></ResponsiveContainer>}
        </section>
        <section className="insights-card">
          <h2>Most-used tags</h2>
          {tags.length === 0 ? <p>Add tags to entries to discover recurring themes.</p> : <div className="theme-tag-list">{tags.map((tag) => <span className="theme-tag" key={tag.name}><b>{tag.name}</b><small>{tag.count} {tag.count === 1 ? 'entry' : 'entries'}</small></span>)}</div>}
        </section>
      </div>

      <section className="insights-card mood-trends-card">
        <h2>Mood patterns across months</h2>
        <p className="insights-note">Compare your most recorded moods over the last six months.</p>
        {trendMoods.length === 0 ? <p>Record a mood to start seeing monthly patterns.</p> : <ResponsiveContainer width="100%" height={300}><BarChart data={monthMoodData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Legend formatter={(value) => `${moodEmoji(value)} ${value}`} />{trendMoods.map((mood) => <Bar key={mood} dataKey={mood} stackId="moods" fill={MOOD_COLORS[mood]} radius={[3, 3, 0, 0]} />)}</BarChart></ResponsiveContainer>}
      </section>

      <section className="insights-card sentiment-card">
        <h2>Sentiment over time</h2>
        <p className="insights-note">Estimated from entry text: above 0 is positive, below 0 is negative.</p>
        {sentimentData.length === 0 ? <p>Not enough entries yet.</p> : <ResponsiveContainer width="100%" height={260}><LineChart data={sentimentData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" /><YAxis domain={[-1, 1]} /><Tooltip /><Line type="monotone" dataKey="score" name="Sentiment" stroke="#4f46e5" dot={false} /></LineChart></ResponsiveContainer>}
      </section>
    </div>
  );
}
