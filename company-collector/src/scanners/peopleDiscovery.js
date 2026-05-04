const REQUEST_TIMEOUT_MS = 8000;
const MAX_RESULTS_PER_QUERY = 5;
const PRIORITY_TITLES = [
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
  "job search",
  "search jobs",
  "careers",
  "jobs",
  "linkedin",
  "staffing",
]);

export async function discoverDecisionMakerContacts({
  companyName,
  website,
  city = "",
  state = "",
}) {
  const normalizedCompanyName = String(companyName || "").trim();
  const domain = getWebsiteDomain(website);

  if (!normalizedCompanyName) {
    return [];
  }

  const candidates = [];
  const queries = buildQueries({
    companyName: normalizedCompanyName,
    city,
    state,
  });

  for (const query of queries) {
    const results = await searchGoogleResults(query);
    for (const result of results) {
      candidates.push(
        ...(await mapSearchResultToContacts({
          result,
          companyName: normalizedCompanyName,
          domain,
        }))
      );
    }
  }

  return dedupeCandidates(candidates);
}

function buildQueries({ companyName, city, state }) {
  const location = [city, state].filter(Boolean).join(" ").trim();

  return [
    `${companyName} staffing ${location} LinkedIn`,
    `${companyName} IT staffing sales manager`,
  ];
}

async function searchGoogleResults(query) {
  const apiKey = String(process.env.SERPAPI_KEY || "").trim();
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(MAX_RESULTS_PER_QUERY));
  url.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: createTimeoutSignal(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload?.organic_results) ? payload.organic_results : [];
  } catch (error) {
    return [];
  }
}

async function mapSearchResultToContacts({ result, companyName, domain }) {
  const link = String(result?.link || "").trim();
  const title = String(result?.title || "").trim();
  const snippet = String(result?.snippet || "").trim();
  const text = [title, snippet].filter(Boolean).join(" | ");

  if (!link) {
    return [];
  }

  if (isLinkedInProfileUrl(link)) {
    const metadata = await fetchLinkedInMetadata(link);
    const name = metadata.name || extractNameFromSearchText(text);
    const roleTitle = metadata.title || extractPriorityTitle(text);

    if (!isValidPersonCandidate(name, companyName) || !roleTitle) {
      return [];
    }

    return [
      buildDecisionMakerContact({
        companyName,
        domain,
        name,
        title: roleTitle,
        linkedinUrl: link,
        sourceUrl: link,
        evidence: snippet || title,
      }),
    ];
  }

  const name = extractNameFromSearchText(text);
  const roleTitle = extractPriorityTitle(text);

  if (!isValidPersonCandidate(name, companyName) || !roleTitle || isJobLikeUrl(link)) {
    return [];
  }

  return [
    buildDecisionMakerContact({
      companyName,
      domain,
      name,
      title: roleTitle,
      linkedinUrl: "",
      sourceUrl: link,
      evidence: snippet || title,
    }),
  ];
}

async function fetchLinkedInMetadata(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: createTimeoutSignal(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { name: "", title: "" };
    }

    const html = await response.text();
    const metaTitle = extractMetaContent(html, "property", "og:title") || extractTitleTag(html);
    const metaDescription =
      extractMetaContent(html, "name", "description") ||
      extractMetaContent(html, "property", "og:description");

    return {
      name: extractNameFromSearchText(metaTitle),
      title: extractPriorityTitle([metaTitle, metaDescription].filter(Boolean).join(" | ")),
    };
  } catch (error) {
    return { name: "", title: "" };
  }
}

function buildDecisionMakerContact({
  companyName,
  domain,
  name,
  title,
  linkedinUrl,
  sourceUrl,
  evidence,
}) {
  const normalizedName = String(name || "").trim() || "Unknown";
  const normalizedTitle = String(title || "").trim() || "Website Contact";
  const guessedEmail = generateEmailGuess(normalizedName, domain);
  const hasVerifiedEmail = false;

  return {
    name: normalizedName,
    title: normalizedTitle,
    email: guessedEmail.email,
    phone: "",
    linkedin_url: linkedinUrl,
    contact_page_url: sourceUrl,
    source_url: sourceUrl,
    confidence_score: hasVerifiedEmail
      ? 95
      : guessedEmail.email
        ? 85
        : linkedinUrl
          ? 75
          : 55,
    evidence_summary: buildEvidenceSummary({
      companyName,
      title: normalizedTitle,
      sourceUrl,
      evidence,
      guessedEmail,
    }),
    extraction_method: "google_people",
    email_confidence: guessedEmail.email ? "guessed" : linkedinUrl ? "linkedin_only" : "missing",
    is_email_guessed: Boolean(guessedEmail.email),
    email_guess_pattern: guessedEmail.pattern,
    decision_maker: isDecisionMakerTitle(normalizedTitle),
  };
}

function generateEmailGuess(name, domain) {
  const safeDomain = String(domain || "").trim().toLowerCase();
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 2 || !safeDomain) {
    return { email: "", pattern: "", options: [] };
  }

  const [firstName, ...rest] = parts;
  const lastName = rest[rest.length - 1];
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z]/g, "");

  if (!first || !last) {
    return { email: "", pattern: "", options: [] };
  }

  const options = [
    `${first}@${safeDomain}`,
    `${first}.${last}@${safeDomain}`,
    `${first.charAt(0)}${last}@${safeDomain}`,
  ];

  return {
    email: options[1] || options[0] || "",
    pattern: "firstname.lastname",
    options,
  };
}

function getWebsiteDomain(website) {
  try {
    const url = new URL(String(website || "").trim());
    return url.hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function isLinkedInProfileUrl(url) {
  return /linkedin\.com\/in\//i.test(String(url || ""));
}

function extractNameFromSearchText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const match = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  return match?.[1]?.trim() || "";
}

function isValidPersonCandidate(name, companyName) {
  const candidate = String(name || "").trim();
  const normalizedCandidate = candidate.toLowerCase();
  const normalizedCompany = String(companyName || "").trim().toLowerCase();

  if (!candidate) {
    return false;
  }

  if (INVALID_NAME_PHRASES.has(normalizedCandidate)) {
    return false;
  }

  if (normalizedCompany && normalizedCandidate.includes(normalizedCompany)) {
    return false;
  }

  if (candidate.split(/\s+/).length < 2) {
    return false;
  }

  return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(candidate);
}

function isJobLikeUrl(url) {
  const value = String(url || "").toLowerCase();
  return value.includes("/jobs") || value.includes("/careers") || value.includes("job");
}

function extractPriorityTitle(value) {
  const text = String(value || "");
  const matchedPattern = PRIORITY_TITLES.find((pattern) =>
    text.toLowerCase().includes(pattern)
  );

  if (!matchedPattern) {
    return "";
  }

  const regex = new RegExp(`([A-Za-z/& ,.-]*${escapeRegExp(matchedPattern)}[A-Za-z/& ,.-]*)`, "i");
  const candidate = text.match(regex)?.[1]?.trim() || matchedPattern;
  return titleCase(candidate);
}

function extractMetaContent(html, attributeName, attributeValue) {
  const regex = new RegExp(
    `<meta[^>]*${attributeName}=["']${escapeRegExp(attributeValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return html.match(regex)?.[1]?.trim() || "";
}

function extractTitleTag(html) {
  return String(html || "").match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
}

function buildEvidenceSummary({ companyName, title, sourceUrl, evidence, guessedEmail }) {
  const parts = [
    companyName ? `company: ${companyName}` : "",
    title ? `title: ${title}` : "",
    guessedEmail.email ? `guessed email: ${guessedEmail.email}` : "",
    sourceUrl ? `source: ${sourceUrl}` : "",
    evidence ? `evidence: ${String(evidence).slice(0, 160)}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function dedupeCandidates(candidates) {
  const byKey = new Map();

  candidates.forEach((candidate) => {
    const key = [
      String(candidate.linkedin_url || "").toLowerCase(),
      String(candidate.email || "").toLowerCase(),
      String(candidate.name || "").toLowerCase(),
      String(candidate.title || "").toLowerCase(),
    ]
      .filter(Boolean)
      .join("|");

    if (!key) {
      return;
    }

    const existing = byKey.get(key);
    if (!existing || Number(candidate.confidence_score || 0) > Number(existing.confidence_score || 0)) {
      byKey.set(key, candidate);
    }
  });

  return [...byKey.values()];
}

function isDecisionMakerTitle(title) {
  const normalizedTitle = String(title || "").toLowerCase();
  return PRIORITY_TITLES.some((pattern) => normalizedTitle.includes(pattern));
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
