import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { MOODS, moodEmoji } from '../components/MoodPicker';

export default function PhotoGalleryPage() {
  const [photos, setPhotos] = useState([]);
  const [year, setYear] = useState('all');
  const [mood, setMood] = useState('all');
  const [tag, setTag] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/entries/photos')
      .then((res) => setPhotos(res.data.photos || []))
      .catch(() => setError('Could not load your photos. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => [...new Set(photos.map((photo) => photo.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [photos]);
  const tags = useMemo(() => [...new Set(photos.flatMap((photo) => photo.tags || []))].sort((a, b) => a.localeCompare(b)), [photos]);
  const filteredPhotos = useMemo(() => photos.filter((photo) =>
    (year === 'all' || photo.date.startsWith(`${year}-`)) &&
    (mood === 'all' || photo.mood === mood) &&
    (tag === 'all' || photo.tags?.includes(tag))
  ), [photos, year, mood, tag]);

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <div><span className="insights-eyebrow">YOUR JOURNAL IN PICTURES</span><h1>Photo memories</h1><p>Browse photos independently, then jump back to the entry they came from.</p></div>
        <Link to="/">← Back to journal</Link>
      </header>

      <section className="gallery-toolbar" aria-label="Filter photos">
        <label>Year<select value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Mood<select value={mood} onChange={(event) => setMood(event.target.value)}><option value="all">Any mood</option>{MOODS.map((item) => <option key={item.value} value={item.value}>{item.emoji} {item.label}</option>)}</select></label>
        <label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">Any tag</option>{tags.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <span className="gallery-count">{filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}</span>
      </section>

      {loading ? <p className="gallery-message">Gathering your photo memories…</p> : error ? <p className="gallery-message gallery-error">{error}</p> : filteredPhotos.length === 0 ? (
        <div className="gallery-empty"><span aria-hidden="true">✧</span><h2>{photos.length ? 'No photos match these filters' : 'Your photo memories will appear here'}</h2><p>{photos.length ? 'Try another year, mood, or tag.' : 'Add photos to a journal entry to start your gallery.'}</p></div>
      ) : (
        <div className="photo-masonry">
          {filteredPhotos.map((photo) => (
            <button className="memory-photo-card" type="button" key={photo.id || `${photo.date}-${photo.url}`} onClick={() => navigate(`/?date=${photo.date}`)} aria-label={`Open journal entry for ${photo.date}`}>
              <img src={photo.url} alt={photo.caption || photo.title || `Journal photo from ${photo.date}`} loading="lazy" />
              <span className="memory-photo-meta">
                <span className="memory-photo-date">{moodEmoji(photo.mood)} {new Date(`${photo.date}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                {(photo.caption || photo.title) && <strong>{photo.caption || photo.title}</strong>}
                {photo.tags?.length > 0 && <span className="memory-photo-tags">{photo.tags.slice(0, 3).map((item) => <i key={item}>{item}</i>)}</span>}
                <span className="memory-photo-open">Open journal entry ↗</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
