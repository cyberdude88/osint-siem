import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import crypto from "node:crypto";

const MAX_PER_SOURCE = Number.parseInt(process.env.MAX_PER_SOURCE ?? "6", 10);
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? "public/alerts.json";
const MAX_AGE_DAYS = Number.parseInt(process.env.MAX_AGE_DAYS ?? "90", 10);
const WATCH =
  process.argv.includes("--watch") || process.env.WATCH === "1";
const INTERVAL_MS = Number.parseInt(process.env.INTERVAL_MS ?? "900000", 10);

const US_STATE_CENTROIDS = {
  alabama: [32.806671, -86.79113],
  alaska: [61.370716, -152.404419],
  arizona: [33.729759, -111.431221],
  arkansas: [34.969704, -92.373123],
  california: [36.116203, -119.681564],
  colorado: [39.059811, -105.311104],
  connecticut: [41.597782, -72.755371],
  delaware: [39.318523, -75.507141],
  florida: [27.766279, -81.686783],
  georgia: [33.040619, -83.643074],
  hawaii: [21.094318, -157.498337],
  idaho: [44.240459, -114.478828],
  illinois: [40.349457, -88.986137],
  indiana: [39.849426, -86.258278],
  iowa: [42.011539, -93.210526],
  kansas: [38.5266, -96.726486],
  kentucky: [37.66814, -84.670067],
  louisiana: [31.169546, -91.867805],
  maine: [44.693947, -69.381927],
  maryland: [39.063946, -76.802101],
  massachusetts: [42.230171, -71.530106],
  michigan: [43.326618, -84.536095],
  minnesota: [45.694454, -93.900192],
  mississippi: [32.741646, -89.678696],
  missouri: [38.456085, -92.288368],
  montana: [46.921925, -110.454353],
  nebraska: [41.12537, -98.268082],
  nevada: [38.313515, -117.055374],
  "new hampshire": [43.452492, -71.563896],
  "new jersey": [40.298904, -74.521011],
  "new mexico": [34.840515, -106.248482],
  "new york": [42.165726, -74.948051],
  "north carolina": [35.630066, -79.806419],
  "north dakota": [47.528912, -99.784012],
  ohio: [40.388783, -82.764915],
  oklahoma: [35.565342, -96.928917],
  oregon: [44.572021, -122.070938],
  pennsylvania: [40.590752, -77.209755],
  "rhode island": [41.680893, -71.51178],
  "south carolina": [33.856892, -80.945007],
  "south dakota": [44.299782, -99.438828],
  tennessee: [35.747845, -86.692345],
  texas: [31.054487, -97.563461],
  utah: [40.150032, -111.862434],
  vermont: [44.045876, -72.710686],
  virginia: [37.769337, -78.169968],
  washington: [47.400902, -121.490494],
  "west virginia": [38.491226, -80.954453],
  wisconsin: [44.268543, -89.616508],
  wyoming: [42.755966, -107.30249],
  "district of columbia": [38.9072, -77.0369],
  "washington dc": [38.9072, -77.0369],
};

const US_STATE_ABBR_TO_NAME = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "new hampshire",
  NJ: "new jersey",
  NM: "new mexico",
  NY: "new york",
  NC: "north carolina",
  ND: "north dakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhode island",
  SC: "south carolina",
  SD: "south dakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "west virginia",
  WI: "wisconsin",
  WY: "wyoming",
  DC: "district of columbia",
};

const US_STATE_ALT_TOKENS = {
  fla: "florida",
  calif: "california",
  penn: "pennsylvania",
  penna: "pennsylvania",
  wisc: "wisconsin",
  minn: "minnesota",
  colo: "colorado",
  ariz: "arizona",
  mich: "michigan",
  mass: "massachusetts",
  conn: "connecticut",
  ill: "illinois",
  tex: "texas",
  wash: "washington",
  ore: "oregon",
  okla: "oklahoma",
  "n mex": "new mexico",
  "n dak": "north dakota",
  "s dak": "south dakota",
  "n car": "north carolina",
  "s car": "south carolina",
  "w va": "west virginia",
};

// ─── AGENCY FEEDS ───────────────────────────────────────────────
// Organized by: CISA | FBI | INTERPOL | EUROPOL | NCSC | POLICE (region) | PUBLIC SAFETY
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
  {
    type: "rss",
    source: {
      source_id: "fbi-wanted",
      authority_name: "FBI Wanted",
      country: "United States",
      country_code: "US",
      region: "North America",
      authority_type: "police",
      base_url: "https://www.fbi.gov",
    },
    feed_url: "https://www.fbi.gov/feeds/all-wanted/rss.xml",
    category: "wanted_suspect",
    region_tag: "US",
    lat: 38.9,
    lng: -77.0,
    reporting: {
      label: "Submit a Tip to FBI",
      url: "https://tips.fbi.gov/",
      phone: "1-800-CALL-FBI (1-800-225-5324)",
      notes: "Use 911 for emergencies.",
    },
  },

  // ── INTERPOL (International) ──────────────────────────────────
  {
    type: "interpol-red-json",
    source: {
      source_id: "interpol-red",
      authority_name: "INTERPOL Red Notices",
      country: "France",
      country_code: "FR",
      region: "International",
      authority_type: "police",
      base_url: "https://www.interpol.int",
    },
    feed_url: "https://ws-public.interpol.int/notices/v1/red?resultPerPage=20",
    category: "wanted_suspect",
    region_tag: "INT",
    lat: 45.76,
    lng: 4.84,
    reporting: {
      label: "Contact INTERPOL",
      url: "https://www.interpol.int/Contacts",
      notes: "Use official national police channels for emergencies.",
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

function hashToUnit(value) {
  const hex = crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(hex, 16) / 0xffffffff;
}

function jitterCoords(lat, lng, seed, minRadiusKm = 22, maxRadiusKm = 77) {
  // Spread alerts around a base point so multiple notices don't collapse into one dot.
  const angle = hashToUnit(`${seed}:a`) * Math.PI * 2;
  const radiusKm = minRadiusKm + hashToUnit(`${seed}:r`) * Math.max(1, maxRadiusKm - minRadiusKm);
  const dLat = (radiusKm / 111.32) * Math.cos(angle);
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLng = (radiusKm / (111.32 * cosLat)) * Math.sin(angle);
  const outLat = Math.max(-89.5, Math.min(89.5, lat + dLat));
  let outLng = lng + dLng;
  if (outLng > 180) outLng -= 360;
  if (outLng < -180) outLng += 360;
  return { lat: Number(outLat.toFixed(5)), lng: Number(outLng.toFixed(5)) };
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferUSStateCoords(text) {
  const haystackRaw = ` ${String(text ?? "").toLowerCase()} `;
  const haystack = haystackRaw.replace(/\./g, " ");

  // Match common two-letter forms like (FL), , FL, " - FL "
  for (const [abbr, name] of Object.entries(US_STATE_ABBR_TO_NAME)) {
    const abbrPattern = new RegExp(`(?:^|[^a-z])\\(?${abbr.toLowerCase()}\\)?(?:[^a-z]|$)`, "i");
    if (abbrPattern.test(haystack)) {
      const coords = US_STATE_CENTROIDS[name];
      if (coords) return { lat: coords[0], lng: coords[1] };
    }
  }

  // Match short textual forms like "Fla", "Calif", etc.
  for (const [token, name] of Object.entries(US_STATE_ALT_TOKENS)) {
    const altPattern = new RegExp(`\\b${escapeRegex(token).replace(/\s+/g, "\\s+")}\\b`, "i");
    if (altPattern.test(haystack)) {
      const coords = US_STATE_CENTROIDS[name];
      if (coords) return { lat: coords[0], lng: coords[1] };
    }
  }

  const entries = Object.entries(US_STATE_CENTROIDS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, [lat, lng]] of entries) {
    const pattern = new RegExp(`\\b${escapeRegex(name).replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(haystack)) {
      return { lat, lng };
    }
  }
  return null;
}

function resolveCoords(meta, text, seed) {
  const inferredUS =
    meta.source.country_code === "US" ? inferUSStateCoords(text) : null;
  if (inferredUS) {
    return jitterCoords(inferredUS.lat, inferredUS.lng, seed, 10, 35);
  }
  return jitterCoords(meta.lat, meta.lng, seed);
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
  const jitter = resolveCoords(
    meta,
    `${title} ${nvdLink}`,
    `${meta.source.source_id}:${nvdLink}:${cve ?? ""}`
  );
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
    lat: jitter.lat,
    lng: jitter.lng,
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
    const jitter = resolveCoords(
      meta,
      `${item.title} ${item.link}`,
      `${meta.source.source_id}:${item.link}`
    );
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
      lat: jitter.lat,
      lng: jitter.lng,
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

async function fetchInterpolRed(meta, now) {
  const response = await fetch(meta.feed_url, {
    headers: {
      "User-Agent": "osint-siem-bot/1.0",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`interpol fetch failed ${response.status} ${meta.feed_url}`);
  }
  const data = await response.json();
  const notices = Array.isArray(data?._embedded?.notices) ? data._embedded.notices : [];

  return notices.slice(0, MAX_PER_SOURCE).map((notice) => {
    const forename = String(notice.forename ?? "").trim();
    const name = String(notice.name ?? "").trim();
    const label = [forename, name].filter(Boolean).join(" ");
    const rawHref = String(notice?._links?.self?.href ?? "").trim();
    const canonicalUrl = rawHref
      ? new URL(rawHref, "https://ws-public.interpol.int").toString()
      : meta.source.base_url;
    const title = label
      ? `INTERPOL Red Notice: ${label}`
      : "INTERPOL Red Notice";
    const jitter = resolveCoords(
      meta,
      `${title} ${canonicalUrl}`,
      `${meta.source.source_id}:${canonicalUrl}`
    );
    return {
      alert_id: `${meta.source.source_id}-${hashId(canonicalUrl + title)}`,
      source_id: meta.source.source_id,
      source: meta.source,
      title,
      canonical_url: canonicalUrl,
      first_seen: now.toISOString(),
      last_seen: now.toISOString(),
      status: "active",
      category: meta.category,
      severity: "critical",
      region_tag: meta.region_tag,
      lat: jitter.lat,
      lng: jitter.lng,
      freshness_hours: 1,
      reporting: meta.reporting,
    };
  });
}

async function buildAlerts() {
  const now = new Date();
  const alerts = [];

  for (const entry of sources) {
    try {
      const batch =
        entry.type === "kev-json"
          ? await fetchKev(entry)
          : entry.type === "interpol-red-json"
          ? await fetchInterpolRed(entry, now)
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
