export async function scanCompanyWebsiteMock(company) {
  await delay(700);

  const baseSlug = createSlug(company.name || company.website || "company");
  const domain = extractDomain(company.website);
  const contactBaseUrl = company.website || "https://example.com";
  const contactSource = `${contactBaseUrl.replace(/\/$/, "")}/contact`;

  const contacts = [
    {
      name: buildName(baseSlug, 0),
      title: "Business Development Director",
      email: `partnerships@${domain || `${baseSlug}.com`}`,
      phone: company.phone || "(555) 010-1122",
      source_url: contactSource,
      confidence_score: 0.91,
    },
    {
      name: buildName(baseSlug, 1),
      title: "Talent Acquisition Lead",
      email: `talent@${domain || `${baseSlug}.com`}`,
      phone: "(555) 010-1188",
      source_url: `${contactBaseUrl.replace(/\/$/, "")}/team`,
      confidence_score: 0.78,
    },
  ];

  return {
    contacts,
    status: contacts.some((contact) => contact.confidence_score < 0.8)
      ? "needs_review"
      : "contacts_found",
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractDomain(website) {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch (error) {
    return "";
  }
}

function buildName(slug, offset) {
  const parts = slug
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  const fallbackNames = [
    ["Avery", "Morgan"],
    ["Jordan", "Lee"],
    ["Taylor", "Brooks"],
  ];

  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }

  return fallbackNames[offset % fallbackNames.length].join(" ");
}
