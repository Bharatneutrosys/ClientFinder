import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichContactQuality, isUsableContact } from "../src/contacts/contactQuality.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const contactsPath = path.join(projectRoot, "contacts.json");

const rawContacts = JSON.parse(await readFile(contactsPath, "utf8"));
const contacts = Array.isArray(rawContacts) ? rawContacts : [];
const cleanedContacts = dedupeContacts(
  contacts
    .map((contact) => ({
      ...enrichContactQuality(contact),
      campaign_status: contact.campaign_status || "not_contacted",
      notes: contact.notes || "",
    }))
    .filter(isUsableContact)
);

await writeFile(contactsPath, `${JSON.stringify(cleanedContacts, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      before: contacts.length,
      after: cleanedContacts.length,
      removed: contacts.length - cleanedContacts.length,
      invalidEmailsRemoved: contacts.filter(
        (contact) => contact.email && !cleanedContacts.some((cleaned) => cleaned.email === String(contact.email).toLowerCase())
      ).length,
    },
    null,
    2
  )
);

function dedupeContacts(contacts) {
  const byIdentity = new Map();

  contacts.forEach((contact) => {
    const key = [
      normalizeWebsiteKey(contact.company_website),
      normalizeKey(contact.email) ||
        normalizePhoneKey(contact.phone) ||
        normalizeKey(contact.linkedin_url) ||
        `${normalizeKey(contact.name)}|${normalizeKey(contact.title)}`,
    ]
      .filter(Boolean)
      .join("|");

    if (!key) {
      return;
    }

    const existing = byIdentity.get(key);
    if (!existing || Number(contact.quality_score || 0) > Number(existing.quality_score || 0)) {
      byIdentity.set(key, contact);
    }
  });

  return [...byIdentity.values()];
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
