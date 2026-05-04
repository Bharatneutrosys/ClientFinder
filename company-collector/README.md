# Company Collector

Stable Node.js collector for public company-level data about IT staffing and consulting companies in the USA.

## Codex Instructions

- Use plain JavaScript only.
- Keep code modular and simple.
- Avoid TypeScript, Next.js, or larger framework migrations unless explicitly requested.
- Main goal: collect USA IT staffing and consulting company data.
- The collector outputs `companies.json` and `companies.csv`.
- The viewer reads `companies.json`.
- The Express backend handles website scanning to avoid browser CORS issues.
- Website scanning should extract public emails and phone numbers first.
- Keep the mock scanner as fallback.
- Add OpenAI only as an optional enhancement when explicitly requested.
- Avoid large rewrites unless necessary.
- Prefer small, safe changes.

## What it does

- Accepts `keyword`, `city`, and `state`
- Supports optional `--source="google"` or `--source="serp"` collector mode
- Uses a provider abstraction:
  - `googlePlacesProvider`
  - `serpProvider`
  - `fallbackSearch`
  - `mockProvider`
- Normalizes all results into one clean shape
- Deduplicates by:
  - normalized company name + phone
  - normalized company name + website
  - normalized address + name
- Cleans phone numbers, websites, and city/state values
- Drops obviously incomplete junk rows
- Writes:
  - `companies.json`
  - `companies.csv`
- Keeps a placeholder `scanCompanyWebsite(company)` for later website extraction
- Includes a static viewer at `viewer/index.html`

## Run

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX"
```

Optional mock mode:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX" --mock
```

Optional Google Places API key:

```bash
set GOOGLE_PLACES_API_KEY=your_key_here
node index.js --keyword="IT staffing" --city="Dallas" --state="TX"
```

Optional Google-only source mode:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX" --source="google"
```

If `GOOGLE_PLACES_API_KEY` is missing in Google-only mode, the collector prints a warning and falls back to the existing provider path instead of failing.

Optional SerpAPI-only source mode:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX" --source="serp"
```

If `SERPAPI_KEY` is missing in Serp-only mode, the collector prints a warning and falls back to the existing provider path instead of failing.

## Output shape

```json
{
  "id": "cmp-12345678",
  "name": "Example Company",
  "address": "123 Main St, Dallas, TX 75001",
  "city": "Dallas",
  "state": "TX",
  "phone": "(214) 555-0100",
  "website": "https://example.com",
  "source": "google_places",
  "source_url": "https://maps.google.com/example",
  "keyword": "IT staffing",
  "confidence_score": 0.94,
  "collected_at": "2026-04-23T20:00:00.000Z"
}
```

## Notes

- `googlePlacesProvider` is API-backed and uses Google Places Text Search plus Place Details.
- `serpProvider` can query SerpAPI using `engine=google_maps`.
- `GOOGLE_PLACES_API_KEY` can be set in `.env` or your shell environment.
- `SERPAPI_KEY` can be set in `.env` or your shell environment.
- `fallbackSearch` is best-effort and lower confidence than API-backed results.
- Yellow Pages scraping was removed because it was unreliable.
- No person/contact scraping is included yet.

## Collector Environment

The collector loads `.env` automatically from the `company-collector/` project root.

Setup:

1. Copy `.env.example` to `.env`
2. Add your key to `company-collector/.env`

Example:

```bash
GOOGLE_PLACES_API_KEY=your_google_places_key
SERPAPI_KEY=your_serpapi_key
OPENAI_API_KEY=
AI_EXTRACTION_ENABLED=false
OPENAI_MODEL=gpt-4o-mini
```

If you prefer not to use `.env`, you can also set `GOOGLE_PLACES_API_KEY` or `SERPAPI_KEY` in your shell before running the collector.

## Viewer

Install dependencies and start the local server:

```bash
npm install
npm start
```

If `npm start` shows `EADDRINUSE`, close the old server using that port or start the app on another port, for example:

```bash
set PORT=3100
npm start
```

Then open:

```text
http://localhost:3000/viewer/
```

The server hosts the viewer, serves `companies.json`, and exposes the backend scan endpoint:

```text
GET /api/companies
POST /api/collect-companies
POST /api/scan-website
```

## Optional AI Extraction

AI extraction is optional and enhances the existing regex scanner instead of replacing it.

1. Copy `.env.example` to `.env`
2. Set your API key
3. Turn on AI extraction

Example `.env`:

```bash
OPENAI_API_KEY=your_key_here
AI_EXTRACTION_ENABLED=true
OPENAI_MODEL=gpt-4o-mini
```

Notes:

- AI is disabled by default.
- Regex extraction still runs even when AI is off or unavailable.
- The scanner sends cleaned page text only, never full HTML.
- Each page sent to AI is capped at 4000 characters to keep token usage low.
- AI runs only when `AI_EXTRACTION_ENABLED=true`, `OPENAI_API_KEY` exists, and page text is available.
- Saved contacts include `extraction_method` with either `regex` or `ai`.

## Typical Usage

1. Run the collector to refresh `companies.json` and `companies.csv`:

```bash
node index.js --keyword="IT staffing" --city="Dallas" --state="TX"
```

2. Start the local server:

```bash
npm install
npm start
```

3. Open the viewer:

```text
http://localhost:3000/viewer/
```

4. Use the dashboard to:
- choose a state and/or city
- keep or change the default keyword `IT staffing`
- switch between list and grid view
- change page size to `10`, `20`, `50`, or `100`
- filter by source, primary contact, email, phone, confidence, and review state
- open company details to review the primary contact plus other personnel
- run `Collect More` when the current location does not have enough saved company data
- deep scan one company or scan all visible companies
- export visible companies, all contacts, outreach-ready contacts, and primary contacts
- optionally enable AI extraction in `.env` for better structured contact names and titles

5. Saved website contacts persist in `contacts.json` and remain visible after refresh.

## Product Flow

- Search first uses the existing `companies.json` inventory already saved on disk.
- If a market has weak coverage, `Collect More` runs the backend collector for the selected city, state, keyword, and source.
- Newly collected companies are merged into `companies.json` and `companies.csv` with global deduplication.
- `Deep Scan` crawls the homepage plus relevant internal pages and saves contacts to `contacts.json`.
- The details modal prefers a strong person contact as the primary contact. If no verified public person is found, the UI shows `NA`.

If you only want a static file server for viewing `companies.json` without the backend scan endpoint, you can still use:

```bash
npx serve
```

Or:

```bash
python -m http.server
```
