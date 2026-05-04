import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeCompanies } from "../transformers/deduplicator.js";
import { writeCompaniesCsv, writeCompaniesJson } from "../writers/companyWriters.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const COMPANIES_PATH = path.join(PROJECT_ROOT, "companies.json");

export async function loadCompanies() {
  try {
    const raw = await readFile(COMPANIES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export async function saveCompanies(companies) {
  const deduped = dedupeCompanies(Array.isArray(companies) ? companies : []).companies;
  const jsonPath = await writeCompaniesJson(deduped);
  const csvPath = await writeCompaniesCsv(deduped);

  return {
    companies: deduped,
    jsonPath,
    csvPath,
  };
}

export async function mergeAndSaveCompanies(incomingCompanies) {
  const existingCompanies = await loadCompanies();
  const merged = dedupeCompanies([...existingCompanies, ...(Array.isArray(incomingCompanies) ? incomingCompanies : [])]);
  const saved = await saveCompanies(merged.companies);

  return {
    companies: saved.companies,
    duplicatesRemoved: merged.duplicatesRemoved,
    jsonPath: saved.jsonPath,
    csvPath: saved.csvPath,
  };
}
