# OSINT SIEM

Welcome to your first nonprofit Defensive gig, SOC Analyst.

This is a live, authority-driven OSINT dashboard. It indexes public alerts, links directly to official sources, and provides reporting/tip links where available. No data is stored here.

## Use It

1. Visit the live site: `https://cyberdude88.github.io/osint-siem/`
2. Pick an alert category and drill into the official source.
3. Report responsibly using the provided official channels.

## Run Locally

```bash
npm install
npm run fetch:alerts:watch
npm run dev
```

## GitHub Pages

This repo deploys via GitHub Actions. If you see a 404, check:

1. Repo Settings → Pages → Source = GitHub Actions
2. Actions tab → latest workflow succeeded
3. The URL matches your GitHub username and repo name

