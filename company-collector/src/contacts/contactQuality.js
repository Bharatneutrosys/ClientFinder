const JUNK_EMAIL_PREFIXES = new Set([
  "privacy",
  "noreply",
  "no-reply",
  "careers",
  "support",
]);

const GENERIC_EMAIL_PREFIXES = new Set([
  "info",
  "sales",
  "hello",
  "contact",
  "admin",
  "office",
  "hr",
  ...JUNK_EMAIL_PREFIXES,
]);

const SOURCE_KEYWORDS = [
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

const PRIORITY_TITLE_PATTERNS = [
  "owner",
  "principal",
  "partner",
  "president",
  "chief executive",
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

const VALID_EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const INVALID_EMAIL_TLDS = new Set([
  "apng",
  "avif",
  "gif",
  "ico",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

export function enrichContactQuality(contact) {
  const normalizedEmail = normalizeEmail(contact?.email);
  const normalized = {
    ...contact,
    name: normalizeName(contact?.name),
    title: normalizeTitle(contact?.title),
    email: normalizedEmail,
    phone: normalizePhone(contact?.phone),
    source_url: String(contact?.source_url || "").trim(),
    linkedin_url: normalizeLinkedInUrl(contact?.linkedin_url),
    contact_page_url: String(contact?.contact_page_url || contact?.source_url || "").trim(),
    confidence_score: clampConfidence(contact?.confidence_score),
    email_confidence: normalizeEmailConfidence(contact?.email_confidence),
    email_status: normalizeEmailStatus(contact?.email_status),
    is_email_guessed: Boolean(normalizedEmail && contact?.is_email_guessed),
    email_guess_pattern: String(contact?.email_guess_pattern || "").trim(),
    decision_maker: Boolean(contact?.decision_maker),
  };

  const emailPrefix = getEmailPrefix(normalized.email);
  const isJunkEmail = JUNK_EMAIL_PREFIXES.has(emailPrefix);
  const isGenericEmail = GENERIC_EMAIL_PREFIXES.has(emailPrefix);
  const hasName = normalized.name !== "Unknown";
  const hasTitle = normalized.title !== "Website Contact";
  const hasEmail = isValidEmail(normalized.email);
  const hasPhone = Boolean(normalized.phone);
  const hasLinkedIn = Boolean(normalized.linkedin_url);
  const hasPriorityTitle = isPriorityTitle(normalized.title);
  const isDecisionMaker = normalized.decision_maker || hasPriorityTitle;
  const hasStrongSourceValue = hasStrongSource(normalized.contact_page_url || normalized.source_url);
  const contactType = deriveContactType({
    hasName,
    hasTitle,
    hasEmail,
    hasPhone,
    isGenericEmail,
    hasLinkedIn,
  });
  const score = calculateConfidenceScore({
    hasName,
    hasTitle,
    hasEmail,
    hasPhone,
    hasLinkedIn,
    hasPriorityTitle,
    hasStrongSourceValue,
    isGenericEmail,
    isJunkEmail,
    isEmailGuessed: normalized.is_email_guessed,
    emailConfidence: normalized.email_confidence,
    contactType,
    existingConfidenceScore: normalized.confidence_score,
  });

  const qualityScore = clampScore(score);
  const qualityLabel = getQualityLabel(qualityScore);

  return {
    ...normalized,
    quality_score: qualityScore,
    quality_label: qualityLabel,
    priority_contact: hasPriorityTitle,
    is_generic_email: isGenericEmail,
    contact_type: contactType,
    confidence_score: qualityScore,
    email_confidence: deriveEmailConfidence({
      email: hasEmail ? normalized.email : "",
      isGenericEmail,
      isJunkEmail,
      isEmailGuessed: normalized.is_email_guessed,
      existingEmailConfidence: normalized.email_confidence,
    }),
    email_status: deriveEmailStatus({
      email: hasEmail ? normalized.email : "",
      isGenericEmail,
      isJunkEmail,
      isEmailGuessed: normalized.is_email_guessed,
      existingEmailStatus: normalized.email_status,
    }),
    is_email_guessed: normalized.is_email_guessed,
    email_guess_pattern: normalized.email_guess_pattern,
    decision_maker: isDecisionMaker,
  };
}

export function dedupeAndEnrichContacts(contacts) {
  const byIdentity = new Map();

  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    const enriched = enrichContactQuality(contact);
    if (!shouldKeepContact(enriched)) {
      return;
    }

    const emailKey = normalizeKey(enriched.email);
    const phoneKey = normalizePhoneKey(enriched.phone);
    const linkedInKey = normalizeKey(enriched.linkedin_url);
    const primaryKey = emailKey || phoneKey || linkedInKey;

    if (!primaryKey) {
      return;
    }

    const existing = byIdentity.get(primaryKey);
    if (!existing) {
      byIdentity.set(primaryKey, enriched);
      return;
    }

    byIdentity.set(primaryKey, mergeContacts(existing, enriched));
  });

  return [...byIdentity.values()];
}

export function isUsableContact(contact) {
  return shouldKeepContact(contact);
}

export function getQualityLabel(score) {
  if (score >= 80) {
    return "high_quality";
  }

  if (score >= 55) {
    return "medium_quality";
  }

  if (score >= 25) {
    return "needs_review";
  }

  return "junk";
}

export function normalizeEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();

  return isValidEmail(email) ? email : "";
}

export function isValidEmail(value) {
  const email = String(value || "").trim().toLowerCase();

  if (!email || email.length > 254 || !VALID_EMAIL_PATTERN.test(email)) {
    return false;
  }

  const [localPart, domain] = email.split("@");
  const domainParts = String(domain || "").split(".");
  const tld = domainParts.at(-1) || "";

  if (
    !localPart ||
    !domain ||
    localPart.includes("..") ||
    domain.includes("..") ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    INVALID_EMAIL_TLDS.has(tld)
  ) {
    return false;
  }

  return true;
}

export function normalizeLinkedInUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    return parsed.hostname.includes("linkedin.com") ? parsed.toString() : "";
  } catch (error) {
    return "";
  }
}

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return String(value || "").trim();
}

function mergeContacts(existing, incoming) {
  const preferred = incoming.quality_score > existing.quality_score ? incoming : existing;
  const secondary = preferred === incoming ? existing : incoming;

  return enrichContactQuality({
    ...secondary,
    ...preferred,
    name: pickBetterName(existing.name, incoming.name),
    title: pickBetterTitle(existing.title, incoming.title),
    email: existing.email || incoming.email,
    phone: existing.phone || incoming.phone,
    source_url: preferred.source_url || secondary.source_url,
    confidence_score: Math.max(existing.confidence_score || 0, incoming.confidence_score || 0),
    evidence_summary: preferred.evidence_summary || secondary.evidence_summary || "",
    extraction_method: pickExtractionMethod(existing.extraction_method, incoming.extraction_method),
    email_confidence: preferred.email_confidence || secondary.email_confidence || "missing",
    email_status: preferred.email_status || secondary.email_status || "none",
    is_email_guessed: Boolean(existing.is_email_guessed || incoming.is_email_guessed),
    email_guess_pattern: preferred.email_guess_pattern || secondary.email_guess_pattern || "",
    decision_maker: Boolean(existing.decision_maker || incoming.decision_maker),
    linkedin_url: preferred.linkedin_url || secondary.linkedin_url || "",
  });
}

function pickBetterName(first, second) {
  if (normalizeName(first) !== "Unknown") {
    return first;
  }

  return second || "Unknown";
}

function pickBetterTitle(first, second) {
  if (normalizeTitle(first) !== "Website Contact") {
    return first;
  }

  return second || "Website Contact";
}

function normalizeName(value) {
  const text = String(value || "").trim();
  return text || "Unknown";
}

function normalizeTitle(value) {
  const text = String(value || "").trim();
  return text || "Website Contact";
}

function getEmailPrefix(email) {
  return String(email || "").split("@")[0].toLowerCase();
}

function hasStrongSource(sourceUrl) {
  const url = String(sourceUrl || "").toLowerCase();
  return SOURCE_KEYWORDS.some((keyword) => url.includes(keyword));
}

function isPriorityTitle(title) {
  const value = String(title || "").toLowerCase();
  return PRIORITY_TITLE_PATTERNS.some((pattern) => value.includes(pattern));
}

function deriveContactType({ hasName, hasTitle, hasEmail, hasPhone, isGenericEmail, hasLinkedIn }) {
  if (hasEmail && isGenericEmail) {
    return "generic_company_contact";
  }

  if (hasName && hasTitle && hasEmail) {
    return "person_contact";
  }

  if (hasName && hasTitle && hasLinkedIn) {
    return "person_contact";
  }

  if (hasPhone && !hasEmail) {
    return "phone_only";
  }

  return "needs_review";
}

function calculateConfidenceScore({
  hasName,
  hasTitle,
  hasEmail,
  hasPhone,
  hasLinkedIn,
  hasPriorityTitle,
  hasStrongSourceValue,
  isGenericEmail,
  isJunkEmail,
  isEmailGuessed,
  emailConfidence,
  contactType,
  existingConfidenceScore,
}) {
  let score = 40;

  if (hasName && hasTitle && hasEmail && !isEmailGuessed && !isGenericEmail) {
    score = 95;
  } else if (hasName && hasTitle && hasEmail && isEmailGuessed) {
    score = 72;
  } else if (hasName && hasTitle && hasLinkedIn) {
    score = 70;
  } else if (hasEmail && isGenericEmail && !isJunkEmail) {
    score = 50;
  } else if (hasEmail && (hasTitle || hasPriorityTitle || hasStrongSourceValue)) {
    score = 85;
  } else if (hasPhone && !hasEmail) {
    score = 45;
  }

  if (hasPriorityTitle) {
    score += 6;
  }

  if (hasLinkedIn) {
    score += 4;
  }

  if (hasPhone && hasEmail) {
    score += 3;
  }

  if (hasStrongSourceValue) {
    score += 2;
  }

  if (isJunkEmail) {
    score -= 20;
  }

  if (emailConfidence === "guessed") {
    score = Math.min(score, 78);
  }

  if (isEmailGuessed) {
    score = Math.min(score, 78);
  }

  if (isGenericEmail) {
    score = Math.min(score, 62);
  }

  if (contactType === "needs_review") {
    score -= 10;
  }

  if (contactType === "phone_only") {
    score = Math.min(score, 55);
  }

  if (Number.isFinite(Number(existingConfidenceScore)) && Number(existingConfidenceScore) > 1) {
    const existingScore = Number(existingConfidenceScore);
    const maxTrustedExistingScore =
      contactType === "needs_review"
        ? 45
        : isEmailGuessed || isGenericEmail || isJunkEmail || contactType === "phone_only"
          ? 65
          : 100;
    score = Math.max(score, Math.min(existingScore, maxTrustedExistingScore));
  }

  return score;
}

function clampConfidence(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
      return 0;
  }

  if (numeric <= 1) {
    return Math.max(0, Math.min(100, Math.round(numeric * 100)));
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeEmailConfidence(value) {
  const allowedValues = new Set(["verified", "guessed", "generic", "linkedin_only", "missing"]);
  const normalizedValue = String(value || "").trim().toLowerCase();
  return allowedValues.has(normalizedValue) ? normalizedValue : "missing";
}

function normalizeEmailStatus(value) {
  const allowedValues = new Set(["verified", "guessed", "generic", "none"]);
  const normalizedValue = String(value || "").trim().toLowerCase();
  return allowedValues.has(normalizedValue) ? normalizedValue : "none";
}

function deriveEmailConfidence({
  email,
  isGenericEmail,
  isJunkEmail,
  isEmailGuessed,
  existingEmailConfidence,
}) {
  if (!email) {
    return "missing";
  }

  if (existingEmailConfidence && existingEmailConfidence !== "missing") {
    if (existingEmailConfidence === "verified" && (isEmailGuessed || isJunkEmail || isGenericEmail)) {
      return isEmailGuessed ? "guessed" : "generic";
    }
    return existingEmailConfidence;
  }

  if (isEmailGuessed) {
    return "guessed";
  }

  if (isJunkEmail || isGenericEmail) {
    return "generic";
  }

  return "verified";
}

function deriveEmailStatus({
  email,
  isGenericEmail,
  isJunkEmail,
  isEmailGuessed,
  existingEmailStatus,
}) {
  if (!email) {
    return "none";
  }

  if (existingEmailStatus && existingEmailStatus !== "none") {
    if (existingEmailStatus === "verified" && (isEmailGuessed || isJunkEmail || isGenericEmail)) {
      return isEmailGuessed ? "guessed" : "generic";
    }
    return existingEmailStatus;
  }

  if (isEmailGuessed) {
    return "guessed";
  }

  if (isJunkEmail || isGenericEmail) {
    return "generic";
  }

  return "verified";
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function shouldKeepContact(contact) {
  if (!contact.email && !contact.phone && !contact.linkedin_url) {
    return false;
  }

  if (contact.quality_label === "junk") {
    return false;
  }

  return true;
}

function normalizePhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function pickExtractionMethod(existingMethod, incomingMethod) {
  const methods = [existingMethod, incomingMethod].filter(Boolean);

  if (methods.includes("ai")) {
    return "ai";
  }

  if (methods.includes("google_people")) {
    return "google_people";
  }

  return methods[0] || "regex";
}
