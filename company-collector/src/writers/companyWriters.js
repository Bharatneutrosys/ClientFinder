import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANY_FIELDS } from "../transformers/companySchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const JSON_OUTPUT_PATH = path.join(PROJECT_ROOT, "companies.json");
const CSV_OUTPUT_PATH = path.join(PROJECT_ROOT, "companies.csv");

export async function writeCompaniesJson(companies) {
  await mkdir(PROJECT_ROOT, { recursive: true });
  await writeFile(JSON_OUTPUT_PATH, JSON.stringify(companies, null, 2), "utf8");
  return JSON_OUTPUT_PATH;
}

export async function writeCompaniesCsv(companies) {
  await mkdir(PROJECT_ROOT, { recursive: true });
  const rows = [COMPANY_FIELDS.join(",")];

  companies.forEach((company) => {
    rows.push(COMPANY_FIELDS.map((field) => escapeCsvValue(company[field])).join(","));
  });

  await writeFile(CSV_OUTPUT_PATH, rows.join("\n"), "utf8");
  return CSV_OUTPUT_PATH;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
