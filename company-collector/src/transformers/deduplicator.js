export function dedupeCompanies(companies) {
  const seen = new Set();
  const dedupedCompanies = companies.filter((company) => {
    const nameKey = normalizeKey(company.name);
    const phoneKey = normalizeKey(company.phone);
    const websiteKey = normalizeWebsiteKey(company.website);
    const addressKey = normalizeKey(company.address);

    const compositeKeys = [
      phoneKey ? `${nameKey}::phone::${phoneKey}` : "",
      websiteKey ? `${nameKey}::website::${websiteKey}` : "",
      addressKey ? `${nameKey}::address::${addressKey}` : "",
    ].filter(Boolean);

    if (compositeKeys.some((key) => seen.has(key))) {
      return false;
    }

    compositeKeys.forEach((key) => seen.add(key));
    return true;
  });

  return {
    companies: dedupedCompanies,
    duplicatesRemoved: companies.length - dedupedCompanies.length,
  };
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeWebsiteKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}
