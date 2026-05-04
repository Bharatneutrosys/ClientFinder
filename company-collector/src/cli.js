import { readFile } from "node:fs/promises";
import path from "node:path";
import { collectCompanies } from "./pipeline/collectCompanies.js";
import { dedupeCompanies } from "./transformers/deduplicator.js";
import { createLogger } from "./utils/logger.js";
import { writeCompaniesCsv, writeCompaniesJson } from "./writers/companyWriters.js";

export async function runCollectorCli(argv) {
  const input = parseArgs(argv);

  if (!input.keyword || (!input.citiesFile && (!input.city || !input.state))) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const logger = createLogger();

  try {
    if (input.source === "google" && !String(process.env.GOOGLE_PLACES_API_KEY || "").trim()) {
      logger.warn(
        "GOOGLE_PLACES_API_KEY is missing. Falling back to the existing non-Google provider."
      );
    }

    if (input.source === "serp" && !String(process.env.SERPAPI_KEY || "").trim()) {
      logger.warn("SERPAPI_KEY is missing. Falling back to the existing non-Serp provider.");
    }

    const result = input.citiesFile
      ? await collectCompaniesForCitiesFile(input, { logger })
      : await collectCompanies(input, { logger });
    const jsonPath = await writeCompaniesJson(result.companies);
    const csvPath = await writeCompaniesCsv(result.companies);

    if (input.citiesFile) {
      logger.info(`Cities processed: ${result.stats.citiesProcessed}`);
    }
    logger.info(`Raw results: ${result.stats.rawResults}`);
    logger.info(`Cleaned results: ${result.stats.cleanedResults}`);
    logger.info(`Duplicates removed: ${result.stats.duplicatesRemoved}`);
    logger.info(`Saved results: ${result.stats.savedResults}`);
    logger.info(`JSON: ${jsonPath}`);
    logger.info(`CSV: ${csvPath}`);
  } catch (error) {
    logger.error(`Collection failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const result = {
    keyword: "",
    city: "",
    state: "",
    source: "",
    citiesFile: "",
    useMock: false,
  };

  argv.forEach((arg) => {
    if (arg.startsWith("--keyword=")) {
      result.keyword = cleanArgValue(arg.slice("--keyword=".length));
    }

    if (arg.startsWith("--city=")) {
      result.city = cleanArgValue(arg.slice("--city=".length));
    }

    if (arg.startsWith("--state=")) {
      result.state = cleanArgValue(arg.slice("--state=".length)).toUpperCase();
    }

    if (arg.startsWith("--source=")) {
      result.source = cleanArgValue(arg.slice("--source=".length)).toLowerCase();
    }

    if (arg.startsWith("--citiesFile=")) {
      result.citiesFile = cleanArgValue(arg.slice("--citiesFile=".length));
    }

    if (arg === "--mock") {
      result.useMock = true;
    }
  });

  return result;
}

function cleanArgValue(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function printUsage() {
  console.log(
    'Usage: node index.js --keyword="IT staffing" --city="Dallas" --state="TX" [--source="google"|"serp"]\n   or: node index.js --keyword="IT staffing" --source="google" --citiesFile="data/target-cities.json"'
  );
}

async function collectCompaniesForCitiesFile(input, { logger }) {
  const cities = await loadCitiesFile(input.citiesFile);
  const allCompanies = [];
  const stats = {
    citiesProcessed: cities.length,
    rawResults: 0,
    cleanedResults: 0,
    duplicatesRemoved: 0,
    savedResults: 0,
  };

  for (const location of cities) {
    const cityInput = {
      ...input,
      city: location.city,
      state: String(location.state || "").toUpperCase(),
    };

    const result = await collectCompanies(cityInput, { logger });
    allCompanies.push(...result.companies);
    stats.rawResults += Number(result.stats.rawResults || 0);
    stats.cleanedResults += Number(result.stats.cleanedResults || 0);
    stats.duplicatesRemoved += Number(result.stats.duplicatesRemoved || 0);
  }

  const globalDedupe = dedupeCompanies(allCompanies);
  stats.duplicatesRemoved += globalDedupe.duplicatesRemoved;
  stats.savedResults = globalDedupe.companies.length;

  return {
    companies: globalDedupe.companies,
    stats,
  };
}

async function loadCitiesFile(citiesFile) {
  const absolutePath = path.resolve(process.cwd(), citiesFile);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Cities file is empty or invalid: ${absolutePath}`);
  }

  const cities = parsed
    .map((entry) => ({
      city: cleanArgValue(entry?.city),
      state: cleanArgValue(entry?.state).toUpperCase(),
    }))
    .filter((entry) => entry.city && entry.state);

  if (cities.length === 0) {
    throw new Error(`Cities file does not contain valid city/state entries: ${absolutePath}`);
  }

  return cities;
}
