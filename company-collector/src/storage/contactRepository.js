import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dedupeAndEnrichContacts,
  enrichContactQuality,
  isUsableContact,
} from "../contacts/contactQuality.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CONTACTS_PATH = path.join(PROJECT_ROOT, "contacts.json");

export async function ensureContactsFile() {
  try {
    await access(CONTACTS_PATH);
  } catch (error) {
    await writeFile(CONTACTS_PATH, "[]", "utf8");
  }
}

export async function loadContacts() {
  await ensureContactsFile();

  try {
    const raw = await readFile(CONTACTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((contact) => enrichContactQuality(contact)).filter(isUsableContact)
      : [];
  } catch (error) {
    return [];
  }
}

export async function loadContactsForCompany(companyWebsite) {
  const contacts = await loadContacts();
  const websiteKey = normalizeWebsiteKey(companyWebsite);
  return contacts.filter((contact) => normalizeWebsiteKey(contact.company_website) === websiteKey);
}

export async function saveContactsForCompany({ companyName, companyWebsite, contacts }) {
  const existingContacts = await loadContacts();
  const workingContacts = [...existingContacts];
  const cleanedContacts = dedupeAndEnrichContacts(contacts);

  cleanedContacts.forEach((contact) => {
    const incoming = buildStoredContact({
      companyName,
      companyWebsite,
      contact,
    });

    const matchIndex = findMatchingIndex(workingContacts, incoming);

    if (matchIndex >= 0) {
      workingContacts[matchIndex] = mergeStoredContact(workingContacts[matchIndex], incoming);
      return;
    }

    workingContacts.push(incoming);
  });

  await writeContacts(workingContacts);
  return loadContactsForCompany(companyWebsite);
}

export async function updateContactReviewStatus({
  companyWebsite,
  email,
  phone,
  reviewStatus,
}) {
  const contacts = await loadContacts();
  const websiteKey = normalizeWebsiteKey(companyWebsite);
  const emailKey = normalizeKey(email);
  const phoneKey = normalizePhoneKey(phone);

  let updatedContact = null;

  const nextContacts = contacts.map((contact) => {
    const matchesWebsite = normalizeWebsiteKey(contact.company_website) === websiteKey;
    const matchesEmail = emailKey && normalizeKey(contact.email) === emailKey;
    const matchesPhone = phoneKey && normalizePhoneKey(contact.phone) === phoneKey;

    if (!matchesWebsite || (!matchesEmail && !matchesPhone)) {
      return contact;
    }

    updatedContact = {
      ...contact,
      review_status: reviewStatus,
    };

    return updatedContact;
  });

  if (!updatedContact) {
    return null;
  }

  await writeContacts(nextContacts);
  return updatedContact;
}

function buildStoredContact({ companyName, companyWebsite, contact }) {
  return {
    company_name: companyName || "Unknown",
    company_website: companyWebsite || "",
    name: contact.name || "Unknown",
    title: contact.title || "Website Contact",
    email: contact.email || "",
    phone: contact.phone || "",
    linkedin_url: contact.linkedin_url || "",
    contact_page_url: contact.contact_page_url || contact.source_url || companyWebsite || "",
    source_url: contact.source_url || companyWebsite || "",
    confidence_score: Number(contact.confidence_score || 0),
    quality_score: Number(contact.quality_score || 0),
    quality_label: contact.quality_label || "needs_review",
    priority_contact: Boolean(contact.priority_contact),
    is_generic_email: Boolean(contact.is_generic_email),
    is_email_guessed: Boolean(contact.is_email_guessed),
    email_confidence: contact.email_confidence || "missing",
    email_status: contact.email_status || "none",
    email_guess_pattern: contact.email_guess_pattern || "",
    decision_maker: Boolean(contact.decision_maker),
    contact_type: contact.contact_type || "needs_review",
    evidence_summary: contact.evidence_summary || "",
    extraction_method: contact.extraction_method || "regex",
    campaign_status: contact.campaign_status || "not_contacted",
    notes: contact.notes || "",
    scanned_at: new Date().toISOString(),
    review_status: "new",
  };
}

function mergeStoredContact(existing, incoming) {
  const merged = {
    ...existing,
    company_name: incoming.company_name || existing.company_name,
    company_website: incoming.company_website || existing.company_website,
    name: incoming.name || existing.name || "Unknown",
    title: incoming.title || existing.title || "Website Contact",
    email: existing.email || incoming.email,
    phone: existing.phone || incoming.phone,
    linkedin_url: incoming.linkedin_url || existing.linkedin_url || "",
    contact_page_url: incoming.contact_page_url || existing.contact_page_url || "",
    source_url: incoming.source_url || existing.source_url,
    confidence_score: Math.max(
      Number(existing.confidence_score || 0),
      Number(incoming.confidence_score || 0)
    ),
    extraction_method: pickExtractionMethod(existing.extraction_method, incoming.extraction_method),
    email_confidence: incoming.email_confidence || existing.email_confidence || "missing",
    email_status: incoming.email_status || existing.email_status || "none",
    is_email_guessed: Boolean(existing.is_email_guessed || incoming.is_email_guessed),
    email_guess_pattern: incoming.email_guess_pattern || existing.email_guess_pattern || "",
    decision_maker: Boolean(existing.decision_maker || incoming.decision_maker),
    campaign_status: existing.campaign_status || incoming.campaign_status || "not_contacted",
    notes: incoming.notes || existing.notes || "",
    scanned_at: incoming.scanned_at,
    review_status: existing.review_status || "new",
  };

  return enrichContactQuality({
    ...merged,
    evidence_summary: incoming.evidence_summary || existing.evidence_summary || "",
  });
}

function findMatchingIndex(contacts, incoming) {
  return contacts.findIndex((contact) => {
    const sameWebsite =
      normalizeWebsiteKey(contact.company_website) === normalizeWebsiteKey(incoming.company_website);
    const sameEmail =
      incoming.email && normalizeKey(contact.email) === normalizeKey(incoming.email);
    const samePhone =
      incoming.phone && normalizePhoneKey(contact.phone) === normalizePhoneKey(incoming.phone);

    return sameWebsite && (sameEmail || samePhone);
  });
}

async function writeContacts(contacts) {
  await writeFile(CONTACTS_PATH, JSON.stringify(contacts, null, 2), "utf8");
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeWebsiteKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function pickExtractionMethod(existingMethod, incomingMethod) {
  const methods = [incomingMethod, existingMethod].filter(Boolean);

  if (methods.includes("ai")) {
    return "ai";
  }

  if (methods.includes("google_people")) {
    return "google_people";
  }

  return methods[0] || "regex";
}
