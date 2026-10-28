# Jarvis Field Book

A phone app (installable web app) for HoReCa field sales: shops by area, a wallet per shop
(photos, company assets with S/N, POSM, back bar, menu and prices, consumption, contacts,
visits), a GPS map with "near me", market share from back bar labels, company catalogues,
tasks, and a Talk button that files spoken visit notes with Claude.

## How it fits together

- **This repository** holds the app's code and is published with GitHub Pages. No secrets live here.
- **Supabase** stores the data (`docs` table) and photos (private `photos` bucket). Row-level
  security means each signed-in user only ever sees their own rows and files.
- **The `jarvis-ai` Edge Function** in Supabase holds the Claude API key and is the only thing that talks to Claude.

## One-time setup

1. Supabase → SQL Editor → paste `supabase/schema.sql` → Run.
2. Put your Project URL and anon key in `config.js`.
3. Deploy the Edge Function `supabase/functions/jarvis-ai` and set its secrets:
   `ANTHROPIC_API_KEY` (from console.anthropic.com) and `ALLOWED_EMAIL` (your sign-in email).
4. GitHub → Settings → Pages → Deploy from branch `main`, folder `/ (root)`.
5. Open the Pages URL on your phone, create your account, then Share → Add to Home Screen.
6. After your account exists, Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up".

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell, sign-in screen, start-up |
| `app.js` | Screens and behaviour |
| `data.js` | Supabase storage with offline cache and upload queue, photo URLs, Claude calls |
| `style.css` | Look and feel (light and dark) |
| `sw.js` | Offline support |
| `supabase/` | Database rules and the Claude function |
