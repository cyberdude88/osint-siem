import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import crypto from "node:crypto";

const MAX_PER_SOURCE = Number.parseInt(process.env.MAX_PER_SOURCE ?? "6", 10);
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? "public/alerts.json";
const MAX_AGE_DAYS = Number.parseInt(process.env.MAX_AGE_DAYS ?? "90", 10);
const WATCH =
  process.argv.includes("--watch") || process.env.WATCH === "1";
const INTERVAL_MS = Number.parseInt(process.env.INTERVAL_MS ?? "900000", 10);

// ─── AGENCY FEEDS ───────────────────────────────────────────────
// Organized by: CISA | FBI | EUROPOL | NCSC | POLICE (region) | PUBLIC SAFETY
// Only confirmed-working feeds are included.

const sources = [
  // ── CISA (US / North America) ─────────────────────────────────
  {
    type: "kev-json",
    source: {
      source_id: "cisa-kev",
      authority_name: "CISA",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "cert",
      base_url: "https://www.cisa.gov",
    },
    feed_url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    category: "cyber_advisory",
    region_tag: "US",
    lat: 38.88,
    lng: -77.02,
    reporting: {
      label: "Report to CISA",
      url: "https://www.cisa.gov/report",
      notes: "Use 911 for emergencies.",
    },
  },

  // ── FBI (US / North America) ──────────────────────────────────
  {
    type: "rss",
    source: {
      source_id: "fbi",
      authority_name: "FBI",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "police",
      base_url: "https://www.fbi.gov",
    },
    feed_url: "https://www.fbi.gov/feeds/fbi-top-stories/rss.xml",
    category: "public_appeal",
    region_tag: "US",
    lat: 38.9,
    lng: -77.0,
    reporting: {
      label: "Report to FBI",
      url: "https://tips.fbi.gov/",
      phone: "1-800-CALL-FBI (1-800-225-5324)",
      notes: "Use 911 for emergencies.",
    },
  },

  // ── EUROPOL (EU / Europe) ─────────────────────────────────────
  {
    type: "rss",
    followRedirects: true,
    source: {
      source_id: "europol",
      authority_name: "Europol",
      country: "Netherlands",
      country_code: "NL",
      region: "Europe",
      authority_type: "police",
      base_url: "https://www.europol.europa.eu",
    },
    feed_url: "https://www.europol.europa.eu/rss.xml",
    category: "public_appeal",
    region_tag: "EU",
    lat: 52.09,
    lng: 4.27,
    reporting: {
      label: "Report to Europol",
      url: "https://www.europol.europa.eu/report-a-crime",
    },
  },

  // ── NCSC UK (UK / Europe) ─────────────────────────────────────
  {
    type: "rss",
    source: {
      source_id: "ncsc-uk",
      authority_name: "NCSC UK",
      country: "United Kingdom",
      country_code: "GB",
      region: "Europe",
      authority_type: "cert",
      base_url: "https://www.ncsc.gov.uk",
    },
    feed_url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
    category: "cyber_advisory",
    region_tag: "GB",
    lat: 51.5,
    lng: -0.13,
    reporting: {
      label: "Report to NCSC",
      url: "https://www.ncsc.gov.uk/section/about-this-website/report-scam-website",
    },
  },
  {
    type: "rss",
    source: {
      source_id: "ncsc-uk-all",
      authority_name: "NCSC UK",
      country: "United Kingdom",
      country_code: "GB",
      region: "Europe",
      authority_type: "cert",
      base_url: "https://www.ncsc.gov.uk",
    },
    feed_url: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml",
    category: "cyber_advisory",
    region_tag: "GB",
    lat: 51.51,
    lng: -0.1,
    reporting: {
      label: "Report to NCSC",
      url: "https://www.ncsc.gov.uk/section/about-this-website/report-scam-website",
    },
  },

  // ── POLICE: New Zealand (Oceania) ─────────────────────────────
  {
    type: "rss",
    source: {
      source_id: "nz-police-news",
      authority_name: "NZ Police",
      country: "New Zealand",
      country_code: "NZ",
      region: "Oceania",
      authority_type: "police",
      base_url: "https://www.police.govt.nz",
    },
    feed_url: "https://www.police.govt.nz/rss/news",
    category: "public_safety",
    region_tag: "NZ",
    lat: -41.29,
    lng: 174.78,
    reporting: {
      label: "Report to NZ Police",
      url: "https://www.police.govt.nz/use-105",
      phone: "111 (Emergency) / 105 (Non-emergency)",
    },
  },
  {
    type: "rss",
    source: {
      source_id: "nz-police-alerts",
      authority_name: "NZ Police",
      country: "New Zealand",
      country_code: "NZ",
      region: "Oceania",
      authority_type: "police",
      base_url: "https://www.police.govt.nz",
    },
    feed_url: "https://www.police.govt.nz/rss/alerts",
    category: "public_appeal",
    region_tag: "NZ",
    lat: -41.29,
    lng: 174.78,
    reporting: {
      label: "Report to NZ Police",
      url: "https://www.police.govt.nz/use-105",
      phone: "111 (Emergency) / 105 (Non-emergency)",
    },
  },

  // ── PUBLIC SAFETY: NCMEC (US / North America) ─────────────────
  {
    type: "rss",
    source: {
      source_id: "ncmec",
      authority_name: "NCMEC",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "public_safety_program",
      base_url: "https://www.missingkids.org",
    },
    feed_url:
      "https://api.missingkids.org/missingkids/servlet/XmlServlet?LanguageCountry=en_US&act=rss&orgPrefix=NCMC",
    category: "missing_person",
    region_tag: "US",
    lat: 39.83,
    lng: -98.58,
    reporting: {
      label: "Report to NCMEC",
      url: "https://report.cybertip.org/",
      phone: "1-800-THE-LOST (1-800-843-5678)",
      notes: "Use 911 for immediate danger.",
    },
  },
];

function decodeXml(value) {
  if (!value) return "";
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTag(block, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? decodeXml(match[1]) : "";
}

function getAtomLink(block) {
  const alternate = block.match(/<link[^>]*rel=["']alternate["'][^>]*>/i);
  const linkTag = alternate?.[0] ?? block.match(/<link[^>]*>/i)?.[0];
  if (!linkTag) return "";
  const hrefMatch = linkTag.match(/href=["']([^"']+)["']/i);
  return hrefMatch ? decodeXml(hrefMatch[1]) : "";
}

function parseItems(xml) {
  if (xml.includes("<feed")) {
    const entries = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
    return entries.map((entry) => ({
      title: getTag(entry, "title"),
      link: getAtomLink(entry),
      published: getTag(entry, "published") || getTag(entry, "updated"),
    }));
  }

  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  return items.map((item) => ({
    title: getTag(item, "title"),
    link: getTag(item, "link") || getTag(item, "guid"),
    published: getTag(item, "pubDate") || getTag(item, "dc:date"),
  }));
}

function isInformational(title) {
  const t = title.toLowerCase();
  const keywords = [
    "traffic",
    "road",
    "highway",
    "motorway",
    "lane",
    "closure",
    "closed",
    "detour",
    "accident",
    "crash",
    "collision",
    "vehicle",
    "multi-vehicle",
    "rollover",
    "roadworks",
    "road work",
  ];
  return keywords.some((word) => t.includes(word));
}

function inferSeverity(title, fallback) {
  const t = title.toLowerCase();
  if (isInformational(t)) return "info";
  // Explicit severity keywords
  if (t.includes("critical") || t.includes("emergency") || t.includes("zero-day") || t.includes("0-day")) return "critical";
  if (t.includes("ransomware") || t.includes("actively exploited") || t.includes("exploitation")) return "critical";
  if (t.includes("high") || t.includes("severe") || t.includes("urgent")) return "high";
  if (t.includes("wanted") || t.includes("fugitive") || t.includes("murder") || t.includes("homicide")) return "critical";
  if (t.includes("missing") || t.includes("amber alert") || t.includes("kidnap")) return "critical";
  if (t.includes("fatal") || t.includes("death") || t.includes("shooting")) return "high";
  if (t.includes("fraud") || t.includes("scam") || t.includes("phishing")) return "high";
  if (t.includes("arrested") || t.includes("charged") || t.includes("sentenced")) return "medium";
  if (t.includes("medium") || t.includes("moderate")) return "medium";
  if (t.includes("low") || t.includes("informational")) return "info";
  return fallback;
}

function defaultSeverity(category) {
  switch (category) {
    case "cyber_advisory":
      return "high";
    case "wanted_suspect":
      return "critical";
    case "missing_person":
      return "critical";
    case "public_appeal":
      return "high";
    case "public_safety":
      return "medium";
    default:
      return "medium";
  }
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isFresh(date, now) {
  const cutoff = now.getTime() - MAX_AGE_DAYS * 86400000;
  return date.getTime() >= cutoff;
}

function hashId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function kevItemToAlert(entry, meta) {
  const cve = entry.cveID ?? entry.cveId ?? entry.cve;
  const title = `${cve ?? "CVE"}: ${entry.vulnerabilityName ?? "Known Exploited Vulnerability"}`;
  const nvdLink = cve ? `https://nvd.nist.gov/vuln/detail/${cve}` : meta.source.base_url;
  const now = new Date();
  const publishedAt = parseDate(entry.dateAdded);
  if (!publishedAt || !isFresh(publishedAt, now)) {
    return null;
  }
  const hours = Math.max(1, Math.round((now - publishedAt) / 36e5));
  const kevSeverity = hours <= 72 ? "critical" : hours <= 168 ? "high" : "medium";
  return {
    alert_id: `${meta.source.source_id}-${hashId(nvdLink)}`,
    source_id: meta.source.source_id,
    source: meta.source,
    title,
    canonical_url: nvdLink,
    first_seen: publishedAt.toISOString(),
    last_seen: now.toISOString(),
    status: "active",
    category: meta.category,
    severity: kevSeverity,
    region_tag: meta.region_tag,
    lat: meta.lat,
    lng: meta.lng,
    freshness_hours: hours,
    reporting: meta.reporting,
  };
}

async function fetchFeed(url, followRedirects = false) {
  const response = await fetch(url, {
    redirect: followRedirects ? "follow" : "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; osint-siem-bot/1.0)",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`feed fetch failed ${response.status} ${url}`);
  }
  return response.text();
}

async function fetchRss(meta, now) {
  const xml = await fetchFeed(meta.feed_url, meta.followRedirects);
  const items = parseItems(xml)
    .filter((item) => item.title && item.link)
    .slice(0, MAX_PER_SOURCE);

  return items.map((item) => {
    const publishedAt = parseDate(item.published) ?? now;
    if (!isFresh(publishedAt, now)) {
      return null;
    }
    const hours = Math.max(1, Math.round((now - publishedAt) / 36e5));
    return {
      alert_id: `${meta.source.source_id}-${hashId(item.link)}`,
      source_id: meta.source.source_id,
      source: meta.source,
      title: item.title,
      canonical_url: item.link,
      first_seen: publishedAt.toISOString(),
      last_seen: now.toISOString(),
      status: "active",
      category: meta.category,
      severity: inferSeverity(item.title, defaultSeverity(meta.category)),
      region_tag: meta.region_tag,
      lat: meta.lat,
      lng: meta.lng,
      freshness_hours: hours,
      reporting: meta.reporting,
    };
  }).filter(Boolean);
}

async function fetchKev(meta) {
  const response = await fetch(meta.feed_url, {
    headers: {
      "User-Agent": "osint-siem-bot/1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`kev fetch failed ${response.status} ${meta.feed_url}`);
  }
  const data = await response.json();
  const vulnerabilities = Array.isArray(data?.vulnerabilities) ? data.vulnerabilities : [];
  // Sort by dateAdded descending (newest first) then take top N
  vulnerabilities.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  return vulnerabilities
    .slice(0, MAX_PER_SOURCE)
    .map((entry) => kevItemToAlert(entry, meta))
    .filter(Boolean);
}

async function buildAlerts() {
  const now = new Date();
  const alerts = [];

  for (const entry of sources) {
    try {
      const batch =
        entry.type === "kev-json"
          ? await fetchKev(entry)
          : await fetchRss(entry, now);
      alerts.push(...batch);
    } catch (error) {
      console.warn(`WARN ${entry.source.authority_name}: ${error.message}`);
    }
  }

  alerts.sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime());
  return alerts;
}

async function writeAlerts(alerts) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(alerts, null, 2) + "\n", "utf8");
  console.log(`Wrote ${alerts.length} alerts -> ${OUTPUT_PATH}`);
}

async function main() {
  const alerts = await buildAlerts();
  await writeAlerts(alerts);

  if (WATCH) {
    console.log(`Watching feeds every ${Math.round(INTERVAL_MS / 1000)}s...`);
    setInterval(async () => {
      try {
        const next = await buildAlerts();
        await writeAlerts(next);
      } catch (error) {
        console.warn(`WARN refresh: ${error.message}`);
      }
    }, INTERVAL_MS);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
