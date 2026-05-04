import { createProviderRegistry } from "./createProviderRegistry.js";
import { dedupeCompanies } from "../transformers/deduplicator.js";
import { normalizeCompanies } from "../transformers/normalizer.js";

export async function collectCompanies(input, { logger } = {}) {
  const providers = createProviderRegistry(input).filter((provider) => provider.isEnabled(input));

  const providerResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const rows = await provider.search(input);
      return { providerId: provider.id, rows };
    })
  );

  const rawCompanies = [];

  providerResults.forEach((result) => {
    if (result.status === "fulfilled") {
      rawCompanies.push(...result.value.rows);
      return;
    }

    logger?.warn(`Provider failed: ${result.reason?.message || "Unknown error"}`);
  });

  const normalized = normalizeCompanies(rawCompanies, input);
  const dedupeResult = dedupeCompanies(normalized);

  return {
    companies: dedupeResult.companies,
    stats: {
      rawResults: rawCompanies.length,
      cleanedResults: normalized.length,
      duplicatesRemoved: dedupeResult.duplicatesRemoved,
      savedResults: dedupeResult.companies.length,
    },
  };
}
