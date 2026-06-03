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

app.get("/api/prospects/check-website-quality", async (request, response) => {
  try {
    const websiteUrl = String(request.query.websiteUrl || "").trim();
    const businessName = String(request.query.businessName || "").trim();

    if (!websiteUrl) {
      response.status(400).json({
        success: false,
        error: "websiteUrl is required.",
        quality: null,
      });
      return;
    }

    const quality = await analyzeWebsiteQuality(websiteUrl, { businessName });
    response.json({
      success: true,
      quality,
      error: null,
    });
  } catch (error) {
    response.status(502).json({
      success: false,
      quality: null,
      error: "Unable to check website quality.",
    });
  }
});

app.post("/api/prospects/enrich-contact", async (request, response) => {
  try {
    const websiteUrl = String(request.body?.websiteUrl || "").trim();
    const businessName = String(request.body?.businessName || "").trim();
    const sourceUrl = String(request.body?.sourceUrl || "").trim();
    const enrichment = await enrichProspectContactInfo({ websiteUrl, businessName, sourceUrl });
    response.json({
      success: true,
      enrichment,
      error: null,
    });
  } catch (error) {
    response.status(502).json({
      success: false,
      enrichment: {
        enrichmentStatus: "Failed",
        enrichmentCheckedAt: new Date().toISOString(),
        enrichmentNotes: "Unable to enrich contact info.",
      },
      error: "Unable to enrich contact info.",
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
  const businessName = place?.displayName?.text || "Unknown";
  const websiteModel = classifyWebsiteStatus(websiteUrl, {
    businessName,
  });
  const opportunityScore = scoreGoogleProspect({
    websiteStatus: websiteModel.websiteStatus,
    rating,
    reviewCount,
    phone: place?.nationalPhoneNumber,
    address: place?.formattedAddress,
    businessName,
  });
  const reasonChips = buildProspectReasonChips({
    websiteStatus: websiteModel.websiteStatus,
    rating,
    reviewCount,
    phone: place?.nationalPhoneNumber,
    address: place?.formattedAddress,
    bookingPlatform: websiteModel.bookingPlatform,
    socialPlatform: websiteModel.socialPlatform,
    opportunityScore,
    businessName,
  });

  return {
    id: placeId ? `google-${placeId}` : makeManualId(place?.displayName?.text, place?.formattedAddress),
    placeId,
    businessName,
    businessType,
    address: place?.formattedAddress || "",
    phone: place?.nationalPhoneNumber || "",
    rating,
    reviewCount,
    websiteUrl,
    websiteStatus: websiteModel.websiteStatus,
    hasWebsite: websiteModel.hasWebsite,
    socialPlatform: websiteModel.socialPlatform,
    googleProfileUrl: place?.googleMapsUri || "",
    mapsUrl: place?.googleMapsUri || "",
    source: "Google Places",
    opportunityScore,
    opportunityPriority: getOpportunityPriority(opportunityScore),
    scoreReasons: reasonChips,
    reasonChips,
    prospectStatus: "New Lead",
    mobileAppStatus: "Unknown",
    hasMobileApp: null,
    bookingPlatform: websiteModel.bookingPlatform,
    city,
    state,
  };
}

function matchesWebsiteCondition(prospect, websiteCondition) {
  if (!websiteCondition) {
    return true;
  }

  if (websiteCondition === "no_website") {
    return ["No Website", "Social Only", "Booking Link Only", "Broken Website"].includes(prospect.websiteStatus);
  }

  if (websiteCondition === "has_website") {
    return prospect.websiteStatus === "Has Website";
  }

  if (websiteCondition === "social_only") {
    return prospect.websiteStatus === "Social Only";
  }

  if (websiteCondition === "booking_link_only") {
    return prospect.websiteStatus === "Booking Link Only";
  }

  if (websiteCondition === "weak_website") {
    return prospect.websiteStatus === "Weak Website";
  }

  if (websiteCondition === "broken_website") {
    return prospect.websiteStatus === "Broken Website";
  }

  if (websiteCondition === "unknown") {
    return !prospect.websiteStatus || prospect.websiteStatus === "Unknown";
  }

  return true;
}

function classifyWebsiteStatus(websiteUrl, { businessName = "", scanFailureReason = "" } = {}) {
  const url = String(websiteUrl || "").trim();
  const normalizedUrl = url.toLowerCase();

  if (!url || isUnavailableWebsiteValue(normalizedUrl)) {
    return {
      websiteStatus: "No Website",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  if (isSocialProfileUrl(normalizedUrl)) {
    return {
      websiteStatus: "Social Only",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: detectSocialPlatform(normalizedUrl),
    };
  }

  const bookingPlatform = detectBookingPlatform(normalizedUrl);
  if (bookingPlatform !== "Unknown") {
    return {
      websiteStatus: "Booking Link Only",
      hasWebsite: false,
      bookingPlatform,
      socialPlatform: "Unknown",
    };
  }

  if (isClearlyBrokenWebsite(normalizedUrl, scanFailureReason)) {
    return {
      websiteStatus: "Broken Website",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  if (looksLikeOwnedWebsite(normalizedUrl, businessName)) {
    return {
      websiteStatus: "Has Website",
      hasWebsite: true,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  return {
    websiteStatus: "Unknown",
    hasWebsite: null,
    bookingPlatform: "Unknown",
    socialPlatform: "Unknown",
  };
}

function detectBookingPlatform(value) {
  const patterns = [
    ["Fresha", /fresha\.com/i],
    ["Booksy", /booksy\.com/i],
    ["Vagaro", /vagaro\.com/i],
    ["GlossGenius", /glossgenius\.com/i],
    ["Square", /(square\.site|squareup\.com\/appointments|appointments\.squareup\.com|squareup\.com)/i],
    ["Mindbody", /mindbodyonline\.com/i],
    ["Schedulicity", /schedulicity\.com/i],
    ["StyleSeat", /styleseat\.com/i],
    ["Acuity", /acuityscheduling\.com/i],
    ["Calendly", /calendly\.com/i],
    ["Setmore", /setmore\.com/i],
    ["SimplyBook", /simplybook\.me/i],
    ["Zenoti", /zenoti\.com/i],
    ["Other Booking Platform", /(bookedin\.com|appointment|appointments|booking|book-now|scheduler|reservation)/i],
  ];
  const match = patterns.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : "Unknown";
}

function isSocialProfileUrl(value) {
  return /(facebook\.com|instagram\.com|linktr\.ee|yelp\.com|google\.com\/maps|business\.google\.com|g\.page|tiktok\.com|x\.com|twitter\.com)/i.test(
    value
  );
}

function detectSocialPlatform(value) {
  if (/facebook\.com/i.test(value)) {
    return "Facebook";
  }

  if (/instagram\.com/i.test(value)) {
    return "Instagram";
  }

  if (/yelp\.com/i.test(value)) {
    return "Yelp";
  }

  if (/linktr\.ee/i.test(value)) {
    return "Linktree";
  }

  if (/tiktok\.com/i.test(value)) {
    return "TikTok";
  }

  if (/google\.com\/maps|business\.google\.com|g\.page/i.test(value)) {
    return "Google Maps";
  }

  if (/x\.com|twitter\.com/i.test(value)) {
    return "X";
  }

  return "Other Social/Profile";
}

function isUnavailableWebsiteValue(value) {
  return /^(na|n\/a|none|null|unknown|unavailable|not available|no website)$/i.test(String(value || "").trim());
}

function isClearlyBrokenWebsite(value, scanFailureReason) {
  if (/(blocked|failed|timeout|unreachable|404|error)/i.test(String(scanFailureReason || ""))) {
    return true;
  }

  if (/[<>\\\s]/.test(value)) {
    return true;
  }

  try {
    const candidate = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
    const parsed = new URL(candidate);
    return !parsed.hostname.includes(".");
  } catch {
    return true;
  }
}

function looksLikeOwnedWebsite(value, businessName) {
  if (!value) {
    return false;
  }

  if (isSocialProfileUrl(value) || detectBookingPlatform(value) !== "Unknown") {
    return false;
  }

  const normalizedBusinessName = String(businessName || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const normalizedUrl = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalizedBusinessName && normalizedUrl.includes(normalizedBusinessName)) {
    return true;
  }

  return true;
}

function isLikelyChainBusiness(name) {
  return /(\bgreat clips\b|\bsupercuts\b|\bsport clips\b|\bfantastic sams\b|\bmassage envy\b|\beuropean wax center\b|\bthe lash lounge\b|\bamazing lash studio\b|\bhand & stone\b|\bpalm beach tan\b|\bulta\b|\bsephora\b|\bregis\b|\bcost cutters\b|\bjcpenney\b|\bwalmart\b|\btarget\b|\bcostco\b)/i.test(
    String(name || "")
  );
}

function getOpportunityPriority(score) {
  const numeric = Number(score || 0);

  if (numeric >= 80) {
    return "Best Prospect";
  }

  if (numeric >= 60) {
    return "Strong Prospect";
  }

  if (numeric >= 40) {
    return "Needs Review";
  }

  if (numeric >= 20) {
    return "Low Priority";
  }

  return "Not Recommended";
}

function buildProspectReasonChips({
  websiteStatus,
  rating,
  reviewCount,
  phone,
  address,
  bookingPlatform,
  socialPlatform,
  opportunityScore,
  businessName,
}) {
  const reasons = [];

  if (websiteStatus === "No Website") {
    reasons.push("No owned website");
  } else if (websiteStatus === "Social Only") {
    reasons.push("Social profile only");
  } else if (websiteStatus === "Booking Link Only") {
    reasons.push("Booking platform only");
  } else if (websiteStatus === "Weak Website") {
    reasons.push("Weak website");
  } else if (websiteStatus === "Broken Website") {
    reasons.push("Broken website");
  } else if (websiteStatus === "Has Website") {
    reasons.push("Strong website, lower priority");
  }

  if (rating >= 4.3 && reviewCount >= 25) {
    reasons.push("Strong reviews");
  }

  if (String(phone || "").trim()) {
    reasons.push("Phone available");
  } else {
    reasons.push("Missing phone");
  }

  if (String(address || "").trim()) {
    reasons.push("Address available");
  }

  if (bookingPlatform && bookingPlatform !== "Unknown") {
    reasons.push("Booking platform only");
  }

  if (socialPlatform && socialPlatform !== "Unknown") {
    reasons.push("Social profile only");
  }

  if (isLikelyChainBusiness(businessName)) {
    reasons.push("Possible chain/franchise");
  }

  if (!reasons.length) {
    reasons.push("Needs review");
  }

  return [...new Set(reasons)].slice(0, 4);
}

function scoreGoogleProspect({ websiteStatus, rating, reviewCount, phone, address, businessName }) {
  let score = 40;

  if (websiteStatus === "No Website") {
    score += 30;
  } else if (websiteStatus === "Social Only") {
    score += 25;
  } else if (websiteStatus === "Booking Link Only") {
    score += 25;
  } else if (websiteStatus === "Broken Website") {
    score += 25;
  } else if (websiteStatus === "Weak Website") {
    score += 20;
  } else if (websiteStatus === "Needs Review") {
    score += 10;
  } else if (websiteStatus === "Has Website") {
    score -= 15;
  } else if (websiteStatus === "Unknown") {
    score += 5;
  }

  if (String(phone || "").trim()) {
    score += 10;
  } else {
    score -= 10;
  }

  if (String(address || "").trim()) {
    score += 5;
  }

  if (rating >= 4.3) {
    score += 10;
  } else if (rating >= 4) {
    score += 6;
  } else if (rating > 0 && rating < 3.8) {
    score -= 10;
  }

  if (reviewCount >= 25) {
    score += 10;
  } else if (reviewCount >= 10) {
    score += 5;
  } else if (reviewCount > 0 && reviewCount < 5) {
    score -= 5;
  }

  if (!isLikelyChainBusiness(businessName)) {
    score += 8;
  } else {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

async function analyzeWebsiteQuality(websiteUrl, { businessName = "" } = {}) {
  const website = String(websiteUrl || "").trim();
  if (!website) {
    return {
      websiteQualityStatus: "Not Checked",
      websiteQualityScore: 0,
      websiteQualityReasons: ["No website URL"],
      websiteCheckStatus: "Needs Review",
      websiteCheckedAt: new Date().toISOString(),
      websiteStatus: "No Website",
      hasWebsite: false,
    };
  }

  const websiteModel = classifyWebsiteStatus(website, { businessName });
  if (websiteModel.websiteStatus === "No Website" || websiteModel.websiteStatus === "Social Only" || websiteModel.websiteStatus === "Booking Link Only") {
    return {
      websiteQualityStatus: websiteModel.websiteStatus === "No Website" ? "Not Checked" : "Needs Review",
      websiteQualityScore: websiteModel.websiteStatus === "No Website" ? 0 : 25,
      websiteQualityReasons: [getWebsiteQualityReasonLabel(websiteModel.websiteStatus)],
      websiteCheckStatus: "Needs Review",
      websiteCheckedAt: new Date().toISOString(),
      websiteStatus: websiteModel.websiteStatus,
      hasWebsite: websiteModel.hasWebsite,
      bookingPlatform: websiteModel.bookingPlatform,
      socialPlatform: websiteModel.socialPlatform,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const candidateUrls = buildWebsiteCandidateUrls(website);
    let lastError = null;

    for (const candidateUrl of candidateUrls) {
      try {
        const response = await fetch(candidateUrl, {
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml",
            "user-agent": "ClientFinder/1.0",
          },
        });

        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        const body = await response.text();

        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }

        if (!contentType.includes("text/html")) {
          return {
            websiteQualityStatus: "Needs Review",
            websiteQualityScore: 35,
            websiteQualityReasons: ["Response is not HTML"],
            websiteCheckStatus: "Needs Review",
            websiteCheckedAt: new Date().toISOString(),
            websiteStatus: websiteModel.websiteStatus,
            hasWebsite: websiteModel.hasWebsite,
            bookingPlatform: websiteModel.bookingPlatform,
            socialPlatform: websiteModel.socialPlatform,
          };
        }

        const signals = extractHomepageSignals(body, response.url || candidateUrl, businessName);
        const score = calculateWebsiteQualityScore(signals);
        const status = score >= 80 ? "Strong Website" : score >= 50 ? "Needs Review" : score > 0 ? "Weak Website" : "Broken Website";
        return {
          websiteQualityStatus: status,
          websiteQualityScore: score,
          websiteQualityReasons: getWebsiteQualityReasons(signals, score).slice(0, 6),
          websiteCheckStatus: "Checked",
          websiteCheckedAt: new Date().toISOString(),
          websiteStatus: score <= 0 ? "Broken Website" : websiteModel.websiteStatus,
          hasWebsite: score <= 0 ? false : websiteModel.hasWebsite,
          bookingPlatform: websiteModel.bookingPlatform,
          socialPlatform: websiteModel.socialPlatform,
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      websiteQualityStatus: "Broken Website",
      websiteQualityScore: 0,
      websiteQualityReasons: [compactErrorBody(lastError?.message || "Website fetch failed")],
      websiteCheckStatus: "Broken Website",
      websiteCheckedAt: new Date().toISOString(),
      websiteStatus: "Broken Website",
      hasWebsite: false,
      bookingPlatform: websiteModel.bookingPlatform,
      socialPlatform: websiteModel.socialPlatform,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichProspectContactInfo({ websiteUrl, businessName = "", sourceUrl = "" } = {}) {
  const now = new Date().toISOString();
  const website = String(websiteUrl || "").trim();
  const base = {
    primaryEmail: "",
    additionalEmails: [],
    contactPersonName: "",
    contactPersonTitle: "",
    facebookUrl: "",
    instagramUrl: "",
    linkedinUrl: "",
    websiteContactPageUrl: "",
    bookingUrl: "",
    sourceLinks: [sourceUrl].filter(Boolean),
    enrichmentStatus: "Not Checked",
    enrichmentCheckedAt: now,
    enrichmentNotes: "",
  };

  if (!website) {
    return {
      ...base,
      enrichmentStatus: "No Extra Info Found",
      enrichmentNotes: "No website URL available.",
    };
  }

  const websiteModel = classifyWebsiteStatus(website, { businessName });
  if (websiteModel.websiteStatus === "No Website") {
    return {
      ...base,
      enrichmentStatus: "No Extra Info Found",
      enrichmentNotes: "No normal website URL available.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const candidateUrls = buildWebsiteCandidateUrls(website);
    for (const candidateUrl of candidateUrls) {
      const homepageResponse = await fetch(candidateUrl, {
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "ClientFinder/1.0",
        },
      });
      const contentType = String(homepageResponse.headers.get("content-type") || "").toLowerCase();
      if (!homepageResponse.ok || !contentType.includes("text/html")) {
        continue;
      }

      const html = await homepageResponse.text();
      const resolvedUrl = homepageResponse.url || candidateUrl;
      const emails = extractEmailsFromHtml(html);
      const socialLinks = extractSocialLinksFromHtml(html, resolvedUrl);
      const booking = extractBookingLinksFromHtml(html, resolvedUrl);
      const contactPage = extractFirstMatchingLink(html, resolvedUrl, /(contact|about)/i);
      const sourceLinks = dedupeValues([
        sourceUrl,
        resolvedUrl,
        contactPage,
        socialLinks.facebookUrl,
        socialLinks.instagramUrl,
        socialLinks.linkedinUrl,
        booking.bookingUrl,
      ]);
      const foundCount = emails.length + Object.values(socialLinks).filter(Boolean).length + (booking.bookingUrl ? 1 : 0) + (contactPage ? 1 : 0);

      return {
        ...base,
        primaryEmail: emails[0] || "",
        additionalEmails: emails.slice(1),
        facebookUrl: socialLinks.facebookUrl || "",
        instagramUrl: socialLinks.instagramUrl || "",
        linkedinUrl: socialLinks.linkedinUrl || "",
        websiteContactPageUrl: contactPage || "",
        bookingUrl: booking.bookingUrl || "",
        bookingPlatform: booking.bookingPlatform || websiteModel.bookingPlatform || "Unknown",
        socialPlatform: socialLinks.socialPlatform || websiteModel.socialPlatform || "Unknown",
        sourceLinks,
        enrichmentStatus: foundCount >= 2 ? "Enriched" : foundCount === 1 ? "Partial" : "No Extra Info Found",
        enrichmentNotes: foundCount ? "Homepage checked for email, social, contact, and booking links." : "Homepage checked; no extra info found.",
      };
    }

    return {
      ...base,
      enrichmentStatus: "Needs Review",
      enrichmentNotes: "Website did not return a readable HTML homepage.",
    };
  } catch (error) {
    return {
      ...base,
      enrichmentStatus: "Failed",
      enrichmentNotes: "Homepage enrichment failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractEmailsFromHtml(html) {
  const body = String(html || "");
  const mailtoEmails = [...body.matchAll(/mailto:([^"'?\s>]+)/gi)].map((match) => decodeURIComponent(match[1]));
  const visibleEmails = [...body.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
  return dedupeValues([...mailtoEmails, ...visibleEmails])
    .filter((email) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email))
    .slice(0, 5);
}

function extractSocialLinksFromHtml(html, baseUrl) {
  const links = extractLinksFromHtml(html, baseUrl);
  const facebookUrl = links.find((url) => /facebook\.com/i.test(url)) || "";
  const instagramUrl = links.find((url) => /instagram\.com/i.test(url)) || "";
  const linkedinUrl = links.find((url) => /linkedin\.com/i.test(url)) || "";
  const tiktokUrl = links.find((url) => /tiktok\.com/i.test(url)) || "";
  return {
    facebookUrl,
    instagramUrl,
    linkedinUrl,
    tiktokUrl,
    socialPlatform: facebookUrl ? "Facebook" : instagramUrl ? "Instagram" : linkedinUrl ? "LinkedIn" : tiktokUrl ? "TikTok" : "Unknown",
  };
}

function extractBookingLinksFromHtml(html, baseUrl) {
  const links = extractLinksFromHtml(html, baseUrl);
  const bookingUrl =
    links.find((url) => /(fresha|booksy|vagaro|glossgenius|squareup|mindbody|calendly|acuity|setmore|simplybook)/i.test(url)) ||
    links.find((url) => /(book|booking|appointment|schedule)/i.test(url)) ||
    "";
  return {
    bookingUrl,
    bookingPlatform: detectEnrichmentBookingPlatform(bookingUrl),
  };
}

function extractFirstMatchingLink(html, baseUrl, pattern) {
  return extractLinksFromHtml(html, baseUrl).find((url) => pattern.test(url)) || "";
}

function extractLinksFromHtml(html, baseUrl) {
  return dedupeValues(
    [...String(html || "").matchAll(/href=["']([^"']+)["']/gi)]
      .map((match) => resolveHomepageLink(match[1], baseUrl))
      .filter(Boolean)
  ).slice(0, 100);
}

function resolveHomepageLink(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || /^(javascript:|tel:|sms:)/i.test(raw)) {
    return "";
  }
  if (/^mailto:/i.test(raw)) {
    return raw;
  }
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

function detectEnrichmentBookingPlatform(url) {
  const value = String(url || "").toLowerCase();
  if (!value) return "Unknown";
  if (value.includes("fresha")) return "Fresha";
  if (value.includes("booksy")) return "Booksy";
  if (value.includes("vagaro")) return "Vagaro";
  if (value.includes("glossgenius")) return "GlossGenius";
  if (value.includes("squareup")) return "Square";
  if (value.includes("mindbody")) return "Mindbody";
  if (value.includes("calendly")) return "Calendly";
  if (value.includes("acuity")) return "Acuity";
  if (value.includes("setmore")) return "Setmore";
  if (value.includes("simplybook")) return "SimplyBook";
  if (/(book|booking|appointment|schedule)/i.test(value)) return "Other Booking Platform";
  return "Unknown";
}

function dedupeValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getWebsiteQualityReasonLabel(websiteStatus) {
  switch (String(websiteStatus || "").trim()) {
    case "No Website":
      return "No website found";
    case "Social Only":
      return "Social profile only";
    case "Booking Link Only":
      return "Booking platform only";
    case "Broken Website":
      return "Broken website";
    case "Has Website":
      return "Has owned website";
    default:
      return "Needs review";
  }
}

function buildWebsiteCandidateUrls(websiteUrl) {
  const raw = String(websiteUrl || "").trim();
  if (!raw) {
    return [];
  }

  const candidates = [];
  const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  candidates.push(normalized);
  if (normalized.startsWith("https://")) {
    candidates.push(normalized.replace(/^https:\/\//i, "http://"));
  }
  return [...new Set(candidates)];
}

function extractHomepageSignals(html, pageUrl, businessName) {
  const text = String(html || "").toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripHtmlTags(match[1])).filter(Boolean);
  const bodyText = stripHtmlTags(html).toLowerCase();
  const visibleText = bodyText.replace(/\s+/g, " ").trim();
  return {
    pageUrl: String(pageUrl || ""),
    businessName: String(businessName || ""),
    title: stripHtmlTags(titleMatch?.[1] || "").trim(),
    description: stripHtmlTags(metaDescriptionMatch?.[1] || "").trim(),
    h1Count: h1Matches.length,
    visibleText,
    text,
  };
}

function calculateWebsiteQualityScore(signals) {
  let score = 100;
  const reasons = getWebsiteQualityReasonFlags(signals);

  if (!signals.title || isGenericTitle(signals.title)) {
    score -= 15;
  }

  if (!reasons.hasServices) {
    score -= 15;
  }

  if (!reasons.hasPricing) {
    score -= 10;
  }

  if (!reasons.hasBookingOrContact) {
    score -= 12;
  }

  if (!reasons.hasGallery) {
    score -= 8;
  }

  if (!reasons.hasContactPhone) {
    score -= 8;
  }

  if (reasons.isPlaceholder) {
    score -= 25;
  }

  if (reasons.isParked) {
    score -= 40;
  }

  if (reasons.isSocialOrBookingOnly) {
    score -= 50;
  }

  if (signals.visibleText.length < 180) {
    score -= 12;
  }

  return Math.max(0, Math.min(100, score));
}

function getWebsiteQualityReasons(signals, score) {
  const flags = getWebsiteQualityReasonFlags(signals);
  const reasons = [];

  if (flags.isParked) {
    reasons.push("Parked domain");
  }
  if (flags.isPlaceholder) {
    reasons.push("Basic placeholder site");
  }
  if (!flags.hasServices) {
    reasons.push("No services keyword");
  }
  if (!flags.hasPricing) {
    reasons.push("No pricing info");
  }
  if (!flags.hasBookingOrContact) {
    reasons.push("No booking/contact CTA");
  }
  if (!flags.hasGallery) {
    reasons.push("No gallery or portfolio");
  }
  if (!flags.hasContactPhone) {
    reasons.push("No phone or contact details");
  }
  if (isGenericTitle(signals.title)) {
    reasons.push("Generic title");
  }
  if (score >= 80) {
    reasons.push("Strong website");
  } else if (score >= 50) {
    reasons.push("Needs review");
  } else if (score > 0) {
    reasons.push("Weak website");
  }

  return [...new Set(reasons)].slice(0, 6);
}

function getWebsiteQualityReasonFlags(signals) {
  const body = String(signals.visibleText || "");
  const lower = body.toLowerCase();
  const title = String(signals.title || "").toLowerCase();
  const description = String(signals.description || "").toLowerCase();
  const text = `${title} ${description} ${lower}`;
  const hasServices = /(services|menu|treatments|hair|nails|spa|beauty|haircut|styling)/i.test(text);
  const hasPricing = /(pricing|prices|rates|packages)/i.test(text);
  const hasBookingOrContact = /(book|appointment|schedule|contact|call|reserve)/i.test(text);
  const hasGallery = /(gallery|portfolio|photos|work|results)/i.test(text);
  const hasContactPhone = /(tel:|phone|call us|\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4})/i.test(text);
  const isParked = /(this domain|parked|for sale|buy this domain|under construction)/i.test(text);
  const isPlaceholder = /(coming soon|website under construction|launching soon|one page|template)/i.test(text) || body.length < 350;
  const isSocialOrBookingOnly = false;
  return {
    hasServices,
    hasPricing,
    hasBookingOrContact,
    hasGallery,
    hasContactPhone,
    isParked,
    isPlaceholder,
    isSocialOrBookingOnly,
  };
}

function isGenericTitle(title) {
  const normalized = String(title || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return /(home|welcome|index|website|page|untitled|coming soon|placeholder|template)/i.test(normalized) || normalized.length < 4;
}

function stripHtmlTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
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
