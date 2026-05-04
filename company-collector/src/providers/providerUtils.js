const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}`);
  }

  return response.text();
}

export function cleanText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function makeAbsoluteUrl(baseUrl, candidateUrl) {
  if (!candidateUrl) {
    return "";
  }

  try {
    return new URL(candidateUrl, baseUrl).toString();
  } catch (error) {
    return "";
  }
}

export function slugifyQuery(input) {
  return [input.keyword, input.city, input.state].filter(Boolean).join(" ").trim();
}

export function normalizeWebsite(url) {
  const cleaned = String(url || "").trim();

  if (!cleaned) {
    return "";
  }

  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

  try {
    const parsed = new URL(candidate);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

export function extractDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

export function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return "";
}

export function splitCityState(value) {
  const cleaned = cleanText(value);
  const match = cleaned.match(/^(.*?)(?:,\s*|\s+)([A-Z]{2})$/);

  return {
    city: match?.[1]?.trim() || "",
    state: match?.[2]?.trim() || "",
  };
}

export function makeStableCompanyId(company) {
  const seed = [
    company.name,
    company.address,
    company.city,
    company.state,
    company.phone,
    company.website,
  ]
    .join("|")
    .toLowerCase();

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `cmp-${hash.toString(16).padStart(8, "0")}`;
}
