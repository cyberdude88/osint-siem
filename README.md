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

For resilient 24/7 collection with auto-restart on crashes:

```bash
npm run collector:run
```

Tuning examples:

```bash
INTERVAL_MS=120000 MAX_PER_SOURCE=80 npm run collector:run
```

### Incident Relevance Filtering

The alert fetcher now scores each feed item using weighted heuristics and keeps
borderline alerts by default.

- `INCIDENT_RELEVANCE_THRESHOLD` (default `0.42`): only items below this score are filtered/down-ranked.
- `MISSING_PERSON_RELEVANCE_THRESHOLD` (default `0`): keeps missing-person notices aggressively (false-positive friendly).
- `public/alerts.json`: retained actionable alerts used by the UI.
- `public/alerts-filtered.json`: filtered/down-ranked items kept for review/debugging.
- `public/alerts-state.json`: retained + filtered + removed lifecycle tracking.

### South America Coverage

Feed coverage includes official law-enforcement, prosecutor, cybercrime, missing-person,
and INTERPOL country-linked notice streams for South America, with fallback URLs where available.

## GitHub Pages

This repo deploys via GitHub Actions. If you see a 404, check:

1. Repo Settings → Pages → Source = GitHub Actions
2. Actions tab → latest workflow succeeded
3. The URL matches your GitHub username and repo name
