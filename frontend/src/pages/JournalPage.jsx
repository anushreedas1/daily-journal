import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CalendarView from '../components/CalendarView';
import RichTextEditor from '../components/RichTextEditor';
import MoodPicker from '../components/MoodPicker';
import TagInput from '../components/TagInput';
import StreakBadge from '../components/StreakBadge';
import SearchPanel from '../components/SearchPanel';
import { exportEntriesToPdf } from '../components/ExportPdfButton';
import OnThisDay from '../components/OnThisDay';
import GoalsPanel from '../components/GoalsPanel';
import {
  cacheServerEntry,
  getCachedEntry,
  getMonthEntries,
  getMonthSummary,
  getPendingDrafts,
  keepLocalDraft,
  markDraftConflict,
  markDraftSynced,
  saveLocalDraft,
  saveMonthSummary,
  useRemoteEntry
} from '../offlineJournal';

function todayKey() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function QueuedPhotoPreview({ file, onRemove }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="queued-photo">
      {previewUrl && <img src={previewUrl} alt={`Preview of ${file.name}`} />}
      <button type="button" className="queued-photo-remove" onClick={onRemove} aria-label={`Remove ${file.name}`}>×</button>
      <span title={file.name}>{file.name}</span>
    </div>
  );
}

export default function JournalPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchParams] = useSearchParams();

  const now = new Date();
  const linkedDate = searchParams.get('date');
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(linkedDate || '') ? new Date(`${linkedDate}T12:00:00`) : now;

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth() + 1);

  const [entriesByDate, setEntriesByDate] = useState({});

  const [selectedDate, setSelectedDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(linkedDate || '') ? linkedDate : todayKey());
  const [journalPanel, setJournalPanel] = useState(null);
  const journalPanelRef = useRef(null);

  useEffect(() => {
    if (journalPanel) journalPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [journalPanel]);

  useEffect(() => {
    const date = searchParams.get('date');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSelectedDate(date);
    const parsed = new Date(`${date}T12:00:00`);
    setYear(parsed.getFullYear());
    setMonth(parsed.getMonth() + 1);
  }, [searchParams]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mood, setMood] = useState(null);
  const [tags, setTags] = useState([]);

  // --------------------------------------------------
  // Multiple image state
  // --------------------------------------------------

  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);

  const [status, setStatus] = useState('idle');
  const [loadedDate, setLoadedDate] = useState(null);
  const [draftStatus, setDraftStatus] = useState('idle');
  const lastSavedDraftRef = useRef(null);
  const hasEntryRef = useRef(false);
  const autosaveTimerRef = useRef(null);
  const [imageStatus, setImageStatus] = useState('idle');
  const [imageError, setImageError] = useState('');
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [syncConflict, setSyncConflict] = useState(null);
  const syncLockRef = useRef(false);

  // Caption saving state
  const [captionStatus, setCaptionStatus] = useState(null);

  // --------------------------------------------------
  // Load month's calendar summary
  // --------------------------------------------------

  const loadSummary = useCallback(async (y, m) => {
    const showCachedSummary = async () => {
      if (!user?._id) return;
      try {
        const map = { ...(await getMonthSummary(user._id, y, m)) };
        const localEntries = await getMonthEntries(user._id, y, m);
        Object.entries(localEntries).forEach(([date, record]) => {
          if (record.pending || !map[date]) {
            map[date] = {
              title: record.data.title,
              mood: record.data.mood,
              images: record.images || []
            };
          }
        });
        setEntriesByDate(map);
      } catch (err) {
        console.error('Could not load offline journal summary:', err);
      }
    };

    if (!navigator.onLine) {
      await showCachedSummary();
      return;
    }

    try {
      const res = await api.get('/entries/summary', {
        params: { year: y, month: m },
        timeout: 12000
      });
      const map = {};
      res.data.entries.forEach((entry) => {
        map[entry.date] = {
          mood: entry.mood,
          title: entry.title,
          images: entry.images || []
        };
      });
      setIsOffline(false);
      if (user?._id) await saveMonthSummary(user._id, y, m, map);
      const localEntries = user?._id ? await getMonthEntries(user._id, y, m) : {};
      Object.entries(localEntries).forEach(([date, record]) => {
        if (record.pending) {
          map[date] = { title: record.data.title, mood: record.data.mood, images: record.images || [] };
        }
      });
      setEntriesByDate(map);
    } catch (err) {
      if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
      console.error('Could not load journal summary:', err);
      await showCachedSummary();
    }
  }, [user]);

  const syncPendingDrafts = useCallback(async () => {
    if (!user?._id || !navigator.onLine || syncLockRef.current) return;
    syncLockRef.current = true;
    let changed = false;

    try {
      const pending = await getPendingDrafts(user._id);
      for (const record of pending) {
        if (!navigator.onLine) break;

        let remoteEntry = null;
        try {
          const remoteResponse = await api.get(`/entries/${record.date}`, { timeout: 12000 });
          remoteEntry = remoteResponse.data.entry;
        } catch (err) {
          if (err.response?.status !== 404) {
            if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
            break;
          }
        }

        const remoteUpdatedAt = remoteEntry?.updatedAt || null;
        const remoteMatchesDraft = remoteEntry && JSON.stringify({
          title: remoteEntry.title || '',
          body: remoteEntry.body || '',
          mood: remoteEntry.mood || null,
          tags: remoteEntry.tags || []
        }) === JSON.stringify(record.data);

        if (remoteUpdatedAt !== (record.baseUpdatedAt || null) && !remoteMatchesDraft) {
          await markDraftConflict(user._id, record.date, remoteEntry);
          if (selectedDate === record.date) {
            setSyncConflict({ date: record.date, remote: remoteEntry || { date: record.date, missing: true } });
            setDraftStatus('conflict');
          }
          continue;
        }

        if (remoteMatchesDraft) {
          await markDraftSynced(user._id, record.date, record.data, remoteEntry);
          changed = true;
          if (selectedDate === record.date) {
            lastSavedDraftRef.current = JSON.stringify(record.data);
            hasEntryRef.current = true;
            setDraftStatus('saved');
          }
          continue;
        }

        try {
          const response = await api.put(`/entries/${record.date}`, record.data, { timeout: 12000 });
          await markDraftSynced(user._id, record.date, record.data, response.data.entry);
          changed = true;
          if (selectedDate === record.date) {
            lastSavedDraftRef.current = JSON.stringify(record.data);
            hasEntryRef.current = true;
            setDraftStatus('saved');
          }
          setIsOffline(false);
          window.dispatchEvent(new Event('journal-entry-changed'));
        } catch (err) {
          if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
          break;
        }
      }

      if (changed) await loadSummary(year, month);
    } catch (err) {
      console.error('Could not sync offline journal drafts:', err);
    } finally {
      syncLockRef.current = false;
    }
  }, [user, selectedDate, loadSummary, year, month]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncPendingDrafts();
      loadSummary(year, month);
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    syncPendingDrafts();
    const retryTimer = window.setInterval(() => {
      if (navigator.onLine) syncPendingDrafts();
    }, 20000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(retryTimer);
    };
  }, [syncPendingDrafts, loadSummary, year, month]);

  useEffect(() => {
    loadSummary(year, month);
  }, [year, month, loadSummary]);

  // --------------------------------------------------
  // Load selected day's entry
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadEntry() {
      setLoadedDate(null);
      setDraftStatus('idle');
      setSyncConflict(null);
      setStatus('loading');
      setImageFiles([]);
      setImageError('');
      setImageStatus('idle');
      setCaptionStatus(null);

      let cached = null;
      if (user?._id) {
        try {
          cached = await getCachedEntry(user._id, selectedDate);
        } catch (err) {
          console.error('Could not read cached journal entry:', err);
        }
      }

      const applyEntry = (entry, record = null) => {
        const data = record?.data || entry;
        setTitle(data.title || '');
        setBody(data.body || '');
        setMood(data.mood || null);
        setTags(data.tags || []);
        setImages(record?.images || entry.images || []);
        hasEntryRef.current = Boolean(entry || record?.pending || record?.conflictRemote);
        lastSavedDraftRef.current = JSON.stringify({
          title: data.title || '',
          body: data.body || '',
          mood: data.mood || null,
          tags: data.tags || []
        });
        if (record?.conflictRemote) {
          setSyncConflict({ date: selectedDate, remote: record.conflictRemote });
          setDraftStatus('conflict');
        } else if (record?.pending) {
          setDraftStatus(navigator.onLine ? 'queued' : 'offline');
        }
      };

      const clearEntry = () => {
        setTitle('');
        setBody('');
        setMood(null);
        setTags([]);
        setImages([]);
        hasEntryRef.current = false;
        lastSavedDraftRef.current = JSON.stringify({ title: '', body: '', mood: null, tags: [] });
      };

      if (cached?.pending || cached?.conflictRemote) {
        applyEntry(null, cached);
        setLoadedDate(selectedDate);
        setStatus('idle');
        return;
      }

      if (!navigator.onLine) {
        setIsOffline(true);
        if (cached) applyEntry(null, cached);
        else clearEntry();
        setLoadedDate(selectedDate);
        setStatus('idle');
        return;
      }

      try {
        const response = await api.get(`/entries/${selectedDate}`, { timeout: 12000 });
        if (cancelled) return;
        const entry = response.data.entry;
        if (user?._id) await cacheServerEntry(user._id, entry);
        if (cancelled) return;
        applyEntry(entry);
        setIsOffline(false);
      } catch (err) {
        if (cancelled) return;
        if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
        if (cached) applyEntry(null, cached);
        else clearEntry();
        if (err.response?.status !== 404) console.error('Could not load journal entry:', err);
      } finally {
        if (!cancelled) {
          setLoadedDate(selectedDate);
          setStatus('idle');
        }
      }
    }

    loadEntry();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, user]);

  // Automatically save changed text and metadata after the user pauses typing.
  useEffect(() => {
    const draft = JSON.stringify({ title, body, mood, tags });
    if (loadedDate !== selectedDate) return undefined;
    if (draft === lastSavedDraftRef.current) {
      setDraftStatus('idle');
      return undefined;
    }
    if (!hasEntryRef.current && !title.trim() && !body.replace(/<[^>]*>/g, '').trim() && !mood && tags.length === 0) return undefined;

    setDraftStatus('pending');
    autosaveTimerRef.current = window.setTimeout(async () => {
      const data = JSON.parse(draft);
      let storedLocally = false;
      try {
        await saveLocalDraft(user._id, selectedDate, data);
        storedLocally = true;
        hasEntryRef.current = true;

        if (syncConflict?.date === selectedDate) {
          setDraftStatus('conflict');
          return;
        }

        if (!navigator.onLine) {
          setIsOffline(true);
          setDraftStatus('offline');
          return;
        }

        setDraftStatus('saving');
        const response = await api.put(`/entries/${selectedDate}`, data, { timeout: 12000 });
        await markDraftSynced(user._id, selectedDate, data, response.data.entry);
        lastSavedDraftRef.current = draft;
        setDraftStatus('saved');
        setIsOffline(false);
        window.dispatchEvent(new Event('journal-entry-changed'));
        await loadSummary(year, month);
      } catch (err) {
        console.error('Could not autosave journal draft:', err);
        if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
        setDraftStatus(storedLocally && err.response?.status !== 401 && err.response?.status !== 400 ? 'queued' : 'error');
      }
    }, 900);

    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [selectedDate, loadedDate, title, body, mood, tags, year, month, loadSummary, user, syncConflict]);

  // --------------------------------------------------
  // Save journal entry
  // --------------------------------------------------

  async function handleSave() {
    const data = { title, body, mood, tags };
    let storedLocally = false;
    try {
      window.clearTimeout(autosaveTimerRef.current);
      setStatus('saving');
      await saveLocalDraft(user._id, selectedDate, data);
      storedLocally = true;
      hasEntryRef.current = true;

      if (syncConflict?.date === selectedDate) {
        setDraftStatus('conflict');
        setStatus('idle');
        return;
      }

      if (!navigator.onLine) {
        setIsOffline(true);
        setDraftStatus('offline');
        setStatus('saved-offline');
        window.setTimeout(() => setStatus('idle'), 1800);
        return;
      }

      const response = await api.put(`/entries/${selectedDate}`, data, { timeout: 12000 });
      await markDraftSynced(user._id, selectedDate, data, response.data.entry);

      window.dispatchEvent(new Event('journal-entry-changed'));
      lastSavedDraftRef.current = JSON.stringify(data);
      setDraftStatus('saved');
      setIsOffline(false);

      setStatus('saved');

      await loadSummary(year, month);

      setTimeout(() => {
        setStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Could not save entry:', err);

      if (!err.response || err.code === 'ECONNABORTED') setIsOffline(true);
      setDraftStatus(storedLocally && err.response?.status !== 401 && err.response?.status !== 400 ? 'queued' : 'error');
      setStatus(storedLocally ? 'saved-offline' : 'idle');

      if (storedLocally) {
        window.setTimeout(() => setStatus('idle'), 1800);
      } else {
        alert(err.response?.data?.message || 'Could not save journal entry');
      }
    }
  }

  async function handleKeepOfflineVersion() {
    await keepLocalDraft(user._id, selectedDate);
    setSyncConflict(null);
    setDraftStatus('queued');
    syncPendingDrafts();
  }

  async function handleUseOnlineVersion() {
    const remote = syncConflict?.remote;
    await useRemoteEntry(user._id, selectedDate);
    setSyncConflict(null);
    if (remote?.missing) {
      setTitle('');
      setBody('');
      setMood(null);
      setTags([]);
      setImages([]);
      hasEntryRef.current = false;
      lastSavedDraftRef.current = JSON.stringify({ title: '', body: '', mood: null, tags: [] });
    } else if (remote) {
      setTitle(remote.title || '');
      setBody(remote.body || '');
      setMood(remote.mood || null);
      setTags(remote.tags || []);
      setImages(remote.images || []);
      hasEntryRef.current = true;
      lastSavedDraftRef.current = JSON.stringify({
        title: remote.title || '',
        body: remote.body || '',
        mood: remote.mood || null,
        tags: remote.tags || []
      });
    }
    setDraftStatus('idle');
    await loadSummary(year, month);
  }

  // --------------------------------------------------
  // Select multiple images
  // --------------------------------------------------

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) {
      return;
    }

    setImageError('');

    const remainingSlots = 8 - images.length - imageFiles.length;

    if (files.length > remainingSlots) {
      setImageError(
        `You can add only ${remainingSlots} more ${
          remainingSlots === 1 ? 'photo' : 'photos'
        } to this entry.`
      );

      e.target.value = '';
      return;
    }

    const invalidFile = files.find(
      (file) => !file.type.startsWith('image/')
    );

    if (invalidFile) {
      setImageError(
        'Please select image files only.'
      );

      e.target.value = '';
      return;
    }

    const oversizedFile = files.find(
      (file) => file.size > 5 * 1024 * 1024
    );

    if (oversizedFile) {
      setImageError(
        `The image "${oversizedFile.name}" is larger than 5 MB.`
      );

      e.target.value = '';
      return;
    }

    setImageFiles((current) => [...current, ...files]);
    e.target.value = '';
  }

  function removeQueuedImage(index) {
    setImageFiles((current) => current.filter((_, i) => i !== index));
  }

  // --------------------------------------------------
  // Upload multiple images
  // --------------------------------------------------

  async function handleImageUpload() {
    if (imageFiles.length === 0) {
      return;
    }

    try {
      setImageStatus('uploading');
      setImageError('');

      const formData = new FormData();

      imageFiles.forEach((file) => {
        formData.append('images', file);
      });

      const res = await api.post(
        `/entries/${selectedDate}/images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setImages(res.data.entry.images || []);
      setImageFiles([]);
      setImageStatus('uploaded');
      window.dispatchEvent(new Event('journal-entry-changed'));

      await loadSummary(year, month);

      setTimeout(() => {
        setImageStatus('idle');
      }, 1500);
    } catch (err) {
      console.error(
        'Multiple image upload failed:',
        err
      );

      setImageStatus('idle');

      setImageError(
        err.response?.data?.message ||
          'Could not upload images. Please try again.'
      );
    }
  }

  // --------------------------------------------------
  // Remove one image
  // --------------------------------------------------

  async function handleImageRemove(imageId) {
    const image = images.find(
      (item) => item._id === imageId
    );

    if (!image) {
      return;
    }

    const confirmed = window.confirm(
      'Remove this photo from the entry?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setImageStatus(`removing-${imageId}`);
      setImageError('');

      const res = await api.delete(
        `/entries/${selectedDate}/images/${imageId}`
      );

      setImages(res.data.entry.images || []);
      window.dispatchEvent(new Event('journal-entry-changed'));

      setImageStatus('idle');

      await loadSummary(year, month);
    } catch (err) {
      console.error(
        'Image removal failed:',
        err
      );

      setImageStatus('idle');

      setImageError(
        err.response?.data?.message ||
          'Could not remove image. Please try again.'
      );
    }
  }

  // --------------------------------------------------
  // Update caption locally
  // --------------------------------------------------

  function handleCaptionChange(imageId, value) {
    setImages((currentImages) =>
      currentImages.map((image) =>
        image._id === imageId
          ? {
              ...image,
              caption: value
            }
          : image
      )
    );
  }

  // --------------------------------------------------
  // Save image caption
  // --------------------------------------------------

  async function handleCaptionSave(imageId) {
    const image = images.find(
      (item) => item._id === imageId
    );

    if (!image) {
      return;
    }

    try {
      setCaptionStatus(imageId);
      setImageError('');

      const res = await api.put(
        `/entries/${selectedDate}/images/${imageId}`,
        {
          caption: image.caption || ''
        }
      );

      const updatedImage = res.data.image;

      setImages((currentImages) =>
        currentImages.map((currentImage) =>
          currentImage._id === imageId
            ? updatedImage
            : currentImage
        )
      );

      setCaptionStatus(`saved-${imageId}`);

      await loadSummary(year, month);

      setTimeout(() => {
        setCaptionStatus(null);
      }, 1500);
    } catch (err) {
      console.error(
        'Caption update failed:',
        err
      );

      setCaptionStatus(null);

      setImageError(
        err.response?.data?.message ||
          'Could not save caption. Please try again.'
      );
    }
  }

  // --------------------------------------------------
  // Export current day
  // --------------------------------------------------

  function handleExportDay() {
    exportEntriesToPdf(
      [
        {
          date: selectedDate,
          title,
          body,
          mood,
          images
        }
      ],
      `journal-${selectedDate}.pdf`
    );
  }

  // --------------------------------------------------
  // Export month
  // --------------------------------------------------

  async function handleExportMonth() {
    const dates = Object.keys(entriesByDate).sort();

    if (dates.length === 0) return;

    const fullEntries = await Promise.all(
      dates.map((d) =>
        api
          .get(`/entries/${d}`)
          .then((res) => res.data.entry)
      )
    );

    exportEntriesToPdf(
      fullEntries,
      `journal-${year}-${String(month).padStart(2, '0')}.pdf`
    );
  }

  // --------------------------------------------------
  // Number of available image slots
  // --------------------------------------------------

  const remainingImageSlots = 8 - images.length;

  return (
    <div className="journal-page">
      <header>
        <div className="journal-brand">
          <h1>Daily Journal</h1>
          <details className="journal-tools-menu">
            <summary aria-label="Open journal tools menu">✨ Explore</summary>
            <div className="journal-tools-dropdown">
              <button type="button" aria-pressed={journalPanel === 'memories'} onClick={(event) => { setJournalPanel((current) => current === 'memories' ? null : 'memories'); event.currentTarget.closest('details').open = false; }}>On This Day</button>
              <button type="button" aria-pressed={journalPanel === 'goals'} onClick={(event) => { setJournalPanel((current) => current === 'goals' ? null : 'goals'); event.currentTarget.closest('details').open = false; }}>Goals &amp; reflections</button>
            </div>
          </details>
        </div>

        <div className="header-right">
          <StreakBadge />

          <Link to="/insights">Insights</Link>

          <Link to="/photos">Photo memories</Link>

          <button
            onClick={toggleTheme}
            title="Toggle light/dark theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <span>Hi, {user?.username ? `@${user.username}` : user?.name}</span>

          <button onClick={logout}>Log out</button>
        </div>
      </header>

      {isOffline && (
        <div className="offline-banner" role="status">
          You’re offline. Journal text, mood, and tags save on this device and sync when you reconnect. Photo uploads need an internet connection.
        </div>
      )}

      {!journalPanel ? <div className="journal-layout">
        <aside>
          <CalendarView
            entriesByDate={entriesByDate}
            selectedDate={selectedDate}
            year={year}
            month={month}
            onSelectDate={setSelectedDate}
            onActiveMonthChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />

          <button
            className="export-month-button"
            onClick={handleExportMonth}
            disabled={
              Object.keys(entriesByDate).length === 0
            }
          >
            Export this month to PDF
          </button>

          <SearchPanel
            onSelectDate={setSelectedDate}
          />
        </aside>

        <main>
          <h2>{selectedDate}</h2>

          {syncConflict?.date === selectedDate && (
            <div className="offline-conflict" role="alert">
              <p>This entry changed online while you were offline. Choose which version to keep.</p>
              <div>
                <button type="button" onClick={handleKeepOfflineVersion}>
                  {syncConflict.remote?.missing ? 'Restore my offline version' : 'Keep my offline version'}
                </button>
                {!syncConflict.remote?.missing && <button type="button" className="secondary-action" onClick={handleUseOnlineVersion}>Use online version</button>}
              </div>
              {syncConflict.remote?.missing && <small>The online entry was deleted. Keeping your version will restore it.</small>}
            </div>
          )}

          <input
            type="text"
            className="entry-title"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <MoodPicker
            value={mood}
            onChange={setMood}
          />

          <TagInput
            tags={tags}
            onChange={setTags}
          />

          <RichTextEditor
            content={body}
            onChange={setBody}
          />

          {/* ------------------------------------------ */}
          {/* Multiple image attachment */}
          {/* ------------------------------------------ */}

          <section className="image-attachment" aria-labelledby="photos-heading">
            <div className="photo-section-heading">
              <div>
                <span className="photo-eyebrow">MEMORIES</span>
                <h3 id="photos-heading">Photos</h3>
                <p>Keep a little piece of this day close.</p>
              </div>
              <span className="photo-count">{images.length}/8</span>
            </div>

            {/* Existing image gallery */}
            {images.length > 0 ? (
              <div
                className="image-gallery"
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px'
                }}
              >
                {images.map((image) => (
                  <div
                    key={image._id}
                    className="image-gallery-item"
                    style={{
                      position: 'relative',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border:
                        '1px solid var(--border)',
                      background:
                        'var(--bg)'
                    }}
                  >
                    <img
                      src={image.url}
                      alt={
                        image.caption ||
                        `Journal photo for ${selectedDate}`
                      }
                      className="entry-image"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '160px',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Caption */}
                    <div
                      style={{
                        padding: '10px'
                      }}
                    >
                      <textarea
                        value={image.caption || ''}
                        onChange={(e) =>
                          handleCaptionChange(
                            image._id,
                            e.target.value
                          )
                        }
                        placeholder="Write a caption..."
                        maxLength={300}
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                          padding: '8px',
                          borderRadius: '6px',
                          border:
                            '1px solid var(--border)',
                          background:
                            'var(--bg)',
                          color:
                            'var(--text)',
                          fontFamily:
                            'inherit',
                          fontSize: '13px'
                        }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          gap: '8px',
                          marginTop: '6px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            opacity: 0.65
                          }}
                        >
                          {(image.caption || '')
                            .length}
                          /300
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            handleCaptionSave(
                              image._id
                            )
                          }
                          disabled={
                            captionStatus ===
                            image._id
                          }
                          style={{
                            padding:
                              '6px 10px',
                            fontSize: '12px'
                          }}
                        >
                          {captionStatus ===
                          image._id
                            ? 'Saving…'
                            : captionStatus ===
                              `saved-${image._id}`
                            ? 'Saved ✓'
                            : 'Save Caption'}
                        </button>
                      </div>
                    </div>

                    {/* Remove image */}
                    <button
                      type="button"
                      onClick={() =>
                        handleImageRemove(
                          image._id
                        )
                      }
                      disabled={
                        imageStatus ===
                        `removing-${image._id}`
                      }
                      style={{
                        width: '100%',
                        borderRadius: 0,
                        background:
                          'rgba(0, 0, 0, 0.7)',
                        padding: '8px',
                        fontSize: '13px'
                      }}
                    >
                      {imageStatus ===
                      `removing-${image._id}`
                        ? 'Removing…'
                        : 'Remove photo'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="image-empty">
                <span className="photo-empty-icon" aria-hidden="true">✧</span>
                <strong>No photos for this day yet</strong>
                <span>Add a favorite moment to your entry.</span>
              </div>
            )}

            {/* Upload area */}
            {remainingImageSlots > 0 && (
              <>
                <input id="journal-images" type="file" accept="image/*" multiple className="image-file-input" onChange={handleImageSelect} />
                <label htmlFor="journal-images" className="image-upload-label">
                  <span className="upload-icon" aria-hidden="true">＋</span>
                  <strong>Add photos to this entry</strong>
                  <span>Choose up to {remainingImageSlots} {remainingImageSlots === 1 ? 'photo' : 'photos'} from your device</span>
                  <span className="upload-browse">Browse photos</span>
                </label>
                {imageFiles.length > 0 && (
                  <div className="selected-image">
                    <div className="queued-photo-grid">
                      {imageFiles.map((file, index) => (
                        <QueuedPhotoPreview
                          file={file}
                          key={`${file.name}-${file.lastModified}-${index}`}
                          onRemove={() => removeQueuedImage(index)}
                        />
                      ))}
                    </div>
                    <div className="queued-photo-actions">
                      <strong>{imageFiles.length} {imageFiles.length === 1 ? 'photo' : 'photos'} ready</strong>
                    <button
                      type="button"
                      onClick={
                        handleImageUpload
                      }
                      disabled={
                        imageStatus ===
                        'uploading'
                      }
                    >
                      {imageStatus ===
                      'uploading'
                        ? 'Uploading…'
                        : imageStatus ===
                          'uploaded'
                        ? 'Uploaded ✓'
                        : `Upload ${
                            imageFiles.length
                          } ${
                            imageFiles.length ===
                            1
                              ? 'photo'
                              : 'photos'
                          }`}
                    </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="image-help">
              JPG, PNG, WEBP or another image
              format. Maximum size: 5 MB per
              image. Maximum 8 photos per entry.
            </p>

            {remainingImageSlots === 0 && (
              <p className="image-help">
                You have reached the maximum of 8
                photos for this entry.
              </p>
            )}

            {imageError && (
              <p className="image-error">
                {imageError}
              </p>
            )}
          </section>

          {draftStatus !== 'idle' && (
            <p className={`autosave-status ${draftStatus}`} role="status" aria-live="polite">
              {draftStatus === 'pending' ? 'Draft will save shortly…' : draftStatus === 'saving' ? 'Saving draft…' : draftStatus === 'saved' ? 'Draft saved to your account' : draftStatus === 'offline' ? 'Saved on this device. It will sync when you reconnect.' : draftStatus === 'queued' ? 'Saved on this device. Waiting to sync…' : draftStatus === 'conflict' ? 'Choose which version of this entry to keep.' : 'Draft could not be saved. Try again when connected.'}
            </p>
          )}

          <div className="entry-actions">
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
            >
              {status === 'saving'
                ? 'Saving…'
                : status === 'saved-offline'
                ? 'Saved offline ✓'
                : status === 'saved'
                ? 'Saved ✓'
                : 'Save entry'}
            </button>

            <button onClick={handleExportDay}>
              Export this day to PDF
            </button>
          </div>
        </main>
      </div> : (
        <section className="journal-focused-panel" ref={journalPanelRef}>
          <button type="button" className="focused-panel-back" onClick={() => setJournalPanel(null)}>← Back to journal</button>
          {journalPanel === 'memories' && <OnThisDay date={todayKey()} onOpenEntry={(entryDate) => { setSelectedDate(entryDate); setJournalPanel(null); }} />}
          {journalPanel === 'goals' && <GoalsPanel />}
        </section>
      )}
    </div>
  );
}
