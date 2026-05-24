import {
  cleanText,
  extractDomainFromUrl,
  fetchHtml,
  makeAbsoluteUrl,
  normalizeWebsite,
  slugifyQuery,
} from "./providerUtils.js";

export function createFallbackSearchProvider() {
  return {
    id: "fallback_search",
    isEnabled: () => true,
    async search(input) {
      const businessQuery = `${slugifyQuery(input)} company business website phone`;
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(businessQuery)}`;
      const html = await fetchHtml(searchUrl);
      const results = html
        .split('<div class="result results_links')
        .slice(1)
        .map((chunk) => `<div class="result results_links${chunk}`);

      return results
        .map((resultHtml) => parseFallbackResult(resultHtml, searchUrl, input))
        .filter(Boolean);
    },
  };
}

function parseFallbackResult(resultHtml, searchUrl, input) {
  const title = extractMatch(resultHtml, /class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
  const href = extractMatch(resultHtml, /class="result__a"[^>]*href="([^"]+)"/i);
  const snippet = extractMatch(
    resultHtml,
    /class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i
  );
  const visibleUrl = extractMatch(
    resultHtml,
    /class="result__url"[^>]*>([\s\S]*?)<\/a>|class="result__url"[^>]*>([\s\S]*?)<\/span>/i
  );

  const sourceUrl = decodeDuckDuckGoRedirect(href);
  const website = normalizeWebsite(sourceUrl || visibleUrl);
  const domain = extractDomainFromUrl(website);
  const cleanTitleValue = cleanCompanyName(title);

  if (!title || !website || isBlockedDomain(domain) || isDirectoryStyleResult(title, snippet)) {
    return null;
  }

  const companyName = isGenericTitle(cleanTitleValue, input) ? buildNameFromDomain(domain) : cleanTitleValue;

  if (!companyName) {
    return null;
  }

  return {
    name: companyName,
    address: extractAddress(snippet),
    city: input.city,
    state: input.state,
    phone: extractPhone(`${title} ${snippet}`),
    website,
    source: "fallback_search",
    source_url: sourceUrl || makeAbsoluteUrl("https://html.duckduckgo.com", searchUrl),
    keyword: input.keyword,
    confidence_score: calculateConfidence({ title, snippet, domain, input }),
  };
}

function extractMatch(value, pattern) {
  const match = value.match(pattern);
  return match?.[1] || match?.[2] || "";
}

function decodeDuckDuckGoRedirect(url) {
  if (!url) {
    return "";
  }

  try {
    const absolute = new URL(url, "https://html.duckduckgo.com");
    const uddg = absolute.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : absolute.toString();
  } catch (error) {
    return "";
  }
}

function cleanCompanyName(value) {
  return cleanText(value)
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+\|\s+.*$/, "")
    .trim();
}

function extractPhone(value) {
  const match = String(value || "").match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  return match?.[1] || "";
}

function extractAddress(value) {
  const match = cleanText(value).match(/\d{1,6}[^,]+(?:,\s*[^,]+){1,3}/);
  const address = match?.[0] || "";
  return address.length > 90 ? "" : address;
}

function calculateConfidence({ title, snippet, domain, input }) {
  let score = 0.52;
  const haystack = `${cleanText(title)} ${cleanText(snippet)} ${domain}`.toLowerCase();

  if (haystack.includes(input.keyword.toLowerCase())) {
    score += 0.14;
  }

  if (haystack.includes("staffing") || haystack.includes("consulting") || haystack.includes("recruit")) {
    score += 0.12;
  }

  if (haystack.includes(input.city.toLowerCase()) || haystack.includes(input.state.toLowerCase())) {
    score += 0.08;
  }

  if (extractPhone(snippet)) {
    score += 0.05;
  }

  return Math.min(Number(score.toFixed(2)), 0.89);
}

function isBlockedDomain(domain) {
  const blocked = new Set([
    "clutch.co",
    "yellowpages.com",
    "yelp.com",
    "mapquest.com",
    "facebook.com",
    "linkedin.com",
    "instagram.com",
    "duckduckgo.com",
    "manta.com",
    "opencorporates.com",
    "glassdoor.com",
    "indeed.com",
    "zoominfo.com",
    "bizapedia.com",
    "chamberofcommerce.com",
  ]);

  return blocked.has(domain);
}

function isDirectoryStyleResult(title, snippet) {
  const text = `${cleanText(title)} ${cleanText(snippet)}`.toLowerCase();
  return (
    text.includes("top staffing firms") ||
    text.includes("best staffing firms") ||
    text.includes("compare companies") ||
    text.includes("reviews of") ||
    text.includes("directory") ||
    text.includes("list of") ||
    text.includes("near me")
  );
}

function isGenericTitle(title, input) {
  const normalized = cleanText(title).toLowerCase();
  const city = input.city.toLowerCase();
  const state = input.state.toLowerCase();

  return (
    normalized.startsWith("it staffing") ||
    normalized.startsWith(`${city} it staffing`) ||
    normalized.includes(` in ${city}`) ||
    normalized.endsWith(` ${city}`) ||
    normalized.endsWith(` ${state}`) ||
    normalized.includes("staffing agency") ||
    normalized.includes("recruitment agency") ||
    normalized.includes("staffing firm") ||
    normalized.includes("staffing services") ||
    normalized.includes("recruiting firm")
  );
}

function buildNameFromDomain(domain) {
  const base = String(domain || "")
    .replace(/\.(com|net|org|io|ai|co|biz|us)$/i, "")
    .split(".")
    .pop();

  if (!base) {
    return "";
  }

  return base
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
