const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
].join(",");

export function createGooglePlacesProvider() {
  return {
    id: "google_places",
    isEnabled() {
      return true;
    },
    async search(input) {
      const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();

      if (!apiKey) {
        return [];
      }

      const response = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: `${input.keyword} in ${input.city}, ${input.state}`,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Google Places text search failed with ${response.status}: ${compactErrorBody(errorBody)}`
        );
      }

      const payload = await response.json();
      const places = Array.isArray(payload.places) ? payload.places : [];

      return places.map((place) => mapGooglePlaceToCompany(place, input));
    },
  };
}

function mapGooglePlaceToCompany(place, input) {
  return {
    id: extractPlaceId(place?.name),
    name: place?.displayName?.text || extractFallbackName(place?.displayName?.text),
    address: place?.formattedAddress || "",
    city: input.city,
    state: input.state,
    phone: place?.nationalPhoneNumber || "",
    website: place?.websiteUri || "",
    source: "google_places",
    source_url: place?.googleMapsUri || "",
    keyword: input.keyword,
    confidence_score: 0.94,
  };
}

function extractPlaceId(resourceName) {
  const raw = String(resourceName || "").trim();
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

function extractFallbackName(value) {
  return String(value || "").trim() || "Unknown";
}

function compactErrorBody(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
