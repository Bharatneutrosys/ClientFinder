import { createFallbackSearchProvider } from "../providers/fallbackSearch.js";
import { createGooglePlacesProvider } from "../providers/googlePlacesProvider.js";
import { createMockProvider } from "../providers/mockProvider.js";
import { createSerpProvider } from "../providers/serpProvider.js";

export function createProviderRegistry(input) {
  const providers = [
    createGooglePlacesProvider(),
    createSerpProvider(),
    createFallbackSearchProvider(),
    createMockProvider({ enabled: Boolean(input.useMock) }),
  ];

  if (input.source === "google") {
    if (String(process.env.GOOGLE_PLACES_API_KEY || "").trim()) {
      return providers.filter((provider) => provider.id === "google_places");
    }

    return providers.filter(
      (provider) => provider.id === "fallback_search" || provider.id === "mock_provider"
    );
  }

  if (input.source === "serp") {
    if (String(process.env.SERPAPI_KEY || "").trim()) {
      return providers.filter((provider) => provider.id === "serp_api");
    }

    return providers.filter(
      (provider) => provider.id === "fallback_search" || provider.id === "mock_provider"
    );
  }

  if (input.source === "fallback" || input.source === "fallback_search") {
    return providers.filter((provider) => provider.id === "fallback_search");
  }

  return providers;
}
