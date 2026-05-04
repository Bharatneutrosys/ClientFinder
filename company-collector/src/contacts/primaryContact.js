const TITLE_PRIORITY = [
  "owner",
  "founder",
  "co-founder",
  "principal",
  "partner",
  "president",
  "chief executive",
  "ceo",
  "business development",
  "director",
  "vp",
  "vice president",
  "sales",
  "account manager",
  "client partner",
  "vendor manager",
  "recruiting manager",
  "talent acquisition",
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
  const emailStatus = String(contact?.email_status || "").toLowerCase();
  const hasLinkedIn = Boolean(contact?.linkedin_url);

  let rank = confidence;

  if (type === "person_contact") {
    rank += 200;
  } else if (type === "generic_company_contact") {
    rank += 100;
  } else if (type === "phone_only") {
    rank += 40;
  }

  if (hasEmail && emailStatus === "verified" && !isEmailGuessed && !isGenericEmail) {
    rank += 120;
  } else if (hasEmail && emailStatus === "guessed") {
    rank += 35;
  } else if (hasEmail) {
    rank += 20;
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
    rank -= 90;
  }

  if (isEmailGuessed) {
    rank -= 65;
  }

  if (emailStatus === "verified") {
    rank += 45;
  } else if (emailStatus === "generic") {
    rank -= 45;
  } else if (emailStatus === "none" && !hasLinkedIn) {
    rank -= 25;
  }

  const titleIndex = TITLE_PRIORITY.findIndex((pattern) => title.includes(pattern));
  if (titleIndex >= 0) {
    rank += (TITLE_PRIORITY.length - titleIndex) * 4 + 30;
  }

  return rank;
}
