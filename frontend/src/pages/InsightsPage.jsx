import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import api from '../api/client';

const MOOD_COLORS = {
  great: '#22c55e',
  good: '#84cc16',
  okay: '#eab308',
  bad: '#f97316',
  terrible: '#ef4444'
};

export default function InsightsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/entries/analytics').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="centered">Loading insights…</div>;

  const moodData = Object.entries(data.moodCounts)
    .filter(([, count]) => count > 0)
    .map(([mood, count]) => ({ name: mood, value: count }));

  const sentimentData = data.sentimentTrend.map((d) => ({
    date: d.date.slice(5), // MM-DD for a cleaner axis
    score: Number(d.score.toFixed(2))
  }));

  return (
    <div className="insights-page">
      <header>
        <h1>Insights</h1>
        <Link to="/">← Back to journal</Link>
      </header>

      <p className="insights-summary">{data.totalEntries} entries analyzed.</p>

      <div className="insights-grid">
        <div className="insights-card">
          <h2>Mood distribution</h2>
          {moodData.length === 0 ? (
            <p>Not enough mood data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={moodData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {moodData.map((entry) => (
                    <Cell key={entry.name} fill={MOOD_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="insights-card">
          <h2>Sentiment over time</h2>
          <p className="insights-note">
            Auto-computed from entry text (not the mood you pick) — positive above 0, negative
            below.
          </p>
          {sentimentData.length === 0 ? (
            <p>Not enough entries yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[-1, 1]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#4f46e5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
