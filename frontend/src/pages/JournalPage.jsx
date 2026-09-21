import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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

function todayKey() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function JournalPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [entriesByDate, setEntriesByDate] = useState({});

  const [selectedDate, setSelectedDate] = useState(todayKey());

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
  const [imageStatus, setImageStatus] = useState('idle');
  const [imageError, setImageError] = useState('');

  // Caption saving state
  const [captionStatus, setCaptionStatus] = useState(null);

  // --------------------------------------------------
  // Load month's calendar summary
  // --------------------------------------------------

  const loadSummary = useCallback(async (y, m) => {
    try {
      const res = await api.get('/entries/summary', {
        params: {
          year: y,
          month: m
        }
      });

      const map = {};

      res.data.entries.forEach((e) => {
        map[e.date] = {
          mood: e.mood,
          title: e.title,
          images: e.images || []
        };
      });

      setEntriesByDate(map);
    } catch (err) {
      console.error('Could not load journal summary:', err);
    }
  }, []);

  useEffect(() => {
    loadSummary(year, month);
  }, [year, month, loadSummary]);

  // --------------------------------------------------
  // Load selected day's entry
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    setStatus('loading');
    setImageFiles([]);
    setImageError('');
    setImageStatus('idle');
    setCaptionStatus(null);

    api
      .get(`/entries/${selectedDate}`)
      .then((res) => {
        if (cancelled) return;

        const entry = res.data.entry;

        setTitle(entry.title || '');
        setBody(entry.body || '');
        setMood(entry.mood || null);
        setTags(entry.tags || []);
        setImages(entry.images || []);
      })
      .catch((err) => {
        if (cancelled) return;

        if (err.response?.status === 404) {
          setTitle('');
          setBody('');
          setMood(null);
          setTags([]);
          setImages([]);
          setImageFiles([]);
        } else {
          console.error(
            'Could not load journal entry:',
            err
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatus('idle');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // --------------------------------------------------
  // Save journal entry
  // --------------------------------------------------

  async function handleSave() {
    try {
      setStatus('saving');

      await api.put(`/entries/${selectedDate}`, {
        title,
        body,
        mood,
        tags
      });

      setStatus('saved');

      await loadSummary(year, month);

      setTimeout(() => {
        setStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Could not save entry:', err);

      setStatus('idle');

      alert(
        err.response?.data?.message ||
          'Could not save journal entry'
      );
    }
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

    const remainingSlots = 8 - images.length;

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

    setImageFiles(files);
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
        <h1>Daily Journal</h1>

        <div className="header-right">
          <StreakBadge />

          <Link to="/insights">Insights</Link>

          <button
            onClick={toggleTheme}
            title="Toggle light/dark theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <span>Hi, {user?.name}</span>

          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="journal-layout">
        <aside>
          <CalendarView
            entriesByDate={entriesByDate}
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

          {/* ------------------------------------------ */}
          {/* Multiple image attachment */}
          {/* ------------------------------------------ */}

          <div className="image-attachment">
            <h3>Photos</h3>

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
              <p className="image-empty">
                No photos attached to this entry.
              </p>
            )}

            {/* Upload area */}
            {remainingImageSlots > 0 && (
              <>
                <label
                  htmlFor="journal-images"
                  className="image-upload-label"
                >
                  📷 Choose{' '}
                  {remainingImageSlots === 1
                    ? 'a photo'
                    : 'photos'}
                </label>

                <input
                  id="journal-images"
                  type="file"
                  accept="image/*"
                  multiple
                  className="image-file-input"
                  onChange={handleImageSelect}
                />

                {imageFiles.length > 0 && (
                  <div className="selected-image">
                    <div>
                      <strong>
                        {imageFiles.length}{' '}
                        {imageFiles.length === 1
                          ? 'photo'
                          : 'photos'}{' '}
                        selected
                      </strong>

                      <ul
                        style={{
                          margin: '8px 0 0',
                          paddingLeft: '20px'
                        }}
                      >
                        {imageFiles.map(
                          (file) => (
                            <li
                              key={`${file.name}-${file.lastModified}`}
                            >
                              {file.name}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

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
          </div>

          {/* ------------------------------------------ */}
          {/* Journal editor */}
          {/* ------------------------------------------ */}

          <RichTextEditor
            content={body}
            onChange={setBody}
          />

          <div className="entry-actions">
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
            >
              {status === 'saving'
                ? 'Saving…'
                : status === 'saved'
                ? 'Saved ✓'
                : 'Save entry'}
            </button>

            <button onClick={handleExportDay}>
              Export this day to PDF
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}