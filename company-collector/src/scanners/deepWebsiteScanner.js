import { extractContactsWithAi, isAiExtractionEnabled } from "./aiExtractor.js";
import { dedupeAndEnrichContacts, isValidEmail } from "../contacts/contactQuality.js";
import { discoverDecisionMakerContacts } from "./peopleDiscovery.js";

const LINK_KEYWORDS = [
  "contact",
  "about",
  "team",
  "leadership",
  "staff",
  "management",
  "sales",
  "recruiting",
  "employers",
  "clients",
  "vendors",
  "partners",
];
const MAX_INTERNAL_LINKS = 5;
const REQUEST_TIMEOUT_MS = 8000;
const TITLE_PATTERNS = [
  "business development",
  "sales",
  "account manager",
  "client partner",
  "vendor manager",
  "recruiting manager",
  "talent acquisition",
  "director",
  "vp",
  "vice president",
  "founder",
  "ceo",
];
const INVALID_NAME_PHRASES = new Set([
  "read more",
  "learn more",
  "contact us",
  "featured jobs",
  "search jobs",
]);
const GENERIC_EMAIL_PREFIXES = new Set([
  "privacy",
  "support",
  "info",
  "help",
  "admin",
  "hello",
  "noreply",
  "no-reply",
  "webmaster",
]);

export async function deepScanWebsite(website, options = {}) {
  const companyName = options.companyName || "Unknown";
  const city = options.city || "";
  const state = options.state || "";
  const normalizedWebsite = normalizeWebsite(website);

  if (!normalizedWebsite) {
    return {
      success: false,
      contacts: [],
      scanned_urls: [],
      status: "needs_review",
      error: "A valid website URL is required.",
    };
  }

  const homepageResult = await fetchPage(normalizedWebsite);

  if (!homepageResult.success) {
    return {
      success: false,
      contacts: [],
      scanned_urls: [],
      status: "needs_review",
      error: "Website scan blocked. Use backend scanner later.",
    };
  }

  const internalLinks = findLikelyInternalLinks(homepageResult.url, homepageResult.html).slice(
    0,
    MAX_INTERNAL_LINKS
  );

  const pages = [homepageResult];

  for (const url of internalLinks) {
    const pageResult = await fetchPage(url);
    if (pageResult.success) {
      pages.push(pageResult);
    }
  }

  const scannedUrls = dedupe(pages.map((page) => page.url));
  const contacts = dedupeAndEnrichContacts(
    await extractContactsFromPages({
      companyName,
      website: normalizedWebsite,
      pages,
      city,
      state,
    })
  );

  return {
    success: true,
    contacts,
    scanned_urls: scannedUrls,
    status: contacts.length > 0 ? "contacts_found" : "needs_review",
    error: null,
  };
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: createTimeoutSignal(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with ${response.status}`);
    }

    return {
      success: true,
      url: response.url || url,
      html: await response.text(),
    };
  } catch (error) {
    return {
      success: false,
      url,
      html: "",
    };
  }
}

async function extractContactsFromPages({ companyName, website, pages, city, state }) {
  const allContacts = [];

  for (const page of pages) {
    const regexContacts = extractContactsFromHtml(page.html, page.url, companyName);
    allContacts.push(...regexContacts);

    if (!isAiExtractionEnabled()) {
      continue;
    }

    const pageText = extractPageText(page.html);
    if (!pageText) {
      continue;
    }

    const aiContacts = await extractContactsWithAi({
      companyName,
      website,
      pageUrl: page.url,
      pageText,
    });

    if (aiContacts.length > 0) {
      allContacts.push(...aiContacts);
    }
  }

  const discoveredContacts = await discoverDecisionMakerContacts({
    companyName,
    website,
    city,
    state,
  });

  if (discoveredContacts.length > 0) {
    allContacts.push(...discoveredContacts);
  }

  return allContacts;
}

function findLikelyInternalLinks(baseUrl, html) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(String(html || "")))) {
    const href = match[1];
    const anchorText = stripHtml(match[2]).toLowerCase();
    const hrefText = String(href || "").toLowerCase();

    if (!LINK_KEYWORDS.some((keyword) => anchorText.includes(keyword) || hrefText.includes(keyword))) {
      continue;
    }

    const absoluteUrl = toInternalAbsoluteUrl(baseUrl, href);
    if (absoluteUrl) {
      links.push(absoluteUrl);
    }
  }

  return dedupe(links);
}

function toInternalAbsoluteUrl(baseUrl, href) {
  try {
    const base = new URL(baseUrl);
    const candidate = new URL(href, base);

    if (!["http:", "https:"].includes(candidate.protocol)) {
      return "";
    }

    if (candidate.hostname !== base.hostname) {
      return "";
    }

    candidate.hash = "";
    return candidate.toString();
  } catch (error) {
    return "";
  }
}

function extractContactsFromHtml(html, sourceUrl, companyName) {
  const pageText = extractPageText(html);
  const textBlocks = createTextBlocks(pageText);
  const emails = prioritizeEmails(extractEmails(`${html} ${pageText}`));
  const phones = extractPhones(pageText);
  const linkedInUrls = extractLinkedInUrls(html);
  const length = Math.max(emails.length, phones.length);
  const contacts = [];
  const pageConfidence = getSourceConfidence(sourceUrl);

  for (let index = 0; index < length; index += 1) {
    const email = emails[index] || "";
    const phone = phones[index] || "";
    const context = findBestContextForContact({
      textBlocks,
      email,
      phone,
    });
    const linkedInUrl =
      context.linkedin_url ||
      linkedInUrls.find((url) => matchesLikelyPersonLinkedIn(url, context.name, companyName)) ||
      "";

    contacts.push({
      name: context.name || "Unknown",
      title: context.title || "Website Contact",
      email,
      phone,
      linkedin_url: linkedInUrl,
      contact_page_url: sourceUrl,
      source_url: sourceUrl,
      confidence_score: estimateRegexConfidence({
        name: context.name,
        title: context.title,
        email,
        phone,
        isGenericEmailValue: isGenericEmail(email),
      }),
      evidence_summary: buildEvidenceSummary({
        name: context.name,
        title: context.title,
        email,
        phone,
        pageUrl: sourceUrl,
      }),
      extraction_method: "regex",
    });
  }

  const structuredContacts = extractStructuredBlocks(textBlocks, linkedInUrls, sourceUrl);
  return [...contacts, ...structuredContacts].filter((contact) => contact.email || contact.phone);
}

function extractEmails(content) {
  const matches =
    String(content || "").match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi) || [];
  return dedupe(
    matches
      .map((value) => value.toLowerCase().replace(/[)"'>,;:]+$/, ""))
      .filter(isValidEmail)
  );
}

function prioritizeEmails(emails) {
  const specificEmails = emails.filter((email) => !isGenericEmail(email));
  return specificEmails.length > 0 ? specificEmails : emails;
}

function isGenericEmail(email) {
  const localPart = String(email || "").split("@")[0].toLowerCase();
  return GENERIC_EMAIL_PREFIXES.has(localPart);
}

function extractPhones(content) {
  const matches =
    String(content || "").match(/(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?[2-9]\d{2}[-.\s]?\d{4}/g) || [];

  return dedupe(
    matches
      .map((value) => formatPhone(value))
      .filter(Boolean)
  );
}

function extractLinkedInUrls(content) {
  const matches =
    String(content || "").match(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/[A-Za-z0-9\-_/%.?=&]+/gi) || [];
  return dedupe(matches.map((value) => value.replace(/[)"'>.,]+$/, "")));
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalizedDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (!isValidUsPhone(normalizedDigits)) {
    return "";
  }

  return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`;
}

function isValidUsPhone(digits) {
  if (digits.length !== 10) {
    return false;
  }

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  const line = digits.slice(6);

  if (!/^[2-9]\d{2}$/.test(area) || !/^[2-9]\d{2}$/.test(exchange)) {
    return false;
  }

  if (new Set(digits).size < 3) {
    return false;
  }

  if (line === "0000") {
    return false;
  }

  return true;
}

function normalizeWebsite(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).toString();
  } catch (error) {
    try {
      return new URL(`https://${raw}`).toString();
    } catch (secondError) {
      return "";
    }
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPageText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createTextBlocks(pageText) {
  return String(pageText || "")
    .split(/\s{2,}|(?<=\.)\s+(?=[A-Z])|\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length >= 12)
    .slice(0, 250);
}

function findBestContextForContact({ textBlocks, email, phone }) {
  const directMatch = textBlocks.find((block) => {
    return (email && block.toLowerCase().includes(email.toLowerCase())) || (phone && block.includes(phone));
  });

  if (!directMatch) {
    return {
      name: "",
      title: findLikelyTitle(textBlocks.join(" ")),
      linkedin_url: "",
    };
  }

  return {
    name: findLikelyName(directMatch),
    title: findLikelyTitle(directMatch),
    linkedin_url: "",
  };
}

function extractStructuredBlocks(textBlocks, linkedInUrls, sourceUrl) {
  return textBlocks
    .map((block) => {
      const email = extractEmails(block)[0] || "";
      const phone = extractPhones(block)[0] || "";
      const name = findLikelyName(block);
      const title = findLikelyTitle(block);

      if (!email && !phone) {
        return null;
      }

      return {
        name: name || "Unknown",
        title: title || "Website Contact",
        email,
        phone,
        linkedin_url:
          linkedInUrls.find((url) => matchesLikelyPersonLinkedIn(url, name, "")) || "",
        contact_page_url: sourceUrl,
        source_url: sourceUrl,
        confidence_score: estimateRegexConfidence({
          name,
          title,
          email,
          phone,
          isGenericEmailValue: isGenericEmail(email),
        }),
        evidence_summary: buildEvidenceSummary({
          name,
          title,
          email,
          phone,
          pageUrl: sourceUrl,
        }),
        extraction_method: "regex",
      };
    })
    .filter(Boolean);
}

function findLikelyName(block) {
  const value = String(block || "").trim();
  const normalized = value.toLowerCase();

  if (!value || INVALID_NAME_PHRASES.has(normalized)) {
    return "";
  }

  const match = value.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/
  );

  if (!match) {
    return "";
  }

  const candidate = match[1].trim();
  const normalizedCandidate = candidate.toLowerCase();
  if (
    INVALID_NAME_PHRASES.has(normalizedCandidate) ||
    TITLE_PATTERNS.some((pattern) => normalizedCandidate.includes(pattern))
  ) {
    return "";
  }

  return candidate;
}

function findLikelyTitle(block) {
  const value = String(block || "");
  const matchedPattern = TITLE_PATTERNS.find((pattern) => value.toLowerCase().includes(pattern));

  if (!matchedPattern) {
    return "";
  }

  const regex = new RegExp(`([A-Za-z/&, ]*${escapeRegExp(matchedPattern)}[A-Za-z/&, ]*)`, "i");
  const candidate = value.match(regex)?.[1]?.trim() || titleCase(matchedPattern);

  if (candidate.length > 80 || /\b(read more|search jobs|featured jobs)\b/i.test(candidate)) {
    return titleCase(matchedPattern);
  }

  return candidate;
}

function matchesLikelyPersonLinkedIn(url, name, companyName) {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedName = String(name || "").toLowerCase().replace(/\s+/g, "-");
  const normalizedCompany = String(companyName || "").toLowerCase();

  if (!normalizedUrl.includes("/in/")) {
    return false;
  }

  if (normalizedName && normalizedUrl.includes(normalizedName)) {
    return true;
  }

  return normalizedCompany && normalizedUrl.includes(normalizedCompany);
}

function estimateRegexConfidence({ name, title, email, phone, isGenericEmailValue }) {
  if (name && title && email) {
    return 95;
  }

  if (email && (title || !isGenericEmailValue)) {
    return 85;
  }

  if (email && isGenericEmailValue) {
    return 75;
  }

  if (phone && !email) {
    return 55;
  }

  return 45;
}

function buildEvidenceSummary({ name, title, email, phone, pageUrl }) {
  const parts = [
    name ? `name: ${name}` : "",
    title ? `title: ${title}` : "",
    email ? `email: ${email}` : "",
    phone ? `phone: ${phone}` : "",
    pageUrl ? `page: ${pageUrl}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function getSourceConfidence(sourceUrl) {
  const url = String(sourceUrl || "").toLowerCase();

  if (url.includes("contact")) {
    return 0.92;
  }

  if (url.includes("team") || url.includes("leadership") || url.includes("staff")) {
    return 0.88;
  }

  if (url.includes("about") || url.includes("sales")) {
    return 0.84;
  }

  return 0.8;
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timeoutId), { once: true });
  return controller.signal;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
