import "dotenv/config";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.googleMapsUri",
].join(",");

const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();

console.log(`API key exists: ${apiKey ? "yes" : "no"}`);
console.log(`API key prefix: ${apiKey ? apiKey.slice(0, 6) : ""}`);

if (!apiKey) {
  process.exitCode = 1;
  console.log("Response status: not requested");
  console.log("Response body:");
  console.log(JSON.stringify({ error: "GOOGLE_PLACES_API_KEY is missing." }, null, 2));
  process.exit();
}

try {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: "IT staffing in Dallas, TX",
    }),
  });

  const bodyText = await response.text();

  console.log(`Response status: ${response.status}`);
  console.log("Response body:");
  console.log(bodyText);

  if (!response.ok) {
    process.exitCode = 1;
  }
} catch (error) {
  process.exitCode = 1;
  console.log("Response status: request_failed");
  console.log("Response body:");
  console.log(
    JSON.stringify(
      {
        error: error.message,
      },
      null,
      2
    )
  );
}
