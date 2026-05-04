const TITLE_PRIORITY = [
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

export function selectPrimaryContact(contacts) {
  const normalized = Array.isArray(contacts) ? contacts.filter(Boolean) : [];

  if (normalized.length === 0) {
    return null;
  }

  const ranked = normalized
    .slice()
    .sort((left, right) => getPrimaryRank(right) - getPrimaryRank(left));

  return ranked[0] || null;
}

export function sortPersonnelContacts(contacts) {
  return (Array.isArray(contacts) ? contacts : [])
    .slice()
    .sort((left, right) => getPrimaryRank(right) - getPrimaryRank(left));
}

function getPrimaryRank(contact) {
  const confidence = Number(contact?.confidence_score || 0);
  const hasEmail = Boolean(contact?.email);
  const hasPhone = Boolean(contact?.phone);
  const type = String(contact?.contact_type || "");
  const title = String(contact?.title || "").toLowerCase();
  const isDecisionMaker = Boolean(contact?.decision_maker);
  const isGenericEmail = Boolean(contact?.is_generic_email);
  const isEmailGuessed = Boolean(contact?.is_email_guessed);
  const hasLinkedIn = Boolean(contact?.linkedin_url);

  let rank = confidence;

  if (type === "person_contact") {
    rank += 200;
  } else if (type === "generic_company_contact") {
    rank += 100;
  } else if (type === "phone_only") {
    rank += 40;
  }

  if (hasEmail) {
    rank += 60;
  } else if (hasPhone) {
    rank += 10;
  }

  if (isDecisionMaker) {
    rank += 80;
  }

  if (hasLinkedIn) {
    rank += 20;
  }

  if (isGenericEmail) {
    rank -= 50;
  }

  if (isEmailGuessed) {
    rank -= 15;
  }

  const titleIndex = TITLE_PRIORITY.findIndex((pattern) => title.includes(pattern));
  if (titleIndex >= 0) {
    rank += TITLE_PRIORITY.length - titleIndex + 20;
  }

  return rank;
}
