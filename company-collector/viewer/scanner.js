import { scanCompanyWebsiteReal } from "./realScanner.js";

const SCAN_STATE_STORAGE_KEY = "find-any-company.scan-states";

export const SCAN_STATUS = {
  NOT_SCANNED: "not_scanned",
  QUEUED: "queued",
  SCANNING: "scanning",
  SCANNED: "scanned",
  BLOCKED: "blocked",
  NO_CONTACTS: "no_contacts",
  FAILED: "failed",
  NEEDS_REVIEW: "needs_review",
};

export function createScanner() {
  const scanMap = loadPersistedScanMap();

  function getState(companyId) {
    return (
      scanMap.get(companyId) || {
        status: SCAN_STATUS.NOT_SCANNED,
        contacts: [],
        message: "",
        source: "",
        blocked: false,
        scannedUrls: [],
        lastScanned: "",
        failureReason: "",
      }
    );
  }

  async function scanCompany(company) {
    const existing = getState(company.id);

    if (existing.status === SCAN_STATUS.SCANNING) {
      return existing;
    }

    scanMap.set(company.id, {
      ...existing,
      status: SCAN_STATUS.QUEUED,
      message: "Queued for website scan...",
    });
    persistScanMap(scanMap);

    scanMap.set(company.id, {
      ...getState(company.id),
      status: SCAN_STATUS.SCANNING,
      message: "Attempting website scan...",
    });
    persistScanMap(scanMap);

    const result = await scanCompanyWebsiteReal(company);

    const nextState = {
      status: normalizeStateStatus(result.status, result.contacts, result.blocked),
      contacts: normalizeContacts(result.contacts, company),
      message: result.message || "",
      source: result.source || (result.blocked ? "real_blocked" : "real_homepage"),
      blocked: Boolean(result.blocked),
      scannedUrls: Array.isArray(result.scanned_urls) ? result.scanned_urls : [],
      lastScanned: getLatestScannedAt(result.contacts),
      failureReason: result.failure_reason || "",
    };

    scanMap.set(company.id, nextState);
    persistScanMap(scanMap);
    return nextState;
  }

  function hydrateSavedContacts(companies, savedContacts) {
    const contactsByWebsite = groupContactsByWebsite(savedContacts);

    companies.forEach((company) => {
      const websiteKey = normalizeWebsiteKey(company.website);
      const companyContacts = contactsByWebsite.get(websiteKey) || [];

      if (companyContacts.length === 0) {
        return;
      }

      const existing = getState(company.id);
      scanMap.set(company.id, {
        ...existing,
        status: deriveStatusFromContacts(companyContacts),
        contacts: normalizeContacts(companyContacts, company),
        message: `Loaded ${companyContacts.length} saved contact${companyContacts.length === 1 ? "" : "s"} from previous scans.`,
        source: "saved_contacts",
        blocked: false,
        scannedUrls: dedupe(companyContacts.map((contact) => contact.source_url).filter(Boolean)),
        lastScanned: getLatestScannedAt(companyContacts),
        failureReason: existing.failureReason || "",
      });
    });

    persistScanMap(scanMap);
  }

  function applySavedContacts(companies, savedContacts) {
    hydrateSavedContacts(companies, savedContacts);
  }

  function markQueued(companyId, message = "Queued for website scan...") {
    const existing = getState(companyId);
    scanMap.set(companyId, {
      ...existing,
      status: SCAN_STATUS.QUEUED,
      message,
    });
    persistScanMap(scanMap);
  }

  function setState(companyId, partialState) {
    scanMap.set(companyId, {
      ...getState(companyId),
      ...partialState,
    });
    persistScanMap(scanMap);
    return getState(companyId);
  }

  function getFailedCount() {
    return [...scanMap.values()].filter((entry) => entry.status === SCAN_STATUS.FAILED).length;
  }

  function getScanStates() {
    return new Map(scanMap);
  }

  return {
    getState,
    scanCompany,
    hydrateSavedContacts,
    applySavedContacts,
    markQueued,
    setState,
    getFailedCount,
    getScanStates,
  };
}

export function getScanStatusMeta(status) {
  const map = {
    [SCAN_STATUS.NOT_SCANNED]: { label: "Not scanned", cssClass: "not-scanned" },
    [SCAN_STATUS.QUEUED]: { label: "Queued", cssClass: "scanning" },
    [SCAN_STATUS.SCANNING]: { label: "Scanning", cssClass: "scanning" },
    [SCAN_STATUS.SCANNED]: { label: "Scanned", cssClass: "contacts-found" },
    [SCAN_STATUS.BLOCKED]: { label: "Blocked", cssClass: "failed" },
    [SCAN_STATUS.NO_CONTACTS]: { label: "No contacts found", cssClass: "needs-review" },
    [SCAN_STATUS.FAILED]: { label: "Blocked", cssClass: "failed" },
    [SCAN_STATUS.NEEDS_REVIEW]: { label: "Needs review", cssClass: "needs-review" },
  };

  return map[status] || map[SCAN_STATUS.NOT_SCANNED];
}

function normalizeContacts(contacts, company) {
  return (Array.isArray(contacts) ? contacts : []).map((contact) => ({
    name: contact.name || "Unknown",
    title: contact.title || "Website Contact",
    email: contact.email || "",
    phone: contact.phone || "",
    linkedin_url: contact.linkedin_url || "",
    contact_page_url: contact.contact_page_url || contact.source_url || company.website || "",
    source_url: contact.source_url || company.website || "",
    confidence_score: Number(contact.confidence_score || 0.72),
    quality_score: Number(contact.quality_score || 0),
    quality_label: contact.quality_label || "needs_review",
    priority_contact: Boolean(contact.priority_contact),
    is_generic_email: Boolean(contact.is_generic_email),
    contact_type: contact.contact_type || "needs_review",
    extraction_method: contact.extraction_method || "regex",
    evidence_summary: contact.evidence_summary || "",
    decision_maker: Boolean(contact.decision_maker),
    is_email_guessed: Boolean(contact.is_email_guessed),
    email_confidence: contact.email_confidence || "missing",
    email_status: contact.email_status || "none",
    email_guess_pattern: contact.email_guess_pattern || "",
    review_status: contact.review_status || "new",
    scanned_at: contact.scanned_at || "",
    company_name: contact.company_name || company.name || "Unknown",
    company_website: contact.company_website || company.website || "",
  }));
}

function groupContactsByWebsite(contacts) {
  const map = new Map();

  contacts.forEach((contact) => {
    const key = normalizeWebsiteKey(contact.company_website);

    if (!key) {
      return;
    }

    const existing = map.get(key) || [];
    existing.push(contact);
    map.set(key, existing);
  });

  return map;
}

function normalizeWebsiteKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function deriveStatusFromContacts(contacts) {
  if (!contacts || contacts.length === 0) {
    return SCAN_STATUS.NOT_SCANNED;
  }

  if (contacts.some((contact) => contact.review_status === "new" || contact.review_status === "bad")) {
    return SCAN_STATUS.NEEDS_REVIEW;
  }

  return SCAN_STATUS.SCANNED;
}

function normalizeStateStatus(status, contacts, blocked) {
  if (status === SCAN_STATUS.QUEUED || status === SCAN_STATUS.SCANNING) {
    return status;
  }

  if (blocked) {
    return SCAN_STATUS.BLOCKED;
  }

  if (status === "contacts_found") {
    return SCAN_STATUS.SCANNED;
  }

  if (status === "failed") {
    return SCAN_STATUS.FAILED;
  }

  if (!contacts || contacts.length === 0) {
    return SCAN_STATUS.NO_CONTACTS;
  }

  return deriveStatusFromContacts(contacts);
}

function getLatestScannedAt(contacts) {
  return (Array.isArray(contacts) ? contacts : [])
    .map((contact) => contact.scanned_at || "")
    .sort()
    .at(-1) || "";
}

function dedupe(values) {
  return [...new Set(values)];
}

function loadPersistedScanMap() {
  try {
    const raw = localStorage.getItem(SCAN_STATE_STORAGE_KEY);
    const parsed = JSON.parse(raw || "{}");
    return new Map(
      Object.entries(parsed).map(([companyId, value]) => [companyId, normalizePersistedState(value)])
    );
  } catch (error) {
    return new Map();
  }
}

function persistScanMap(scanMap) {
  const payload = {};
  scanMap.forEach((value, key) => {
    payload[key] = normalizePersistedState(value);
  });
  localStorage.setItem(SCAN_STATE_STORAGE_KEY, JSON.stringify(payload));
}

function normalizePersistedState(value) {
  return {
    status: value?.status || SCAN_STATUS.NOT_SCANNED,
    contacts: Array.isArray(value?.contacts) ? value.contacts : [],
    message: value?.message || "",
    source: value?.source || "",
    blocked: Boolean(value?.blocked),
    scannedUrls: Array.isArray(value?.scannedUrls) ? value.scannedUrls : [],
    lastScanned: value?.lastScanned || "",
    failureReason: value?.failureReason || "",
  };
}
