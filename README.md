# OSINT SIEM

Welcome to your first nonprofit Defensive gig, SOC Analyst.

This is a live, authority-driven OSINT dashboard. It indexes public alerts, links directly to official sources, and provides reporting/tip links where available. No data is stored here.

## Use It

1. Visit the live site: `https://cyberdude88.github.io/osint-siem/`
2. Assist authorities by researching and providing valuable information through researching Open Source Intelligence (OSINT), through ongoing investigations. Your report can save lives.
3. Report responsibly using the provided official channels, and following correct reporting procedures outlined in the alert link.

## Run Locally

```bash
npm install
npm run fetch:alerts:watch
npm run dev
```

### Incident Relevance Filtering

The alert fetcher now scores each feed item using weighted heuristics and keeps
borderline alerts by default.

- `INCIDENT_RELEVANCE_THRESHOLD` (default `0.42`): only items below this score are filtered/down-ranked.
- `public/alerts.json`: retained actionable alerts used by the UI.
- `public/alerts-filtered.json`: filtered/down-ranked items kept for review/debugging.
- `public/alerts-state.json`: retained + filtered + removed lifecycle tracking.

## GitHub Pages

This repo deploys via GitHub Actions. If you see a 404, check:

1. Repo Settings → Pages → Source = GitHub Actions
2. Actions tab → latest workflow succeeded
3. The URL matches your GitHub username and repo name
