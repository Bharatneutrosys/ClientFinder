export function createSerpProvider() {
  return {
    id: "serp_api",
    isEnabled() {
      return true;
    },
    async search(input) {
      const apiKey = String(process.env.SERPAPI_KEY || "").trim();

      if (!apiKey) {
        return [];
      }

      const query = encodeURIComponent(`${input.keyword} ${input.city} ${input.state}`);
      const url = `https://serpapi.com/search.json?q=${query}&engine=google_maps&api_key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`SerpAPI request failed with ${response.status}`);
      }

      const payload = await response.json();
      const results = Array.isArray(payload.local_results)
        ? payload.local_results
        : Array.isArray(payload.place_results)
          ? payload.place_results
          : [];

      return results.map((result) => mapSerpResultToCompany(result, input)).filter(Boolean);
    },
  };
}

function mapSerpResultToCompany(result, input) {
  const website = String(result?.website || result?.links?.website || "").trim();
  const sourceUrl = String(
    result?.link || result?.place_id_search || result?.website || result?.links?.website || ""
  ).trim();

  return {
    id: String(result?.place_id || ""),
    name: String(result?.title || "").trim(),
    address: String(result?.address || "").trim(),
    city: input.city,
    state: input.state,
    phone: String(result?.phone || "").trim(),
    website,
    source: "serp_api",
    source_url: sourceUrl,
    keyword: input.keyword,
    confidence_score: 0.88,
  };
}
