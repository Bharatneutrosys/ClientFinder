const TARGET_INDUSTRY_PATTERNS = [
  "it staffing",
  "staffing",
  "recruit",
  "talent",
  "consulting",
  "consultancy",
  "workforce",
  "human resources",
  "hr consulting",
  "technology services",
  "managed services",
];

const CONTACT_PAGE_PATTERNS = [
  "contact",
  "careers",
  "jobs",
  "recruit",
  "staff",
  "team",
  "about",
  "leadership",
  "employers",
  "clients",
];

export function scoreCompanyLead(company, contacts = []) {
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const primaryContact = company.primary_contact || safeContacts[0] || null;
  const reasons = [];
  let score = 0;

  if (matchesTargetIndustry(company)) {
    score += 28;
    reasons.push("Target industry fit");
  }

  if (company.website) {
    score += 12;
    reasons.push("Website available");
  }

  if (company.phone || safeContacts.some((contact) => contact.phone)) {
    score += 8;
    reasons.push("Phone available");
  }

  if (safeContacts.some((contact) => contact.email_status === "verified")) {
    score += 18;
    reasons.push("Verified email found");
  } else if (safeContacts.some((contact) => contact.email_status === "generic")) {
    score += 10;
    reasons.push("General business email found");
  } else if (safeContacts.some((contact) => contact.email_status === "guessed")) {
    score += 4;
    reasons.push("Guessed email only");
  }

  if (primaryContact?.contact_type === "person_contact" && primaryContact.email_status === "verified") {
    score += 16;
    reasons.push("Named verified contact");
  } else if (primaryContact?.contact_type === "generic_company_contact") {
    score += 8;
    reasons.push("Generic company contact");
  }

  if (primaryContact?.decision_maker) {
    score += 10;
    reasons.push("Decision-maker role");
  }

  if (hasRelevantContactPage(safeContacts)) {
    score += 6;
    reasons.push("Relevant contact/source page");
  }

  if (String(company.state || "").trim()) {
    score += 2;
  }

  const leadScore = clamp(score);
  const leadLabel = getLeadLabel(leadScore, safeContacts);

  return {
    lead_score: leadScore,
    lead_label: leadLabel,
    lead_reasons: reasons,
    outreach_ready: isOutreachReady({ leadScore, contacts: safeContacts, primaryContact }),
  };
}

export function getLeadLabel(score, contacts = []) {
  if (score >= 75 && hasUsableEmail(contacts)) {
    return "High Fit";
  }

  if (score >= 55) {
    return "Medium Fit";
  }

  if (score >= 35) {
    return "Low Fit";
  }

  return "Needs Review";
}

function matchesTargetIndustry(company) {
  const haystack = [
    company.name,
    company.keyword,
    company.industry,
    company.website,
    company.source_url,
    ...(company.industry_tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return TARGET_INDUSTRY_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function hasRelevantContactPage(contacts) {
  return contacts.some((contact) => {
    const url = `${contact.contact_page_url || ""} ${contact.source_url || ""}`.toLowerCase();
    return CONTACT_PAGE_PATTERNS.some((pattern) => url.includes(pattern));
  });
}

function hasUsableEmail(contacts) {
  return contacts.some((contact) =>
    ["verified", "generic"].includes(String(contact.email_status || "").toLowerCase())
  );
}

function isOutreachReady({ leadScore, contacts, primaryContact }) {
  if (leadScore < 70 || !primaryContact) {
    return false;
  }

  if (primaryContact.review_status === "bad") {
    return false;
  }

  return contacts.some(
    (contact) =>
      contact.email &&
      ["verified", "generic"].includes(String(contact.email_status || "").toLowerCase()) &&
      contact.review_status !== "bad"
  );
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
