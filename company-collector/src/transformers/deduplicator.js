export function dedupeCompanies(companies) {
  const keyToIndex = new Map();
  const dedupedCompanies = [];

  companies.forEach((company) => {
    const nameKey = normalizeKey(company.name);
    const phoneKey = normalizeKey(company.phone);
    const websiteKey = normalizeWebsiteKey(company.website);
    const addressKey = normalizeKey(company.address);

    const compositeKeys = [
      phoneKey ? `${nameKey}::phone::${phoneKey}` : "",
      websiteKey ? `${nameKey}::website::${websiteKey}` : "",
      addressKey ? `${nameKey}::address::${addressKey}` : "",
    ].filter(Boolean);

    const existingIndex = compositeKeys
      .map((key) => keyToIndex.get(key))
      .find((index) => Number.isInteger(index));

    if (Number.isInteger(existingIndex)) {
      dedupedCompanies[existingIndex] = mergeCompany(dedupedCompanies[existingIndex], company);
      compositeKeys.forEach((key) => keyToIndex.set(key, existingIndex));
      return;
    }

    const nextIndex = dedupedCompanies.length;
    dedupedCompanies.push(company);
    compositeKeys.forEach((key) => keyToIndex.set(key, nextIndex));
  });

  return {
    companies: dedupedCompanies,
    duplicatesRemoved: companies.length - dedupedCompanies.length,
  };
}

function mergeCompany(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    name: incoming.name || existing.name,
    address: incoming.address || existing.address,
    city: incoming.city || existing.city,
    state: incoming.state || existing.state,
    phone: incoming.phone || existing.phone,
    website: incoming.website || existing.website,
    source: pickBetterSource(existing.source, incoming.source),
    source_url: incoming.source_url || existing.source_url,
    keyword: incoming.keyword || existing.keyword,
    confidence_score: Math.max(
      Number(existing.confidence_score || 0),
      Number(incoming.confidence_score || 0)
    ),
    collected_at: incoming.collected_at || existing.collected_at,
  };
}

function pickBetterSource(existingSource, incomingSource) {
  const priority = {
    google_places: 3,
    serp_api: 2,
    fallback_search: 1,
    mock_provider: 0,
  };

  return Number(priority[incomingSource] || 0) >= Number(priority[existingSource] || 0)
    ? incomingSource || existingSource
    : existingSource || incomingSource;
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
