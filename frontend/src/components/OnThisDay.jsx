import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { moodEmoji } from './MoodPicker';

export default function OnThisDay({ date, onOpenEntry }) {
  const [memories, setMemories] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get('/entries/on-this-day', { params: { date } })
      .then((res) => {
        if (!cancelled) {
          setMemories(res.data.entries || []);
          setIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load memories for this date.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  const memory = memories[index];
  const yearsAgo = memory ? Number(date.slice(0, 4)) - Number(memory.date.slice(0, 4)) : 0;
  const formattedDate = useMemo(() => {
    if (!memory) return '';
    return new Date(`${memory.date}T12:00:00`).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }, [memory]);

  return (
    <section className="memory-timeline" aria-labelledby="memory-heading">
      <div className="memory-heading-row">
        <div>
          <span className="memory-eyebrow">A LITTLE TIME TRAVEL</span>
          <h2 id="memory-heading">On this day</h2>
          <p>Moments you saved on this date in earlier years.</p>
        </div>
        {memories.length > 1 && (
          <div className="memory-navigation" aria-label="Browse memories by year">
            <button type="button" onClick={() => setIndex((n) => Math.min(n + 1, memories.length - 1))} disabled={index >= memories.length - 1} aria-label="Show an older memory">←</button>
            <span>{index + 1} of {memories.length}</span>
            <button type="button" onClick={() => setIndex((n) => Math.max(n - 1, 0))} disabled={index === 0} aria-label="Show a newer memory">→</button>
          </div>
        )}
      </div>

      {loading ? <p className="memory-empty">Finding memories…</p> : error ? <p className="memory-empty">{error}</p> : !memory ? (
        <div className="memory-empty"><span aria-hidden="true">✦</span><strong>No memories from this date yet</strong><span>As the years pass, your entries will show up here.</span></div>
      ) : (
        <article className="memory-card">
          <div className="memory-copy">
            <div className="memory-date-line">{moodEmoji(memory.mood)} <strong>{yearsAgo === 1 ? 'On this day last year…' : `On this day in ${memory.date.slice(0, 4)}…`}</strong></div>
            <time dateTime={memory.date}>{formattedDate}</time>
            {memory.title && <h3>{memory.title}</h3>}
            {memory.body && <p className="memory-excerpt">{memory.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 260)}{memory.body.replace(/<[^>]*>/g, ' ').trim().length > 260 ? '…' : ''}</p>}
            {!memory.title && !memory.body && <p className="memory-excerpt">A saved moment from your journal.</p>}
            <button type="button" className="memory-open" onClick={() => onOpenEntry(memory.date)}>Open this entry</button>
          </div>
          {memory.images?.length > 0 && (
            <div className="memory-photos" aria-label={`${memory.images.length} photos from this memory`}>
              {memory.images.slice(0, 3).map((image) => <img key={image._id || image.url} src={image.url} alt={image.caption || `Photo from ${formattedDate}`} loading="lazy" />)}
              {memory.images.length > 3 && <span>+{memory.images.length - 3}</span>}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
