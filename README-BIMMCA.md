# BIMMCA Intelligence — GitHub Pages branch

Branch: `bimmca-dashboard`

This branch is isolated from `main`, so the existing VAREVANT website source is not changed.

## Supabase connection
Edit `supabase-config.js` and fill only:

```js
window.BIMMCA_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

Never place `sb_secret_...` in this branch or any browser code.

The dashboard reads `public.brand_metrics_latest` and listens for Realtime Postgres changes. It filters live metrics to `platform = gemini`.

Expected fields used by the dashboard:
- `brand`
- `platform`
- `visibility_score`
- `share_of_voice`
- `avg_position`
- `top1_rate`
- `positive_sentiment`
- optional `mentions`

If Supabase is not configured or unavailable, the site automatically stays in `PILOT DATASET` mode.

## GitHub Pages
Publish this branch from repository Settings → Pages → Deploy from a branch → `bimmca-dashboard` → `/ (root)`.

The `.nojekyll` file is already included.
