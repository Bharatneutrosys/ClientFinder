import {
  makeStableCompanyId,
  normalizePhoneNumber,
  normalizeWebsite,
  splitCityState,
} from "../providers/providerUtils.js";
import { COMPANY_FIELDS } from "./companySchema.js";

export function normalizeCompanies(companies, input) {
  return companies
    .map((company) => normalizeCompany(company, input))
    .filter(isValidCompany);
}

function normalizeCompany(company, input) {
  const locationParts = splitCityState(company.city_state || "");
  const city = titleCase(cleanValue(company.city || locationParts.city || input.city));
  const state = cleanState(company.state || locationParts.state || input.state);
  const normalized = {
    id: cleanValue(company.id),
    name: normalizeCompanyName(company.name),
    address: cleanAddress(company.address),
    city,
    state,
    phone: normalizePhoneNumber(company.phone),
    website: normalizeWebsite(company.website),
    source: cleanValue(company.source),
    source_url: cleanValue(company.source_url),
    keyword: cleanValue(company.keyword || input.keyword),
    confidence_score: normalizeConfidence(company.confidence_score),
    collected_at: new Date().toISOString(),
  };

  normalized.id = normalized.id || makeStableCompanyId(normalized);

  return pickFields(normalized, COMPANY_FIELDS);
}

function pickFields(company, fields) {
  return fields.reduce((accumulator, field) => {
    accumulator[field] = company[field] ?? "";
    return accumulator;
  }, {});
}

function normalizeCompanyName(value) {
  return titleCase(cleanValue(value))
    .replace(/\bLlc\b/g, "LLC")
    .replace(/\bInc\b/g, "Inc")
    .replace(/\bLlp\b/g, "LLP")
    .replace(/\bUsa\b/g, "USA");
}

function cleanAddress(value) {
  return cleanValue(value).replace(/\s+,/g, ",");
}

function normalizeConfidence(value) {
  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
  }

  return 0.6;
}

function isValidCompany(company) {
  if (!company.name || company.name.length < 3) {
    return false;
  }

  if (!company.website && !company.phone && !company.address) {
    return false;
  }

  if (!company.city || !company.state) {
    return false;
  }

  if (looksLikeJunk(company.name)) {
    return false;
  }

  return true;
}

function looksLikeJunk(name) {
  const normalized = name.toLowerCase();
  return (
    normalized.includes("top staffing firms") ||
    normalized.includes("best staffing firms") ||
    normalized.includes("near me") ||
    normalized.includes("search results") ||
    normalized.startsWith("home") ||
    normalized.startsWith("welcome")
  );
}

function cleanValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanState(value) {
  return cleanValue(value).toUpperCase().slice(0, 2);
}

function titleCase(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
