import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import crypto from "node:crypto";

const MAX_PER_SOURCE = Number.parseInt(process.env.MAX_PER_SOURCE ?? "6", 10);
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? "public/alerts.json";
const WATCH =
  process.argv.includes("--watch") || process.env.WATCH === "1";
const INTERVAL_MS = Number.parseInt(process.env.INTERVAL_MS ?? "900000", 10);

const sources = [
  {
    type: "rss",
    source: {
      source_id: "s1",
      authority_name: "CISA Alerts",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "cert",
      base_url: "https://www.cisa.gov",
    },
    feed_url: "https://www.cisa.gov/uscert/ncas/alerts.xml",
    category: "cyber_advisory",
    region_tag: "US",
    lat: 38.88,
    lng: -77.02,
    reporting: {
      label: "Report to CISA",
      url: "https://cisa.services/report/",
      notes: "Use 911 for emergencies.",
    },
  },
  {
    type: "kev-json",
    source: {
      source_id: "s2",
      authority_name: "CISA KEV",
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
      url: "https://cisa.services/report/",
      notes: "Use 911 for emergencies.",
    },
  },
  {
    type: "rss",
    source: {
      source_id: "s3",
      authority_name: "FBI Press Releases",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "police",
      base_url: "https://www.fbi.gov",
    },
    feed_url: "https://www.fbi.gov/news/press-releases?format=rss",
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
  {
    type: "rss",
    source: {
      source_id: "s4",
      authority_name: "FBI Top Stories",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "police",
      base_url: "https://www.fbi.gov",
    },
    feed_url: "https://www.fbi.gov/feeds/fbi-top-stories/rss.xml",
    category: "public_safety",
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
  {
    type: "rss",
    source: {
      source_id: "s5",
      authority_name: "FBI All Wanted",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "police",
      base_url: "https://www.fbi.gov",
    },
    feed_url: "https://www.fbi.gov/wanted/rss.xml",
    category: "wanted_suspect",
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
  {
    type: "rss",
    source: {
      source_id: "s6",
      authority_name: "NCMEC Missing Child Alerts",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "public_safety_program",
      base_url: "https://www.missingkids.org",
    },
    feed_url:
      "https://www.ncmec.org/missingkids/servlet/XmlServlet?LanguageCountry=en_US&act=rss&orgPrefix=NCMC",
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
  {
    type: "rss",
    source: {
      source_id: "s7",
      authority_name: "NZ Police News",
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
  },
  {
    type: "rss",
    source: {
      source_id: "s8",
      authority_name: "NZ Police Alerts",
      country: "New Zealand",
      country_code: "NZ",
      region: "Oceania",
      authority_type: "police",
      base_url: "https://www.police.govt.nz",
    },
    feed_url: "https://www.police.govt.nz/rss/alerts",
    category: "public_safety",
    region_tag: "NZ",
    lat: -41.29,
    lng: 174.78,
  },
  {
    type: "rss",
    source: {
      source_id: "s9",
      authority_name: "Policia Nacional Cyber Alerts",
      country: "Spain",
      country_code: "ES",
      region: "Europe",
      authority_type: "police",
      base_url: "https://www.policia.es",
    },
    feed_url: "http://www.policia.es/rss/alertas.xml",
    category: "cyber_advisory",
    region_tag: "ES",
    lat: 40.42,
    lng: -3.7,
  },
  {
    type: "rss",
    source: {
      source_id: "s10",
      authority_name: "BSI Citizen CERT",
      country: "Germany",
      country_code: "DE",
      region: "Europe",
      authority_type: "cert",
      base_url: "https://www.bsi.bund.de",
    },
    feed_url:
      "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed_BuergerCERT.xml",
    category: "cyber_advisory",
    region_tag: "DE",
    lat: 50.73,
    lng: 7.1,
  },
  {
    type: "rss",
    source: {
      source_id: "s11",
      authority_name: "BSI Cyber News",
      country: "Germany",
      country_code: "DE",
      region: "Europe",
      authority_type: "cert",
      base_url: "https://www.bsi.bund.de",
    },
    feed_url:
      "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed_WID.xml",
    category: "cyber_advisory",
    region_tag: "DE",
    lat: 50.73,
    lng: 7.1,
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

function inferSeverity(title, fallback) {
  const normalized = title.toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  if (normalized.includes("low")) return "low";
  return fallback;
}

function defaultSeverity(category) {
  switch (category) {
    case "cyber_advisory":
      return "high";
    case "public_appeal":
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

function hashId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function kevItemToAlert(entry, meta) {
  const cve = entry.cveID ?? entry.cveId ?? entry.cve;
  const title = `${cve ?? "CVE"}: ${entry.vulnerabilityName ?? "Known Exploited Vulnerability"}`;
  const nvdLink = cve ? `https://nvd.nist.gov/vuln/detail/${cve}` : meta.source.base_url;
  const publishedAt = parseDate(entry.dateAdded) ?? new Date();
  const now = new Date();
  const hours = Math.max(1, Math.round((now - publishedAt) / 36e5));
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
    severity: "high",
    region_tag: meta.region_tag,
    lat: meta.lat,
    lng: meta.lng,
    freshness_hours: hours,
    reporting: meta.reporting,
  };
}

async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "osint-siem-bot/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`feed fetch failed ${response.status} ${url}`);
  }
  return response.text();
}

async function fetchRss(meta, now) {
  const xml = await fetchFeed(meta.feed_url);
  const items = parseItems(xml)
    .filter((item) => item.title && item.link)
    .slice(0, MAX_PER_SOURCE);

  return items.map((item) => {
    const publishedAt = parseDate(item.published) ?? now;
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
  });
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
  return vulnerabilities.slice(-MAX_PER_SOURCE).map((entry) => kevItemToAlert(entry, meta));
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
