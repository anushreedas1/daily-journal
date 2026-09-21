# Daily Journal — with Calendar Integration

A journaling app: write daily entries with rich text, track your mood, browse
past entries on a calendar, search/filter by tag or mood, keep a journaling
streak, and export entries to PDF. Includes basic mood analytics and
sentiment analysis, and a light/dark theme. Works as a normal web app and
installs as a desktop app (PWA), backed by a shared account so your entries
sync across devices.

## Stack

- **Frontend:** React (Vite), `react-calendar`, TipTap (rich text), `jspdf`,
  `recharts` (analytics charts)
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth, `sentiment`
  (lightweight text sentiment scoring)
- **PWA:** installable as a desktop app via `vite-plugin-pwa`

## Project structure

```
journal-app/
  backend/
    models/       # User, Entry (Mongoose schemas)
    routes/        # /api/auth, /api/entries (CRUD, search, streak, analytics)
    middleware/    # JWT auth guard
    utils/         # sentiment.js — isolated sentiment-analysis hook
    server.js
  frontend/
    src/
      api/         # axios client
      context/     # AuthContext, ThemeContext
      components/  # CalendarView, RichTextEditor, MoodPicker, TagInput,
                    # StreakBadge, SearchPanel, ExportPdfButton
      pages/        # LoginPage, RegisterPage, JournalPage, InsightsPage
```

## Running locally

**Backend**
```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:5000/api` by default
(override with `VITE_API_URL`).

## Data model

Each `Entry` is keyed by `(user, date)` where `date` is `YYYY-MM-DD`, so
there's exactly one entry per user per day — this is what makes the calendar
lookups and "one entry per day" behavior simple.

```
Entry {
  user, date, title, body (HTML from the rich text editor),
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible' | null,
  tags: string[],
  sentimentScore: number | null,   // auto-computed, see utils/sentiment.js
  sentimentLabel: 'positive' | 'neutral' | 'negative' | null
}
```

## API additions

- `GET /api/entries/search?q=&tag=&mood=&from=&to=` — full-text search plus filters
- `GET /api/entries/streak` — current and longest journaling streak
- `GET /api/entries/analytics?from=&to=` — mood distribution + sentiment trend

## Extension points (good first contributions)

- **Mood analytics** ✅ implemented — `InsightsPage.jsx` charts mood
  distribution and sentiment trend via `/api/entries/analytics`. Good next
  step: add week-over-week comparisons or per-tag breakdowns.
- **Sentiment analysis** ✅ implemented (basic) — `backend/utils/sentiment.js`
  scores entry text with the `sentiment` npm package on save. It's
  intentionally isolated so a contributor can swap in a smarter model (e.g.
  an ML-based API) without touching route logic.
- **Custom themes** ✅ implemented (light/dark) — `ThemeContext.jsx` toggles
  a `data-theme` attribute; themes are defined as CSS variable blocks in
  `src/styles.css`. Adding a new theme = one more `[data-theme="..."]` block
  plus an option in the toggle.
- **External calendar sync** — not yet implemented. The calendar UI
  (`CalendarView.jsx`) currently only reads from `/api/entries/summary`; a
  Google Calendar integration could merge in real events as a second data
  source.
- **Push reminders** — not yet implemented. The app is already a PWA, so a
  service-worker notification ("write today's entry") is a natural addition.

See `CONTRIBUTING.md` for how to submit changes.
