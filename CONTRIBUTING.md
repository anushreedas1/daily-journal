# Contributing

Thanks for considering a contribution! This project is intentionally kept
small and modular so it's easy to extend — see the "Extension points" section
in the README for ideas (mood analytics, sentiment analysis, custom themes,
calendar sync).

## Getting set up

1. Fork and clone the repo.
2. Follow the "Running locally" steps in the README for both `backend/` and
   `frontend/`.
3. Create a branch: `git checkout -b feature/your-feature-name`.

## Guidelines

- Keep new features isolated where possible (new route file, new component)
  rather than modifying core CRUD (`routes/entries.js`, `Entry` model)
  unless the feature genuinely requires a schema change.
- If you add a field to `Entry`, keep it optional/nullable so existing
  entries don't break.
- Match the existing style: functional React components, async/await on the
  backend, no class components.
- Add a short note to the README's "Extension points" section if you add a
  new pluggable area.

## Submitting

Open a pull request with:
- A short description of what changed and why
- Screenshots for any UI changes
- Notes on any new environment variables or migrations needed
