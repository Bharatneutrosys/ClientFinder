import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectCompanies } from "./src/pipeline/collectCompanies.js";
import { selectPrimaryContact, sortPersonnelContacts } from "./src/contacts/primaryContact.js";
import { scoreCompanyLead } from "./src/leads/leadScoring.js";
import { deepScanWebsite } from "./src/scanners/deepWebsiteScanner.js";
import {
  loadCompanies,
  mergeAndSaveCompanies,
} from "./src/storage/companyRepository.js";
import {
  ensureContactsFile,
  loadContacts,
  saveContactsForCompany,
  updateContactReviewStatus,
} from "./src/storage/contactRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerDir = path.join(__dirname, "viewer");
const app = express();
const REQUESTED_PORT = Number(process.env.PORT) || 3000;
const PORT_CANDIDATES = [REQUESTED_PORT, REQUESTED_PORT + 1, REQUESTED_PORT + 2];
const isVercel = Boolean(process.env.VERCEL);
const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
].join(",");

app.use(express.json());
app.use("/viewer", express.static(viewerDir));

await ensureContactsFile();

app.get(["/", "/viewer", "/viewer/"], (_request, response) => {
  response.sendFile(path.join(viewerDir, "index.html"));
});

app.get("/api/prospects/search", async (request, response) => {
  try {
    const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || "").trim();

    if (!apiKey) {
      response.status(503).json({
        success: false,
        prospects: [],
        error: "Google Places API key is missing.",
      });
      return;
    }

    const businessType = String(request.query.businessType || "Salon").trim();
    const city = String(request.query.location || "").trim();
    const state = String(request.query.state || "").trim().toUpperCase();
    const websiteCondition = String(request.query.websiteCondition || "").trim();

    if (!businessType || !city || !state) {
      response.status(400).json({
        success: false,
        prospects: [],
        error: "Business type, location, and state are required.",
      });
      return;
    }

    const googleResponse = await fetch(GOOGLE_TEXT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${businessType} in ${city} ${state}`,
        maxResultCount: 12,
      }),
    });

    if (!googleResponse.ok) {
      const errorBody = await googleResponse.text();
      throw new Error(`Google Places failed (${googleResponse.status}): ${compactErrorBody(errorBody)}`);
    }

    const payload = await googleResponse.json();
    const places = Array.isArray(payload.places) ? payload.places : [];
    const prospects = places
      .map((place) => mapGooglePlaceToProspect(place, { businessType, city, state }))
      .filter((prospect) => matchesWebsiteCondition(prospect, websiteCondition));

    response.json({
      success: true,
      prospects,
      error: null,
    });
  } catch (error) {
    response.status(502).json({
      success: false,
      prospects: [],
      error: "Unable to load live prospects. You can still add a manual prospect.",
    });
  }
});

app.get("/api/companies", async (_request, response) => {
  try {
    const companies = await loadCompanies();
    const contacts = await loadContacts();
    response.json({
      success: true,
      companies: buildCompanyProfiles(companies, contacts),
      error: null,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      companies: [],
      error: "Unable to load companies.",
    });
  }
});

app.get("/api/provider-status", (_request, response) => {
  response.json({
    success: true,
    providers: {
      google_places: {
        configured: Boolean(String(process.env.GOOGLE_PLACES_API_KEY || "").trim()),
      },
      serp_api: {
        configured: Boolean(String(process.env.SERPAPI_KEY || "").trim()),
      },
      fallback_search: {
        configured: true,
      },
    },
  });
});

app.post("/api/collect-companies", async (request, response) => {
  try {
    const keyword = String(request.body?.keyword || "IT staffing").trim();
    const city = String(request.body?.city || "").trim();
    const state = String(request.body?.state || "").trim().toUpperCase();
    const source = String(request.body?.source || "").trim().toLowerCase();

    if (!keyword || !city || !state) {
      response.status(400).json({
        success: false,
        companies: [],
        stats: null,
        error: "Keyword, city, and state are required.",
      });
      return;
    }

    const companiesBeforeMerge = await loadCompanies();
    const result = await collectCompanies(
      {
        keyword,
        city,
        state,
        source,
        useMock: false,
      },
      {}
    );

    const merged = await mergeAndSaveCompanies(result.companies);
    const contacts = await loadContacts();
    const addedCompanies = Math.max(0, merged.companies.length - companiesBeforeMerge.length);

    response.json({
      success: true,
      companies: buildCompanyProfiles(merged.companies, contacts),
      stats: {
        ...result.stats,
        addedCompanies,
        totalCompanies: merged.companies.length,
        globalDuplicatesRemoved: merged.duplicatesRemoved,
      },
      error: null,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      companies: [],
      stats: null,
      error: `Unable to collect companies: ${error.message}`,
    });
  }
});

app.post("/api/scan-website", async (request, response) => {
  try {
    const companyWebsite = request.body?.website || "";
    const companyName = request.body?.company_name || "Unknown";
    const city = request.body?.city || "";
    const state = request.body?.state || "";
    const result = await deepScanWebsite(companyWebsite, {
      companyName,
      city,
      state,
    });

    if (result.success && Array.isArray(result.contacts) && result.contacts.length > 0) {
      const savedContacts = await saveContactsForCompany({
        companyName,
        companyWebsite,
        contacts: result.contacts,
      });

      response.json({
        ...result,
        contacts: savedContacts.map(mapStoredContactToApiContact),
      });
      return;
    }

    response.json(result);
  } catch (error) {
    response.status(502).json({
      success: false,
      contacts: [],
      scanned_urls: [],
      status: "needs_review",
      error: "Website scan blocked. Use backend scanner later.",
    });
  }
});

app.get("/api/contacts", async (_request, response) => {
  try {
    const contacts = await loadContacts();
    response.json({
      success: true,
      contacts,
      error: null,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      contacts: [],
      error: "Unable to load saved contacts.",
    });
  }
});

app.patch("/api/contacts/review-status", async (request, response) => {
  try {
    const updatedContact = await updateContactReviewStatus({
      companyWebsite: request.body?.company_website,
      email: request.body?.email,
      phone: request.body?.phone,
      reviewStatus: request.body?.review_status,
    });

    if (!updatedContact) {
      response.status(404).json({
        success: false,
        contact: null,
        error: "Contact not found.",
      });
      return;
    }

    response.json({
      success: true,
      contact: updatedContact,
      error: null,
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      contact: null,
      error: "Unable to update review status.",
    });
  }
});

app.get("/api/exports/contacts.csv", async (_request, response) => {
  await sendContactsCsv(response, { approvedOnly: false });
});

app.get("/api/exports/approved-contacts.csv", async (_request, response) => {
  await sendContactsCsv(response, { approvedOnly: true });
});

app.get("/api/exports/high-quality-contacts.csv", async (_request, response) => {
  await sendContactsCsv(response, { highQualityOnly: true });
});

app.get("/api/exports/outreach-ready-contacts.csv", async (_request, response) => {
  await sendContactsCsv(response, { outreachReadyOnly: true });
});

app.get("/api/exports/generic-contacts.csv", async (_request, response) => {
  await sendContactsCsv(response, { genericOnly: true });
});

app.get("/api/exports/needs-review.csv", async (_request, response) => {
  await sendContactsCsv(response, { needsReviewOnly: true });
});

app.get("/api/exports/primary-contacts.csv", async (_request, response) => {
  try {
    const companies = await loadCompanies();
    const contacts = await loadContacts();
    const profiles = buildCompanyProfiles(companies, contacts);
    const fields = [
      "company_name",
      "website",
      "phone",
      "city",
      "state",
      "industry_category",
      "source",
      "lead_score",
      "lead_label",
      "outreach_ready",
      "primary_contact_name",
      "primary_contact_title",
      "primary_email",
      "email_status",
      "contact_type",
      "review_status",
      "notes",
      "primary_contact_phone",
      "linkedin_url",
      "decision_maker",
      "contact_confidence_score",
      "source_url",
    ];

    const rows = [fields.join(",")];
    profiles.forEach((profile) => {
      rows.push(
        fields
          .map((field) =>
            escapeCsvValue(
              {
                company_name: profile.name,
                website: profile.website,
                phone: profile.phone,
                city: profile.city,
                state: profile.state,
                industry_category: profile.industry || profile.keyword || "",
                source: profile.source,
                lead_score: profile.lead_score,
                lead_label: profile.lead_label,
                outreach_ready: profile.outreach_ready ? "true" : "false",
                primary_contact_name: profile.primary_contact?.name || "",
                primary_contact_title: profile.primary_contact?.title || "",
                primary_email: profile.primary_contact?.email || "",
                email_status: profile.primary_contact?.email_status || "none",
                contact_type: profile.primary_contact?.contact_type || "",
                review_status: profile.review_status,
                notes: profile.notes || "",
                primary_contact_phone: profile.primary_contact?.phone || "",
                linkedin_url: profile.primary_contact?.linkedin_url || "",
                decision_maker: profile.primary_contact?.decision_maker ? "true" : "false",
                contact_confidence_score: profile.primary_contact?.confidence_score || "",
                source_url: profile.primary_contact?.source_url || "",
              }[field]
            )
          )
          .join(",")
      );
    });

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("content-disposition", 'attachment; filename="primary_contacts.csv"');
    response.send(rows.join("\n"));
  } catch (error) {
    response.status(500).json({
      success: false,
      error: "Unable to export primary contacts.",
    });
  }
});

app.get("/api/exports/companies.csv", async (_request, response) => {
  await sendCompaniesCsv(response, {});
});

app.get("/api/exports/high-fit-companies.csv", async (_request, response) => {
  await sendCompaniesCsv(response, { leadLabel: "High Fit" });
});

app.get("/api/exports/phone-only-leads.csv", async (_request, response) => {
  await sendCompaniesCsv(response, { phoneOnly: true });
});

app.get("/api/exports/no-email-leads.csv", async (_request, response) => {
  await sendCompaniesCsv(response, { noEmail: true });
});

app.get("/api/exports/verified-decision-makers.csv", async (_request, response) => {
  await sendContactsCsv(response, { verifiedDecisionMakersOnly: true });
});

app.get("/api/exports/guessed-decision-makers.csv", async (_request, response) => {
  await sendContactsCsv(response, { guessedDecisionMakersOnly: true });
});

app.get("/api/exports/linkedin-decision-makers.csv", async (_request, response) => {
  await sendContactsCsv(response, { linkedInDecisionMakersOnly: true });
});

if (!isVercel) {
  startServer(PORT_CANDIDATES);
}

if (typeof module !== "undefined") {
  module.exports = app;
}

export default app;

async function sendContactsCsv(
  response,
  {
    approvedOnly = false,
    highQualityOnly = false,
    outreachReadyOnly = false,
    genericOnly = false,
    needsReviewOnly = false,
    verifiedDecisionMakersOnly = false,
    guessedDecisionMakersOnly = false,
    linkedInDecisionMakersOnly = false,
  }
) {
  try {
    const contacts = await loadContacts();
    const filteredContacts = contacts.filter((contact) => {
      if (approvedOnly && contact.review_status !== "approved") {
        return false;
      }

      if (highQualityOnly && contact.quality_label !== "high_quality") {
        return false;
      }

      if (outreachReadyOnly && !isOutreachReadyContact(contact)) {
        return false;
      }

      if (genericOnly && contact.contact_type !== "generic_company_contact") {
        return false;
      }

      if (needsReviewOnly && contact.contact_type !== "needs_review") {
        return false;
      }

      if (
        verifiedDecisionMakersOnly &&
        !(contact.decision_maker && contact.email_status === "verified")
      ) {
        return false;
      }

      if (
        guessedDecisionMakersOnly &&
        !(contact.decision_maker && contact.email_status === "guessed")
      ) {
        return false;
      }

      if (
        linkedInDecisionMakersOnly &&
        !(contact.decision_maker && contact.linkedin_url)
      ) {
        return false;
      }

      return true;
    });

    const fields = [
      "company_name",
      "company_website",
      "name",
      "title",
      "email",
      "phone",
      "linkedin_url",
      "contact_page_url",
      "contact_type",
      "decision_maker",
      "priority_contact",
      "is_generic_email",
      "is_email_guessed",
      "email_confidence",
      "email_status",
      "email_guess_pattern",
      "source_url",
      "confidence_score",
      "quality_score",
      "quality_label",
      "extraction_method",
      "evidence_summary",
      "scanned_at",
      "review_status",
      "campaign_status",
      "notes",
    ];

    const rows = [fields.join(",")];
    filteredContacts.forEach((contact) => {
      rows.push(fields.map((field) => escapeCsvValue(contact[field])).join(","));
    });

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${
        approvedOnly
          ? "approved_contacts.csv"
        : highQualityOnly
          ? "high_quality_contacts.csv"
        : outreachReadyOnly
          ? "outreach_ready_contacts.csv"
        : genericOnly
          ? "generic_contacts.csv"
        : needsReviewOnly
          ? "needs_review.csv"
        : verifiedDecisionMakersOnly
          ? "verified_decision_makers.csv"
        : guessedDecisionMakersOnly
          ? "guessed_decision_makers.csv"
        : linkedInDecisionMakersOnly
          ? "linkedin_decision_makers.csv"
            : "contacts.csv"
      }"`
    );
    response.send(rows.join("\n"));
  } catch (error) {
    response.status(500).json({
      success: false,
      error: "Unable to export contacts.",
    });
  }
}

async function sendCompaniesCsv(
  response,
  {
    leadLabel = "",
    phoneOnly = false,
    noEmail = false,
  }
) {
  try {
    const companies = await loadCompanies();
    const contacts = await loadContacts();
    const profiles = buildCompanyProfiles(companies, contacts);
    const filteredProfiles = profiles.filter((profile) => {
      if (leadLabel && profile.lead_label !== leadLabel) {
        return false;
      }

      if (phoneOnly && !(profile.has_phone && !profile.has_valid_email)) {
        return false;
      }

      if (noEmail && profile.has_valid_email) {
        return false;
      }

      return true;
    });
    const fields = [
      "company_name",
      "website",
      "phone",
      "city",
      "state",
      "industry_category",
      "source",
      "lead_score",
      "lead_label",
      "outreach_ready",
      "primary_contact_name",
      "primary_contact_title",
      "primary_email",
      "email_status",
      "contact_type",
      "review_status",
      "notes",
    ];

    const rows = [fields.join(",")];
    filteredProfiles.forEach((profile) => {
      rows.push(
        fields
          .map((field) =>
            escapeCsvValue(
              {
                company_name: profile.name,
                website: profile.website,
                phone: profile.phone || profile.primary_contact?.phone || "",
                city: profile.city,
                state: profile.state,
                industry_category: profile.industry || profile.keyword || "",
                source: profile.source,
                lead_score: profile.lead_score,
                lead_label: profile.lead_label,
                outreach_ready: profile.outreach_ready ? "true" : "false",
                primary_contact_name: profile.primary_contact?.name || "",
                primary_contact_title: profile.primary_contact?.title || "",
                primary_email: profile.primary_contact?.email || "",
                email_status: profile.primary_contact?.email_status || "none",
                contact_type: profile.primary_contact?.contact_type || "",
                review_status: profile.review_status,
                notes: profile.notes || "",
              }[field]
            )
          )
          .join(",")
      );
    });

    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader(
      "content-disposition",
      `attachment; filename="${
        leadLabel
          ? "high_fit_companies.csv"
          : phoneOnly
            ? "phone_only_leads.csv"
            : noEmail
              ? "no_email_leads.csv"
              : "companies.csv"
      }"`
    );
    response.send(rows.join("\n"));
  } catch (error) {
    response.status(500).json({
      success: false,
      error: "Unable to export companies.",
    });
  }
}

function mapStoredContactToApiContact(contact) {
  return {
    name: contact.name || "Unknown",
    title: contact.title || "Website Contact",
    email: contact.email || "",
    phone: contact.phone || "",
    linkedin_url: contact.linkedin_url || "",
    contact_page_url: contact.contact_page_url || contact.source_url || "",
    contact_type: contact.contact_type || "needs_review",
    priority_contact: Boolean(contact.priority_contact),
    is_generic_email: Boolean(contact.is_generic_email),
    source_url: contact.source_url || contact.company_website || "",
    confidence_score: contact.confidence_score || 0.72,
    quality_score: Number(contact.quality_score || 0),
    quality_label: contact.quality_label || "needs_review",
    evidence_summary: contact.evidence_summary || "",
    decision_maker: Boolean(contact.decision_maker),
    is_email_guessed: Boolean(contact.is_email_guessed),
    email_confidence: contact.email_confidence || "missing",
    email_status: contact.email_status || "none",
    email_guess_pattern: contact.email_guess_pattern || "",
    extraction_method: contact.extraction_method || "regex",
    review_status: contact.review_status || "new",
    campaign_status: contact.campaign_status || "not_contacted",
    notes: contact.notes || "",
    scanned_at: contact.scanned_at || "",
    company_name: contact.company_name || "Unknown",
    company_website: contact.company_website || "",
  };
}

function buildCompanyProfiles(companies, contacts) {
  const contactsByWebsite = new Map();

  contacts.forEach((contact) => {
    const key = normalizeWebsiteKey(contact.company_website);
    if (!key) {
      return;
    }

    const existing = contactsByWebsite.get(key) || [];
    existing.push(mapStoredContactToApiContact(contact));
    contactsByWebsite.set(key, existing);
  });

  return companies.map((company) => {
    const companyContacts = sortPersonnelContacts(
      contactsByWebsite.get(normalizeWebsiteKey(company.website)) || []
    );
    const primaryContact = selectPrimaryContact(companyContacts);
    const leadQuality = scoreCompanyLead(
      {
        ...company,
        primary_contact: primaryContact,
      },
      companyContacts
    );
    const reviewStatus = getCompanyReviewStatus(companyContacts);

    return {
      ...company,
      contacts: companyContacts,
      contacts_found: companyContacts.length,
      last_scanned: companyContacts.map((contact) => contact.scanned_at || "").sort().at(-1) || "",
      primary_contact: primaryContact,
      has_primary_contact: Boolean(primaryContact),
      has_email: companyContacts.some((contact) => contact.email),
      has_valid_email: companyContacts.some((contact) =>
        ["verified", "generic"].includes(String(contact.email_status || "").toLowerCase())
      ),
      has_phone: Boolean(company.phone) || companyContacts.some((contact) => contact.phone),
      needs_review: companyContacts.some(
        (contact) =>
          contact.contact_type === "needs_review" || contact.review_status === "bad"
      ),
      review_status: reviewStatus,
      notes: "",
      ...leadQuality,
      scan_status: companyContacts.length > 0 ? "contacts_found" : "not_scanned",
    };
  });
}

function isOutreachReadyContact(contact) {
  return (
    contact.email &&
    contact.review_status !== "bad" &&
    ["verified", "generic"].includes(String(contact.email_status || "").toLowerCase()) &&
    Number(contact.confidence_score || 0) >= 55
  );
}

function getCompanyReviewStatus(contacts) {
  if (!contacts.length) {
    return "not_reviewed";
  }

  if (contacts.some((contact) => contact.review_status === "approved")) {
    return "approved";
  }

  if (contacts.every((contact) => contact.review_status === "bad")) {
    return "rejected";
  }

  if (contacts.some((contact) => contact.review_status === "bad")) {
    return "needs_review";
  }

  return "new";
}

function normalizeWebsiteKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function mapGooglePlaceToProspect(place, { businessType, city, state }) {
  const placeId = place?.id || extractPlaceId(place?.name);
  const websiteUrl = String(place?.websiteUri || "").trim();
  const rating = Number(place?.rating || 0);
  const reviewCount = Number(place?.userRatingCount || 0);
  const opportunityScore = scoreGoogleProspect({ websiteUrl, rating, reviewCount });

  return {
    id: placeId ? `google-${placeId}` : makeManualId(place?.displayName?.text, place?.formattedAddress),
    placeId,
    businessName: place?.displayName?.text || "Unknown",
    businessType,
    address: place?.formattedAddress || "",
    phone: place?.nationalPhoneNumber || "",
    rating,
    reviewCount,
    websiteUrl,
    websiteStatus: websiteUrl ? "Has Website = Yes" : "Has Website = No",
    hasWebsite: Boolean(websiteUrl),
    googleProfileUrl: place?.googleMapsUri || "",
    mapsUrl: place?.googleMapsUri || "",
    source: "Google Places",
    opportunityScore,
    prospectStatus: "New Lead",
    mobileAppStatus: "Unknown",
    hasMobileApp: null,
    bookingPlatform: "Unknown",
    city,
    state,
  };
}

function matchesWebsiteCondition(prospect, websiteCondition) {
  if (!websiteCondition) {
    return true;
  }

  if (websiteCondition === "no_website") {
    return !prospect.hasWebsite;
  }

  if (websiteCondition === "has_website") {
    return prospect.hasWebsite;
  }

  if (websiteCondition === "unknown") {
    return !prospect.websiteStatus || prospect.websiteStatus === "Unknown";
  }

  return true;
}

function scoreGoogleProspect({ websiteUrl, rating, reviewCount }) {
  let score = websiteUrl ? 58 : 88;

  if (rating >= 4.5) {
    score += 6;
  }

  if (reviewCount >= 50) {
    score += 6;
  }

  return Math.min(100, score);
}

function extractPlaceId(resourceName) {
  const raw = String(resourceName || "").trim();
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

function makeManualId(name, address) {
  return `google-${String(`${name || "prospect"}-${address || ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

function compactErrorBody(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function startServer(portCandidates) {
  const [port, ...remainingPorts] = portCandidates;

  if (!port) {
    throw new Error("No available port found. Tried 3000, 3001, and 3002.");
  }

  const server = app
    .listen(port, () => {
      console.log(`Server running at http://localhost:${port}/viewer/`);
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE" && remainingPorts.length > 0) {
        startServer(remainingPorts);
        return;
      }

      throw error;
    });

  return server;
}
