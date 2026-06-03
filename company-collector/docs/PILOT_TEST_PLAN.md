# Client Finder Pilot Test Plan

Use this plan to test Client Finder with 20 real prospects before broader use. The pilot should validate search quality, qualification, workflow clarity, exports, and data safety while the app remains localStorage-first.

## Pilot Scope

- Test 20 real prospects total.
- Cover at least 3 search scenarios.
- Save usable prospects, add them to lists, track activity/follow-ups, and export at least one list.
- Log issues in `docs/PILOT_ISSUE_LOG.md`.
- Do not treat this as a public SaaS launch.

## Search Scenarios

### Scenario A: Salon / Beauty

- Business type: Salon, Hair Salon, Nail Salon, Barbershop, Spa, Med Spa, or related beauty business.
- Location: Farmers Branch, TX or Dallas, TX.
- Goal: find businesses with no website, social-only presence, booking-only presence, or weak website.
- Target count: 7 prospects.

Suggested filters:
- Search Mode: Client Acquisition
- Website Condition: No Website, Weak Website, or Any Website depending on result volume
- Booking System Condition: Any or Booking Platform Only
- Social Presence Condition: Any or Social Only

### Scenario B: Cleaning Company

- Business type: Cleaning Company, Commercial Cleaning, House Cleaning.
- Location: Los Angeles, CA.
- Goal: find businesses without a clear booking system or with weak online presence.
- Target count: 7 prospects.

Suggested filters:
- Search Mode: Client Acquisition or Vendor / Supply Search
- Website Condition: Any Website or Weak Website
- Booking System Condition: No Booking System or Unknown
- Phone Available: Yes

### Scenario C: IT Staffing / Staffing Agency

- Business type: IT Staffing, Staffing Agency, Recruiting Agency.
- Location: Maine.
- Goal: build a company list with address, phone, website, and contact details.
- Target count: 6 prospects.

Suggested filters:
- Search Mode: Staffing / Consulting Research
- Website Condition: Any Website
- Phone Available: Any or Yes
- Source: Google Places

## Success Criteria

### Search

- Usable results can be found for all 3 scenarios.
- Search filters make sense for the chosen use case.
- Result rows are readable and not confusing.
- More Filters is helpful without cluttering the main search.
- Search loading, empty, and error states are understandable.

### Qualification

- Website Status, Mobile App Status, and Booking System signals are useful.
- Opportunity Score feels reasonable for client acquisition searches.
- Opportunity Priority is easy to understand.
- Reason chips help explain why a prospect is interesting.
- Staffing/vendor research does not overemphasize website gaps.

### Workflow

- Save Prospect works.
- Add to List works.
- Add Activity works.
- Set Next Follow-Up works.
- Outreach template copy works.
- Quote prep works.
- Convert to Client works when needed.
- Client profile tabs remain usable after conversion.

### Export

- Current search results can be exported.
- Saved prospects can be exported.
- Selected saved list can be exported.
- CSV columns are useful for follow-up, review, or outreach.
- Missing values do not break CSV output.

### Persistence and Safety

- Saved data remains after refresh.
- Backup export works before destructive/reset actions.
- Import/restore is not needed during normal pilot unless testing data safety.
- No raw passwords or sensitive document contents are stored.

## Pilot Tracking Table

| # | Prospect Name | Scenario | Search Query / Filters | Was Useful? | Issue Found | Fix Needed | Priority |
|---|---|---|---|---|---|---|---|
| 1 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 2 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 3 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 4 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 5 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 6 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 7 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 8 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 9 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 10 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 11 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 12 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 13 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 14 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 15 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 16 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 17 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 18 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 19 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |
| 20 |  | A / B / C |  | Yes / No |  |  | Critical / High / Medium / Low |

## Pilot Run Notes

- Export a local backup before starting if existing data matters.
- Create saved lists for each scenario, such as `Pilot - Salons TX`, `Pilot - Cleaning LA`, and `Pilot - IT Staffing Maine`.
- Log every bug, confusing moment, or data-quality issue in the pilot issue log.
- After the pilot, decide launch scope using `docs/MVP_LAUNCH_SCOPE.md`.
