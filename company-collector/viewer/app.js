import { createScanner, SCAN_STATUS } from "./scanner.js";
import { renderDetailPanel, renderResultsView } from "./ui.js";

const DEFAULT_INDUSTRY = "Salon & Beauty";
const DEFAULT_SEARCH_KEYWORD = "Salon";
const DEFAULT_STATE = "TX";
const SAVED_SEARCHES_KEY = "find-any-company.saved-searches";
const SAVED_COMPANIES_KEY = "find-any-company.saved-companies";
const PROSPECT_WORKFLOWS_KEY = "find-any-company.prospect-workflows";
const MANUAL_PROSPECTS_KEY = "find-any-company.manual-prospects";
const HIDDEN_PROSPECTS_KEY = "find-any-company.hidden-prospects";
const SENDER_PROFILE_KEY = "find-any-company.sender-profile";
const SCAN_QUEUE_KEY = "find-any-company.scan-queue";
const DEFAULT_BATCH_CITIES = [
  { city: "Dallas", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "Houston", state: "TX" },
  { city: "San Antonio", state: "TX" },
  { city: "Fort Worth", state: "TX" },
];

const BUSINESS_TYPE_GROUPS = {
  "Salon & Beauty": {
    query: "local beauty services",
    tags: ["Local Beauty", "Website Prospect"],
    types: {
      Salon: "salon beauty salon local beauty services",
      "Hair Salon": "hair salon beauty salon stylist local beauty services",
      "Nail Salon": "nail salon manicure pedicure local beauty services",
      Barbershop: "barbershop barber men's grooming local beauty services",
      "Lash Studio": "lash studio eyelash extensions local beauty services",
      "Brow Studio": "brow studio eyebrow threading waxing local beauty services",
      Spa: "spa day spa facial massage local beauty services",
      "Med Spa": "med spa medical spa aesthetics local beauty services",
    },
  },
  "Home Services": {
    query: "home services contractor local service business",
    tags: ["Home Services", "Local Contractor"],
    types: {
      Construction: "construction contractor building services local contractor",
      Plumber: "plumber plumbing contractor local home services",
      Painter: "painter painting contractor local home services",
      Roofing: "roofing roofer roofing contractor local home services",
      Cleaning: "cleaning company house cleaning commercial cleaning local services",
      Landscaping: "landscaping lawn care landscape contractor local home services",
    },
  },
  "Local Services": {
    query: "local service business",
    tags: ["Local Services", "Main Street Business"],
    types: {
      Printing: "printing company print shop local business printing services",
      "Auto Repair": "auto repair mechanic auto service local business",
      Daycare: "daycare childcare preschool local services",
      "Dental Clinic": "dental clinic dentist local healthcare services",
      Restaurant: "restaurant local dining food business",
    },
  },
};

const PROSPECT_STAGES = [
  "New Lead",
  "Saved",
  "Outreach Started",
  "Engaged",
  "Meeting Done",
  "Requirements Discussed",
  "Quote Requested",
  "Quote Sent",
  "Negotiation",
  "Contract Expected",
  "Contract Received",
  "Client Onboarding",
  "Lost",
  "Archived",
];
const QUOTE_STATUSES = ["Not Started", "Quote Requested", "Drafting", "Sent", "Under Review", "Accepted", "Rejected"];

const state = {
  companies: [],
  filteredCompanies: [],
  pagedCompanies: [],
  selectedCompanyId: null,
  currentPage: 1,
  pageSize: 20,
  viewMode: "list",
  activeView: "discovery",
  loading: false,
  sortBy: "best_match",
  activeDetailTab: "overview",
  savedSearches: loadSavedSearches(),
  savedCompanies: loadSavedCompanies(),
  hiddenProspects: loadHiddenProspects(),
  prospectWorkflows: loadProspectWorkflows(),
  manualProspects: loadManualProspects(),
  senderProfile: loadSenderProfile(),
  outreachTemplateDrafts: {},
  targetCities: [],
  batchCollect: {
    running: false,
    currentCity: "",
    completedCities: 0,
    totalCities: 0,
    companiesAdded: 0,
    duplicatesRemoved: 0,
  },
  bulkScan: {
    running: false,
    paused: false,
    canceled: false,
    currentCompany: "",
    completed: 0,
    failed: 0,
    total: 0,
    queue: [],
    currentIndex: 0,
  },
};

const scanner = createScanner();

const elements = {
  globalSearch: document.querySelector("#global-search"),
  industryFilter: document.querySelector("#industry-filter"),
  stateFilter: document.querySelector("#state-filter"),
  cityFilter: document.querySelector("#city-filter"),
  websiteConditionFilter: document.querySelector("#website-condition-filter"),
  mobileAppConditionFilter: document.querySelector("#mobile-app-condition-filter"),
  sourceFilter: document.querySelector("#source-filter"),
  leadScoreFilter: document.querySelector("#lead-score-filter"),
  reviewStatusFilter: document.querySelector("#review-status-filter"),
  contactTypeFilter: document.querySelector("#contact-type-filter"),
  sortBySelect: document.querySelector("#sort-by-select"),
  hasPrimaryFilter: document.querySelector("#has-primary-filter"),
  hasWebsiteFilter: document.querySelector("#has-website-filter"),
  hasEmailFilter: document.querySelector("#has-email-filter"),
  hasPhoneFilter: document.querySelector("#has-phone-filter"),
  highConfidenceFilter: document.querySelector("#high-confidence-filter"),
  needsReviewFilter: document.querySelector("#needs-review-filter"),
  verifiedOnlyFilter: document.querySelector("#verified-only-filter"),
  guessedEmailFilter: document.querySelector("#guessed-email-filter"),
  linkedInFoundFilter: document.querySelector("#linkedin-found-filter"),
  searchButton: document.querySelector("#search-button"),
  collectMoreButton: document.querySelector("#collect-more-button"),
  batchCollectButton: document.querySelector("#batch-collect-button"),
  addTestProspectButton: document.querySelector("#add-test-prospect-button"),
  emptyAddTestProspectButton: document.querySelector("#empty-add-test-prospect-button"),
  saveSearchButton: document.querySelector("#save-search-button"),
  filtersButton: document.querySelector("#filters-button"),
  filtersMenu: document.querySelector("#filters-menu"),
  exportsButton: document.querySelector("#exports-button"),
  exportsMenu: document.querySelector("#exports-menu"),
  pageSizeSelect: document.querySelector("#page-size-select"),
  listViewButton: document.querySelector("#list-view-button"),
  gridViewButton: document.querySelector("#grid-view-button"),
  scanVisibleButton: document.querySelector("#scan-visible-button"),
  exportVisibleButton: document.querySelector("#export-visible-button"),
  exportCompaniesButton: document.querySelector("#export-companies-button"),
  exportHighFitButton: document.querySelector("#export-high-fit-button"),
  exportContactsButton: document.querySelector("#export-contacts-button"),
  exportOutreachButton: document.querySelector("#export-outreach-button"),
  exportPhoneOnlyButton: document.querySelector("#export-phone-only-button"),
  exportNoEmailButton: document.querySelector("#export-no-email-button"),
  exportPrimaryButton: document.querySelector("#export-primary-button"),
  exportVerifiedButton: document.querySelector("#export-verified-button"),
  exportGuessedButton: document.querySelector("#export-guessed-button"),
  exportLinkedInButton: document.querySelector("#export-linkedin-button"),
  resultCount: document.querySelector("#result-count"),
  resultsSubtitle: document.querySelector("#results-subtitle"),
  statusMessage: document.querySelector("#status-message"),
  bulkProgress: document.querySelector("#bulk-progress"),
  batchProgress: document.querySelector("#batch-progress"),
  resultsContainer: document.querySelector("#results-container"),
  loadingState: document.querySelector("#loading-state"),
  emptyState: document.querySelector("#empty-state"),
  prevPageButton: document.querySelector("#prev-page-button"),
  nextPageButton: document.querySelector("#next-page-button"),
  pageIndicator: document.querySelector("#page-indicator"),
  totalCompanies: document.querySelector("#total-companies"),
  companiesScanned: document.querySelector("#companies-scanned"),
  primaryContacts: document.querySelector("#primary-contacts"),
  verifiedEmails: document.querySelector("#verified-emails"),
  highConfidenceCount: document.querySelector("#high-confidence-count"),
  needsReview: document.querySelector("#needs-review"),
  workflowDashboard: document.querySelector("#workflow-dashboard"),
  savedWorkqueueFilters: document.querySelector("#saved-workqueue-filters"),
  savedStatusFilter: document.querySelector("#saved-status-filter"),
  savedStageFilter: document.querySelector("#saved-stage-filter"),
  savedFollowupFilter: document.querySelector("#saved-followup-filter"),
  savedQuoteFilter: document.querySelector("#saved-quote-filter"),
  savedBusinessTypeFilter: document.querySelector("#saved-business-type-filter"),
  savedNameFilter: document.querySelector("#saved-name-filter"),
  resultsTitle: document.querySelector("#results-title"),
  todayFollowupCount: document.querySelector("#today-followup-count"),
  todayFollowups: document.querySelector("#today-followups"),
  guessedEmails: document.querySelector("#guessed-emails"),
  linkedInDecisionMakers: document.querySelector("#linkedin-decision-makers"),
  failedScans: document.querySelector("#failed-scans"),
  failedScansFilter: document.querySelector("#failed-scans-filter"),
  showHiddenFilter: document.querySelector("#show-hidden-filter"),
  detailContent: document.querySelector("#detail-content"),
  detailModal: document.querySelector("#detail-modal"),
  closeDetailButton: document.querySelector("#close-detail-button"),
  savedSearches: document.querySelector("#saved-searches"),
  savedSearchCount: document.querySelector("#saved-search-count"),
  industryNav: [...document.querySelectorAll("[data-industry-nav]")],
  presetButtons: [...document.querySelectorAll("[data-search-preset]")],
  pauseQueueButton: document.querySelector("#pause-queue-button"),
  resumeQueueButton: document.querySelector("#resume-queue-button"),
  cancelQueueButton: document.querySelector("#cancel-queue-button"),
  appViewButtons: [...document.querySelectorAll("[data-app-view]")],
};

await initialize();

async function initialize() {
  bindEvents();
  populateBusinessTypeGroups();
  populateSavedWorkqueueFilters();
  populateStates();
  await loadTargetCities();
  renderSavedSearches();
  await refreshCompanies();
  restoreQueueState();
  applyFilters();
}

function bindEvents() {
  elements.searchButton.addEventListener("click", handleSearch);

  elements.collectMoreButton?.addEventListener("click", handleCollectMore);
  elements.batchCollectButton?.addEventListener("click", handleBatchCollect);
  elements.addTestProspectButton.addEventListener("click", addTestProspect);
  elements.emptyAddTestProspectButton.addEventListener("click", addTestProspect);
  elements.saveSearchButton.addEventListener("click", handleSaveSearch);
  elements.filtersButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFiltersMenu();
  });
  elements.exportsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleExportsMenu();
  });

  elements.pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(elements.pageSizeSelect.value || 20);
    state.currentPage = 1;
    paginate();
    render();
  });

  elements.sortBySelect.addEventListener("change", () => {
    state.sortBy = elements.sortBySelect.value || "best_match";
    state.currentPage = 1;
    applyFilters();
  });

  elements.listViewButton?.addEventListener("click", () => setViewMode("list"));
  elements.gridViewButton?.addEventListener("click", () => setViewMode("grid"));
  elements.scanVisibleButton.addEventListener("click", handleScanAllVisible);
  elements.pauseQueueButton.addEventListener("click", pauseScanQueue);
  elements.resumeQueueButton.addEventListener("click", resumeScanQueue);
  elements.cancelQueueButton.addEventListener("click", cancelScanQueue);
  elements.exportVisibleButton.addEventListener("click", exportVisibleCompaniesCsv);
  elements.exportCompaniesButton.addEventListener("click", () => downloadFile("/api/exports/companies.csv"));
  elements.exportHighFitButton.addEventListener("click", () =>
    downloadFile("/api/exports/high-fit-companies.csv")
  );
  elements.exportContactsButton.addEventListener("click", () => downloadFile("/api/exports/contacts.csv"));
  elements.exportOutreachButton.addEventListener("click", () =>
    downloadFile("/api/exports/outreach-ready-contacts.csv")
  );
  elements.exportPhoneOnlyButton.addEventListener("click", () =>
    downloadFile("/api/exports/phone-only-leads.csv")
  );
  elements.exportNoEmailButton.addEventListener("click", () =>
    downloadFile("/api/exports/no-email-leads.csv")
  );
  elements.exportPrimaryButton.addEventListener("click", () =>
    downloadFile("/api/exports/primary-contacts.csv")
  );
  elements.exportVerifiedButton.addEventListener("click", () =>
    downloadFile("/api/exports/verified-decision-makers.csv")
  );
  elements.exportGuessedButton.addEventListener("click", () =>
    downloadFile("/api/exports/guessed-decision-makers.csv")
  );
  elements.exportLinkedInButton.addEventListener("click", () =>
    downloadFile("/api/exports/linkedin-decision-makers.csv")
  );
  elements.prevPageButton.addEventListener("click", () => changePage(-1));
  elements.nextPageButton.addEventListener("click", () => changePage(1));
  elements.closeDetailButton.addEventListener("click", closeDetails);
  elements.detailModal.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-detail")) {
      closeDetails();
    }
  });

  [
    elements.globalSearch,
    elements.stateFilter,
    elements.cityFilter,
    elements.websiteConditionFilter,
    elements.mobileAppConditionFilter,
    elements.sourceFilter,
    elements.leadScoreFilter,
  elements.reviewStatusFilter,
  elements.contactTypeFilter,
  elements.hasPrimaryFilter,
  elements.hasWebsiteFilter,
  elements.hasEmailFilter,
  elements.hasPhoneFilter,
  elements.highConfidenceFilter,
  elements.needsReviewFilter,
  elements.failedScansFilter,
  elements.showHiddenFilter,
  elements.verifiedOnlyFilter,
  elements.guessedEmailFilter,
  elements.linkedInFoundFilter,
  elements.savedStatusFilter,
  elements.savedStageFilter,
  elements.savedFollowupFilter,
  elements.savedQuoteFilter,
  elements.savedBusinessTypeFilter,
  elements.savedNameFilter,
  ].forEach((input) => {
    input?.addEventListener("change", () => {
      state.currentPage = 1;
      syncPresetChips();
      applyFilters();
    });
  });

  elements.savedNameFilter?.addEventListener("input", () => {
    state.currentPage = 1;
    applyFilters();
  });

  elements.industryFilter.addEventListener("change", () => {
    populateBusinessTypes(elements.industryFilter.value, getDefaultBusinessType(elements.industryFilter.value));
    state.currentPage = 1;
    syncPresetChips();
    applyFilters();
  });

  elements.globalSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  });

  elements.industryNav.forEach((button) => {
    button.addEventListener("click", () => {
      const nextIndustry = button.getAttribute("data-industry-nav") || "";
      setBusinessTypeSelection(nextIndustry || DEFAULT_INDUSTRY, getDefaultBusinessType(nextIndustry || DEFAULT_INDUSTRY));
      syncIndustryNav();
      state.currentPage = 1;
      applyFilters();
    });
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setBusinessTypeSelection(
        button.getAttribute("data-business-group") || DEFAULT_INDUSTRY,
        button.getAttribute("data-business-type") || DEFAULT_SEARCH_KEYWORD
      );
      state.currentPage = 1;
      applyFilters();
    });
  });

  document.addEventListener("click", (event) => {
    maybeCloseMenu({
      button: elements.filtersButton,
      menu: elements.filtersMenu,
      eventTarget: event.target,
      onClose: () => setFiltersMenuOpen(false),
    });
    maybeCloseMenu({
      button: elements.exportsButton,
      menu: elements.exportsMenu,
      eventTarget: event.target,
      onClose: () => setExportsMenuOpen(false),
    });
  });
}

async function refreshCompanies() {
  setLoading(true);

  try {
    const response = await fetch("/api/companies", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load companies (${response.status})`);
    }

    const payload = await response.json();
    const loadedCompanies = Array.isArray(payload.companies)
      ? payload.companies.map((company) => ({
          ...company,
          industry: inferCompanyIndustry(company),
          industry_tags: buildIndustryTags(company),
        }))
      : [];
    state.companies = mergeManualProspects(loadedCompanies, state.manualProspects);

    scanner.applySavedContacts(state.companies, flattenContacts(state.companies));
    state.companies = augmentCompaniesWithScannerData(state.companies);

    if (!state.selectedCompanyId && state.companies[0]) {
      state.selectedCompanyId = state.companies[0].id;
    }

    updateSummary();
  } catch (error) {
    state.companies = augmentCompaniesWithScannerData(mergeManualProspects([], state.manualProspects));
    updateSummary();
    elements.statusMessage.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function handleSearch() {
  const filters = getActiveFilters();
  state.currentPage = 1;

  if (!filters.cityLabel || !filters.state) {
    applyFilters();
    elements.statusMessage.textContent =
      "Showing saved prospects. Enter a location and business type to collect new prospects.";
    return;
  }

  elements.statusMessage.textContent = `Searching ${filters.cityLabel}, ${filters.state} for ${filters.keywordLabel || DEFAULT_SEARCH_KEYWORD}...`;
  elements.searchButton.disabled = true;
  if (elements.collectMoreButton) {
    elements.collectMoreButton.disabled = true;
  }

  try {
    const payload = await searchLiveProspects({
      businessType: filters.keywordLabel || DEFAULT_SEARCH_KEYWORD,
      location: filters.cityLabel,
      state: filters.state,
      websiteCondition: filters.websiteCondition,
    });

    state.companies = augmentCompaniesWithScannerData(
      mergeManualProspects(
        payload.prospects.map((prospect) => mapLiveProspectToCompany(prospect)),
        state.manualProspects
      )
    );
    applyFilters();
    elements.statusMessage.textContent =
      state.filteredCompanies.length > 0
        ? `Search complete. Found ${state.filteredCompanies.length} live prospect${state.filteredCompanies.length === 1 ? "" : "s"}.`
        : "No live prospects matched. You can still add a manual prospect.";
  } catch (error) {
    elements.statusMessage.textContent = formatFriendlyError(error);
  } finally {
    elements.searchButton.disabled = false;
    if (elements.collectMoreButton) {
      elements.collectMoreButton.disabled = false;
    }
  }
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

function getProspectDedupeKeys(company) {
  if (!company) {
    return [];
  }

  const placeId = normalizeText(company.placeId || company.place_id || company.id || "");
  const name = normalizeText(company.name || company.businessName || "");
  const address = normalizeText(company.address || "");
  const phone = normalizePhone(company.phone || "");
  const city = normalizeText(company.city || "");
  const state = normalizeText(company.state || "");
  const keys = [];

  if (placeId) {
    keys.push(`place:${placeId}`);
    keys.push(placeId);
  }

  if (name && address) {
    keys.push(`name-address:${name}|${address}`);
    keys.push(`${name}|${address}`);
  }

  if (name && phone) {
    keys.push(`name-phone:${name}|${phone}`);
    keys.push(`${name}|${phone}`);
  }

  if (name && city && state) {
    keys.push(`name-city-state:${name}|${city}|${state}`);
    keys.push(`${name}|${city}|${state}`);
  }

  if (company.id) {
    keys.push(`id:${normalizeText(company.id)}`);
    keys.push(normalizeText(company.id));
  }

  return [...new Set(keys)];
}

function getProspectDedupeKey(company) {
  return getProspectDedupeKeys(company)[0] || "";
}

function isDuplicateProspect(candidate, prospect) {
  if (!candidate || !prospect) {
    return false;
  }

  const candidateKeys = getProspectDedupeKeys(candidate);
  const prospectKeys = getProspectDedupeKeys(prospect);
  return candidateKeys.some((key) => prospectKeys.includes(key));
}

function getProspectCompletenessScore(company) {
  if (!company) {
    return 0;
  }

  let score = 0;
  if (String(company.placeId || company.place_id || "").trim()) {
    score += 25;
  }
  if (String(company.phone || "").trim()) {
    score += 15;
  }
  if (String(company.websiteStatus || "").trim()) {
    score += 10;
  }
  if (String(company.websiteQualityStatus || "").trim() && company.websiteQualityStatus !== "Not Checked") {
    score += 6;
  }
  if (Number(company.rating || 0) > 0) {
    score += 8;
  }
  if (Number(company.reviewCount || company.reviews || 0) > 0) {
    score += 8;
  }
  if (String(company.address || "").trim()) {
    score += 10;
  }
  if (String(company.googleProfileUrl || company.mapsUrl || company.source_url || "").trim()) {
    score += 4;
  }
  if (String(company.id || "").trim()) {
    score += 4;
  }

  return score;
}

function mergeProspectData(existing, incoming) {
  if (!existing) {
    return { ...incoming };
  }

  if (!incoming) {
    return { ...existing };
  }

  const preferred = getProspectCompletenessScore(incoming) > getProspectCompletenessScore(existing) ? incoming : existing;
  const preserveExistingFields = [
    "communication_logs",
    "notes",
    "milestones",
    "currentStage",
    "prospect_stage",
    "quote_status",
    "next_follow_up",
    "next_action",
    "last_contacted_at",
    "follow_up_priority",
    "manual_priority",
    "archived",
    "archived_at",
    "is_hidden",
    "activity_log",
  ];
  const merged = {
    ...existing,
    ...incoming,
    ...preferred,
  };

  preserveExistingFields.forEach((field) => {
    if (existing[field] !== undefined) {
      merged[field] = existing[field];
    }
  });

  if (Array.isArray(existing.reasonChips) || Array.isArray(incoming.reasonChips)) {
    merged.reasonChips = normalizeReasonChips([...(existing.reasonChips || []), ...(incoming.reasonChips || [])]);
  }

  if (Array.isArray(existing.scoreReasons) || Array.isArray(incoming.scoreReasons)) {
    merged.scoreReasons = normalizeReasonChips([...(existing.scoreReasons || []), ...(incoming.scoreReasons || [])]);
  }

  if (Array.isArray(existing.contacts) || Array.isArray(incoming.contacts)) {
    merged.contacts = Array.isArray(preferred.contacts)
      ? preferred.contacts
      : Array.isArray(existing.contacts)
        ? existing.contacts
        : incoming.contacts || [];
  }

  merged.id =
    existing.archived || existing.is_saved_prospect || isSavedProspectRecord(existing)
      ? existing.id || incoming.id
      : incoming.id || existing.id;

  return merged;
}

function isSavedProspectRecord(company) {
  if (!company) {
    return false;
  }

  if (Boolean(company.is_saved_prospect) || Boolean(company.archived)) {
    return true;
  }

  return Boolean(findSavedProspectId(company));
}

function isProspectHidden(company) {
  if (!company) {
    return false;
  }

  if (Boolean(company.archived)) {
    return true;
  }

  const keys = getProspectDedupeKeys(company);
  const normalizedHidden = new Set(state.hiddenProspects.map((entry) => normalizeText(entry)));
  return keys.some((key) => normalizedHidden.has(normalizeText(key)));
}

function dedupeProspectList(companies) {
  const deduped = [];

  (Array.isArray(companies) ? companies : []).forEach((company) => {
    if (!company) {
      return;
    }

    const match = deduped.find((candidate) => isDuplicateProspect(candidate, company));
    if (!match) {
      deduped.push({ ...company });
      return;
    }

    const merged = mergeProspectData(match, company);
    const index = deduped.findIndex((candidate) => candidate === match);
    if (index >= 0) {
      deduped[index] = merged;
    }
  });

  return deduped;
}

function applyFilters() {
  const filters = getActiveFilters();
  syncIndustryNav();

  state.filteredCompanies = state.companies
    .filter((company) => {
      if (state.activeView === "discovery" && isProspectHidden(company) && !filters.showHidden) {
        return false;
      }

      if (state.activeView === "saved" && !findSavedProspectId(company)) {
        return false;
      }

      if (state.activeView === "saved" && filters.savedStatus === "active" && company.archived) {
        return false;
      }

      if (state.activeView === "saved" && filters.savedStatus === "archived" && !company.archived) {
        return false;
      }

      if (state.activeView === "saved" && filters.savedStage && company.prospect_stage !== filters.savedStage) {
        return false;
      }

      if (
        state.activeView === "saved" &&
        filters.savedFollowUp &&
        !matchesSavedFollowUpFilter(company.next_follow_up, filters.savedFollowUp)
      ) {
        return false;
      }

      if (
        state.activeView === "saved" &&
        filters.savedQuoteStatus &&
        (company.quote_status || "Not Started") !== filters.savedQuoteStatus
      ) {
        return false;
      }

      if (
        state.activeView === "saved" &&
        filters.savedBusinessType &&
        ![company.keyword, company.industry].includes(filters.savedBusinessType)
      ) {
        return false;
      }

      if (state.activeView === "saved" && filters.savedName) {
        const savedNameHaystack = [company.name, company.phone, company.city, company.state, company.keyword, company.industry]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!savedNameHaystack.includes(filters.savedName)) {
          return false;
        }
      }

      if (state.activeView === "discovery" && filters.state && company.state !== filters.state) {
        return false;
      }

      if (
        state.activeView === "discovery" &&
        filters.city &&
        !String(company.city || "").toLowerCase().includes(filters.city)
      ) {
        return false;
      }

      if (state.activeView === "discovery" && filters.industry && company.industry !== filters.industry) {
        return false;
      }

      if (state.activeView === "discovery" && !matchesWebsiteCondition(company, filters.websiteCondition)) {
        return false;
      }

      if (
        state.activeView === "discovery" &&
        !matchesMobileAppCondition(company, filters.mobileAppCondition)
      ) {
        return false;
      }

      if (state.activeView === "discovery" && filters.keyword) {
        const haystack = [
          company.name,
          company.keyword,
          company.city,
          company.state,
          company.website,
          company.industry,
          ...(company.industry_tags || []),
          company.primary_contact?.name,
          company.primary_contact?.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(filters.keyword)) {
          return false;
        }
      }

      if (filters.source && company.source !== filters.source) {
        return false;
      }

      if (filters.leadScore && (company.opportunityPriority || company.lead_label) !== filters.leadScore) {
        return false;
      }

      if (filters.reviewStatus && company.review_status !== filters.reviewStatus) {
        return false;
      }

      if (
        filters.contactType &&
        !company.contacts.some((contact) => contact.contact_type === filters.contactType)
      ) {
        return false;
      }

      if (filters.hasPrimary && !company.has_primary_contact) {
        return false;
      }

      if (filters.hasWebsite && !company.hasWebsite) {
        return false;
      }

      if (filters.hasEmail && !company.has_email) {
        return false;
      }

      if (filters.hasPhone && !company.has_phone) {
        return false;
      }

      if (
        filters.highConfidence &&
        !company.contacts.some((contact) => Number(contact.confidence_score || 0) >= 85)
      ) {
        return false;
      }

      if (filters.needsReview && !company.needs_review) {
        return false;
      }

      if (filters.failedScans && company.scan_status !== SCAN_STATUS.FAILED) {
        return false;
      }

      if (
        filters.verifiedOnly &&
        !company.contacts.some((contact) => contact.email_status === "verified")
      ) {
        return false;
      }

      if (
        filters.guessedEmails &&
        !company.contacts.some((contact) => contact.email_status === "guessed")
      ) {
        return false;
      }

      if (
        filters.linkedInFound &&
        !company.contacts.some((contact) => Boolean(contact.linkedin_url))
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => compareCompanies(left, right, state.sortBy, state.activeView));

  if (!state.filteredCompanies.some((company) => company.id === state.selectedCompanyId)) {
    state.selectedCompanyId = state.filteredCompanies[0]?.id || null;
  }

  state.currentPage = Math.min(state.currentPage, getTotalPages()) || 1;
  paginate();
  render();
}

function paginate() {
  const start = (state.currentPage - 1) * state.pageSize;
  state.pagedCompanies = state.filteredCompanies.slice(start, start + state.pageSize);
}

function render() {
  const isSavedView = state.activeView === "saved";
  elements.resultCount.textContent = String(state.filteredCompanies.length);
  elements.resultsSubtitle.textContent = buildResultsSubtitle();
  elements.resultsTitle.textContent = isSavedView ? "Saved Prospects Work Queue" : "Discovery Results";
  elements.workflowDashboard.classList.toggle("hidden", !isSavedView);
  elements.savedWorkqueueFilters?.classList.toggle("hidden", !isSavedView);
  elements.emptyState.classList.toggle("hidden", state.filteredCompanies.length > 0 || state.loading);
  elements.resultsContainer.classList.toggle("hidden", state.filteredCompanies.length === 0);
  elements.loadingState.classList.toggle("hidden", !state.loading);
  elements.pageIndicator.textContent = `Page ${state.currentPage} of ${getTotalPages()}`;
  elements.prevPageButton.disabled = state.currentPage <= 1;
  elements.nextPageButton.disabled = state.currentPage >= getTotalPages();
  elements.listViewButton?.classList.toggle("active", state.viewMode === "list");
  elements.gridViewButton?.classList.toggle("active", state.viewMode === "grid");
  elements.scanVisibleButton.disabled =
    state.bulkScan.running || !state.pagedCompanies.some((company) => company.website);
  elements.pauseQueueButton.disabled = !state.bulkScan.running || state.bulkScan.paused;
  elements.resumeQueueButton.disabled =
    state.bulkScan.running || !state.bulkScan.paused || !state.bulkScan.queue.length;
  elements.cancelQueueButton.disabled =
    (!state.bulkScan.running && !state.bulkScan.paused) || !state.bulkScan.queue.length;

  renderResultsView({
    companies: state.pagedCompanies,
    container: elements.resultsContainer,
    viewMode: state.viewMode,
    scanner,
    selectedCompanyId: state.selectedCompanyId,
    savedCompanies: state.savedCompanies,
    onOpenDetails: openDetails,
    onScanCompany: handleScanCompany,
    onRetryScan: handleRetryScan,
    onToggleSavedCompany: toggleSavedCompany,
    onHideCompany: hideCompany,
    mode: state.activeView,
  });

  elements.appViewButtons.forEach((button) => {
    button.classList.toggle("active", (button.getAttribute("data-app-view") || "discovery") === state.activeView);
  });

  renderDetail();
  renderTodayFollowups();
  renderBatchProgress();
  renderBulkProgress();
}

function toggleFiltersMenu() {
  const isOpen = !elements.filtersMenu.classList.contains("hidden");
  setFiltersMenuOpen(!isOpen);
  if (!isOpen) {
    setExportsMenuOpen(false);
  }
}

function setFiltersMenuOpen(isOpen) {
  elements.filtersMenu.classList.toggle("hidden", !isOpen);
  elements.filtersButton.setAttribute("aria-expanded", String(isOpen));
}

function toggleExportsMenu() {
  const isOpen = !elements.exportsMenu.classList.contains("hidden");
  setExportsMenuOpen(!isOpen);
  if (!isOpen) {
    setFiltersMenuOpen(false);
  }
}

function setExportsMenuOpen(isOpen) {
  elements.exportsMenu.classList.toggle("hidden", !isOpen);
  elements.exportsButton.setAttribute("aria-expanded", String(isOpen));
}

async function handleCollectMore() {
  const filters = getActiveFilters();

  if (!filters.state || !filters.cityLabel) {
    elements.statusMessage.textContent = "Choose both state and city before collecting more prospects.";
    return;
  }

  elements.statusMessage.textContent = `Collecting more prospects for ${filters.cityLabel}, ${filters.state}...`;
  if (elements.collectMoreButton) {
    elements.collectMoreButton.disabled = true;
  }

  try {
    const payload = await collectCompaniesForLocation({
      keyword: buildSearchKeyword(filters),
      city: filters.cityLabel,
      state: filters.state,
      source: mapCollectorSource(filters.source),
    });

    await refreshCompanies();
    applyFilters();
    elements.statusMessage.textContent = `Collected more prospects. Total saved: ${payload.stats?.totalCompanies || state.companies.length}.`;
  } catch (error) {
    elements.statusMessage.textContent = error.message;
  } finally {
    if (elements.collectMoreButton) {
      elements.collectMoreButton.disabled = false;
    }
  }
}

async function handleBatchCollect() {
  const filters = getActiveFilters();

  if (!filters.state) {
    elements.statusMessage.textContent = "Choose a state before batch collecting.";
    return;
  }

  const targetCities = getTargetCitiesForState(filters.state);
  if (!targetCities.length) {
    elements.statusMessage.textContent = `No target cities configured for ${filters.state}.`;
    return;
  }

  state.batchCollect = {
    running: true,
    currentCity: "",
    completedCities: 0,
    totalCities: targetCities.length,
    companiesAdded: 0,
    duplicatesRemoved: 0,
  };
  renderBatchProgress();
  if (elements.batchCollectButton) {
    elements.batchCollectButton.disabled = true;
  }
  if (elements.collectMoreButton) {
    elements.collectMoreButton.disabled = true;
  }

  try {
    let previousTotalCompanies = state.companies.length;

    for (const targetCity of targetCities) {
      state.batchCollect.currentCity = `${targetCity.city}, ${targetCity.state}`;
      renderBatchProgress();

      const payload = await collectCompaniesForLocation({
        keyword: buildSearchKeyword(filters),
        city: targetCity.city,
        state: targetCity.state,
        source: mapCollectorSource(filters.source),
      });

      state.batchCollect.completedCities += 1;
      const totalCompanies = Number(payload.stats?.totalCompanies || previousTotalCompanies);
      const addedCompanies = Number(payload.stats?.addedCompanies || Math.max(0, totalCompanies - previousTotalCompanies));
      state.batchCollect.companiesAdded += addedCompanies;
      state.batchCollect.duplicatesRemoved += Number(payload.stats?.duplicatesRemoved || 0);
      previousTotalCompanies = totalCompanies;
      renderBatchProgress();
    }

    await refreshCompanies();
    applyFilters();
    elements.statusMessage.textContent = `Batch collection finished for ${filters.state}.`;
  } catch (error) {
    elements.statusMessage.textContent = error.message;
  } finally {
    state.batchCollect.running = false;
    state.batchCollect.currentCity = "";
    if (elements.batchCollectButton) {
      elements.batchCollectButton.disabled = false;
    }
    if (elements.collectMoreButton) {
      elements.collectMoreButton.disabled = false;
    }
    renderBatchProgress();
  }
}

function handleSaveSearch() {
  const filters = getActiveFilters();
  const label = `${filters.keywordLabel || "Any business"} - ${filters.cityLabel || "All cities"}${filters.state ? `, ${filters.state}` : ""}`;
  const entry = {
    id: `search-${Date.now()}`,
    label,
    filters: {
      globalSearch: filters.keywordLabel || "",
      industry: filters.industry || "",
      city: filters.cityLabel || "",
      state: filters.state || "",
      source: filters.source || "",
      websiteCondition: filters.websiteCondition || "",
      mobileAppCondition: filters.mobileAppCondition || "",
    },
  };

  state.savedSearches = [entry, ...state.savedSearches].slice(0, 8);
  persistSavedSearches();
  renderSavedSearches();
  elements.statusMessage.textContent = `Saved search for ${label}.`;
}

function addTestProspect() {
  setBusinessTypeSelection(DEFAULT_INDUSTRY, DEFAULT_SEARCH_KEYWORD);
  elements.cityFilter.value = "Farmers Branch";
  elements.stateFilter.value = DEFAULT_STATE;
  elements.websiteConditionFilter.value = "no_website";
  elements.mobileAppConditionFilter.value = "";
  const filters = getActiveFilters();
  const prospect = buildTestProspect(filters);
  const existing = [...state.companies, ...state.manualProspects].find((item) => isDuplicateProspect(item, prospect));

  if (!existing) {
    state.manualProspects = [prospect, ...state.manualProspects].slice(0, 100);
    persistManualProspects();
    state.companies = augmentCompaniesWithScannerData(
      mergeManualProspects(state.companies, state.manualProspects)
    );
  }

  const targetProspect = existing || prospect;
  state.selectedCompanyId = targetProspect.id;
  ensureProspectWorkflow(targetProspect.id, targetProspect);
  elements.statusMessage.textContent = existing
    ? "Test prospect already exists."
    : "Test prospect added. Open it to test save, status, notes, and follow-ups.";
  state.currentPage = 1;
  applyFilters();
}

async function handleScanCompany(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  state.activeDetailTab = "contacts";
  openDetails(companyId);
  elements.statusMessage.textContent = `Deep scanning ${company.name}...`;
  render();

  const result = await scanner.scanCompany(company);
  await refreshCompanies();
  applyFilters();

  elements.statusMessage.textContent = result.message || `Finished deep scan for ${company.name}.`;
}

async function handleScanAllVisible() {
  if (state.bulkScan.running || state.bulkScan.paused) {
    return;
  }

  const queue = state.pagedCompanies.filter((company) => company.website).map((company) => company.id);
  if (!queue.length) {
    elements.statusMessage.textContent = "No visible prospects with websites to scan.";
    return;
  }

  state.bulkScan = {
    running: true,
    paused: false,
    canceled: false,
    currentCompany: "",
    completed: 0,
    failed: 0,
    total: queue.length,
    queue,
    currentIndex: 0,
  };
  persistScanQueueState();

  queue.forEach((companyId) => {
    scanner.markQueued(companyId, "Queued in scan queue...");
  });

  elements.statusMessage.textContent = `Queued ${queue.length} visible prospects for scanning.`;
  render();
  await runScanQueue();
}

async function handleRetryScan(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  scanner.setState(company.id, {
    status: SCAN_STATUS.QUEUED,
    message: "Retry queued...",
    failureReason: "",
  });

  elements.statusMessage.textContent = `Retrying deep scan for ${company.name}...`;
  render();
  await handleScanCompany(companyId);
}

async function runScanQueue() {
  while (state.bulkScan.currentIndex < state.bulkScan.queue.length) {
    if (state.bulkScan.canceled) {
      state.bulkScan.running = false;
      state.bulkScan.paused = false;
      state.bulkScan.currentCompany = "";
      persistScanQueueState();
      renderBulkProgress();
      return;
    }

    if (state.bulkScan.paused) {
      state.bulkScan.running = false;
      persistScanQueueState();
      renderBulkProgress();
      return;
    }

    const companyId = state.bulkScan.queue[state.bulkScan.currentIndex];
    const company = state.companies.find((item) => item.id === companyId);
    if (!company) {
      state.bulkScan.currentIndex += 1;
      state.bulkScan.failed += 1;
      persistScanQueueState();
      continue;
    }

    state.bulkScan.running = true;
    state.bulkScan.currentCompany = company.name;
    persistScanQueueState();
    renderBulkProgress();
    render();

    const result = await scanner.scanCompany(company);
    state.bulkScan.completed += 1;
    state.bulkScan.currentIndex += 1;

    if (
      !result.contacts.length ||
      result.status === SCAN_STATUS.NEEDS_REVIEW ||
      result.status === SCAN_STATUS.FAILED
    ) {
      state.bulkScan.failed += 1;
    }

    await refreshCompanies();
    applyFilters();
    persistScanQueueState();
  }

  state.bulkScan.running = false;
  state.bulkScan.paused = false;
  state.bulkScan.currentCompany = "";
  state.bulkScan.queue = [];
  state.bulkScan.currentIndex = 0;
  persistScanQueueState();
  elements.statusMessage.textContent = "Scan queue finished.";
  renderBulkProgress();
}

function pauseScanQueue() {
  if (!state.bulkScan.running) {
    return;
  }

  state.bulkScan.paused = true;
  state.bulkScan.running = false;
  persistScanQueueState();
  render();
}

function resumeScanQueue() {
  if (!state.bulkScan.queue.length) {
    return;
  }

  state.bulkScan.paused = false;
  state.bulkScan.canceled = false;
  state.bulkScan.running = true;
  persistScanQueueState();
  render();
  runScanQueue();
}

function cancelScanQueue() {
  if (!state.bulkScan.queue.length) {
    return;
  }

  state.bulkScan.canceled = true;
  state.bulkScan.running = false;
  state.bulkScan.paused = false;
  state.bulkScan.currentCompany = "";
  state.bulkScan.queue = [];
  state.bulkScan.currentIndex = 0;
  state.bulkScan.total = 0;
  persistScanQueueState();
  render();
  elements.statusMessage.textContent = "Scan queue canceled.";
}

async function handleReviewUpdate(payload, reviewStatus) {
  const response = await fetch("/api/contacts/review-status", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      company_website: payload.companyWebsite,
      email: payload.email,
      phone: payload.phone,
      review_status: reviewStatus,
    }),
  });

  if (!response.ok) {
    elements.statusMessage.textContent = "Unable to update review status.";
    return;
  }

  await refreshCompanies();
  applyFilters();
  state.activeDetailTab = "contacts";
  elements.statusMessage.textContent =
    reviewStatus === "approved" ? "Contact approved." : "Contact marked bad.";
}

function openDetails(companyId) {
  state.selectedCompanyId = companyId;
  elements.detailModal.classList.remove("hidden");
  elements.detailModal.setAttribute("aria-hidden", "false");
  renderDetail();
  render();
}

function closeDetails() {
  elements.detailModal.classList.add("hidden");
  elements.detailModal.setAttribute("aria-hidden", "true");
}

function renderDetail() {
  const company = state.companies.find((item) => item.id === state.selectedCompanyId) || null;

  renderDetailPanel({
    company,
    activeTab: state.activeDetailTab,
    savedCompanies: state.savedCompanies,
    container: elements.detailContent,
    onChangeTab: handleDetailTabChange,
    onScanCompany: handleScanCompany,
    onRetryScan: handleRetryScan,
    onToggleSavedCompany: toggleSavedCompany,
    onUpdateProspectStatus: updateProspectStatus,
    onAddCommunicationEntry: addCommunicationEntry,
    onAddProspectNote: addProspectNote,
    onSetNextFollowUp: setNextFollowUp,
    onToggleMilestone: toggleMilestone,
    onCheckWebsiteQuality: checkWebsiteQuality,
    onCopyOutreachTemplate: copyOutreachTemplate,
    onMarkOutreachMilestone: markOutreachMilestone,
    senderProfile: state.senderProfile,
    outreachDrafts: state.outreachTemplateDrafts,
    onSaveSenderProfile: saveSenderProfile,
    onSetOutreachTone: setOutreachTone,
    onEditOutreachTemplate: editOutreachTemplate,
    onUpdateOutreachTemplateDraft: updateOutreachTemplateDraft,
    onSaveOutreachTemplate: saveOutreachTemplate,
    onResetOutreachTemplate: resetOutreachTemplate,
    onSaveQuoteDetails: saveQuoteDetails,
    onCopyQuoteSummary: copyQuoteSummary,
    onMarkQuoteSent: markQuoteSent,
    onMarkQuoteAccepted: markQuoteAccepted,
    onMarkQuoteRejected: markQuoteRejected,
    onApproveContact: (payload) => handleReviewUpdate(payload, "approved"),
    onMarkBadContact: (payload) => handleReviewUpdate(payload, "bad"),
    onCopyContactEmail: (payload) => copyToClipboard(payload.email, "Email copied."),
    onCopyContactPhone: (payload) => copyToClipboard(payload.phone, "Phone copied."),
  });
}

function handleDetailTabChange(tab) {
  state.activeDetailTab = tab;
  renderDetail();
}

function toggleSavedCompany(companyId) {
  if (!companyId) {
    return;
  }

  const company = state.companies.find((item) => item.id === companyId);
  const existingSavedId = company ? findSavedProspectId(company) : companyId;

  if (existingSavedId) {
    state.savedCompanies = state.savedCompanies.filter((id) => id !== existingSavedId);
    if (existingSavedId !== companyId) {
      state.savedCompanies = state.savedCompanies.filter((id) => id !== companyId);
    }
    elements.statusMessage.textContent = "Prospect removed from saved.";
  } else {
    state.savedCompanies = [...state.savedCompanies, companyId];
    ensureProspectWorkflow(companyId, company);
    recordProspectActivity(companyId, "Saved to prospects", "User", "save");
    elements.statusMessage.textContent = "Prospect saved.";
  }

  persistSavedCompanies();
  if (company) {
    applyProspectWorkflow(company);
  }
  updateSummary();
  applyFilters();
}

function hideCompany(companyId) {
  if (!companyId) {
    return;
  }

  const company = state.companies.find((item) => item.id === companyId);
  const savedId = company ? findSavedProspectId(company) : "";
  const workflow = company ? getProspectWorkflow(company.id) : {};
  const hiddenKeys = getProspectDedupeKeys(company || { id: companyId });
  const hiddenKey = hiddenKeys[0] || normalizeText(companyId);
  const normalizedHiddenKeys = new Set(hiddenKeys.map((key) => normalizeText(key)));

  if (savedId || company?.is_saved_prospect) {
    const isArchived = Boolean(company?.archived || workflow.archived);
    state.prospectWorkflows[company.id] = {
      ...workflow,
      archived: !isArchived,
      archived_at: !isArchived ? new Date().toISOString() : "",
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    recordProspectActivity(
      company.id,
      !isArchived ? "Archived" : "Restored from archive",
      "User",
      !isArchived ? "archive" : "unarchive"
    );
    persistProspectWorkflows();
    if (!isArchived) {
      state.hiddenProspects = [...new Set([...state.hiddenProspects, hiddenKey, `id:${normalizeText(company.id)}`])];
      persistHiddenProspects();
      elements.statusMessage.textContent = "Prospect archived.";
    } else {
      state.hiddenProspects = state.hiddenProspects.filter(
        (entry) => !normalizedHiddenKeys.has(normalizeText(entry)) && normalizeText(entry) !== normalizeText(company.id)
      );
      persistHiddenProspects();
      elements.statusMessage.textContent = "Prospect restored from archive.";
    }
    applyProspectWorkflow(company);
    updateSummary();
    applyFilters();
    return;
  }

  const isHidden = isProspectHidden(company || { id: companyId });
  if (isHidden) {
    state.hiddenProspects = state.hiddenProspects.filter(
      (entry) => !normalizedHiddenKeys.has(normalizeText(entry)) && normalizeText(entry) !== normalizeText(companyId)
    );
    persistHiddenProspects();
    elements.statusMessage.textContent = "Prospect restored.";
    if (company) {
      recordProspectActivity(company.id, "Restored from search", "User", "restore");
    }
  } else {
    state.hiddenProspects = [...new Set([...state.hiddenProspects, ...hiddenKeys, `id:${normalizeText(companyId)}`])];
    persistHiddenProspects();
    elements.statusMessage.textContent = "Prospect hidden from the current workspace.";
    if (company) {
      recordProspectActivity(company.id, "Hidden from search", "User", "hide");
    }
  }
  applyFilters();
}

async function copyOutreachTemplate(companyId, templateKey, templateLabel, templateText) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!templateText) {
    return;
  }

  await copyToClipboard(templateText, `${templateLabel} copied.`);

  if (company && findSavedProspectId(company)) {
    recordProspectActivity(company.id, `Copied ${templateLabel}`, "User", `copy-${normalizeText(templateKey)}`);
  } else if (company) {
    elements.statusMessage.textContent = `${templateLabel} copied. Save the prospect to keep outreach activity.`;
  }
}

function editOutreachTemplate(companyId, templateKey) {
  if (!companyId || !templateKey) {
    return;
  }

  state.outreachTemplateDrafts[companyId] = {
    ...(state.outreachTemplateDrafts[companyId] || {}),
    [templateKey]: {
      ...(state.outreachTemplateDrafts[companyId]?.[templateKey] || {}),
      editing: true,
    },
  };
  renderDetail();
}

function updateOutreachTemplateDraft(companyId, templateKey, templateText) {
  if (!companyId || !templateKey) {
    return;
  }

  state.outreachTemplateDrafts[companyId] = {
    ...(state.outreachTemplateDrafts[companyId] || {}),
    [templateKey]: {
      ...(state.outreachTemplateDrafts[companyId]?.[templateKey] || {}),
      text: String(templateText || ""),
      editing: true,
    },
  };
}

function saveOutreachTemplate(companyId, templateKey, templateText) {
  const company = state.companies.find((item) => item.id === companyId);
  const text = String(templateText || "").trim();
  if (!company || !templateKey || !text) {
    return;
  }

  const label = templateLabelFromKey(templateKey);
  const savedId = findSavedProspectId(company);
  if (savedId) {
    ensureSavedProspect(company);
    const workflow = getProspectWorkflow(company.id);
    state.prospectWorkflows[company.id] = {
      ...workflow,
      outreach_templates: {
        ...(workflow.outreach_templates || {}),
        [templateKey]: text,
      },
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistProspectWorkflows();
    applyProspectWorkflow(company);
  } else {
    state.outreachTemplateDrafts[companyId] = {
      ...(state.outreachTemplateDrafts[companyId] || {}),
      [templateKey]: {
        ...(state.outreachTemplateDrafts[companyId]?.[templateKey] || {}),
        text,
        editing: false,
      },
    };
  }

  if (state.outreachTemplateDrafts[companyId]?.[templateKey]) {
    state.outreachTemplateDrafts[companyId][templateKey] = {
      ...state.outreachTemplateDrafts[companyId][templateKey],
      text,
      editing: false,
    };
  }

  if (savedId) {
    recordProspectActivity(company.id, `Edited ${label}`, "Manual", `template-edit-${normalizeText(templateKey)}`);
  }
  elements.statusMessage.textContent = `${label} saved.${savedId ? "" : " Save the prospect to keep edits."}`;
  renderDetail();
}

function resetOutreachTemplate(companyId, templateKey) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !templateKey) {
    return;
  }

  const label = templateLabelFromKey(templateKey);
  if (findSavedProspectId(company)) {
    ensureSavedProspect(company);
    const workflow = getProspectWorkflow(company.id);
    const outreachTemplates = { ...(workflow.outreach_templates || {}) };
    delete outreachTemplates[templateKey];
    state.prospectWorkflows[company.id] = {
      ...workflow,
      outreach_templates: outreachTemplates,
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistProspectWorkflows();
    applyProspectWorkflow(company);
  }

  if (state.outreachTemplateDrafts[companyId]) {
    delete state.outreachTemplateDrafts[companyId][templateKey];
  }

  if (findSavedProspectId(company)) {
    recordProspectActivity(company.id, `Reset ${label} to default`, "Manual", `template-reset-${normalizeText(templateKey)}`);
  }
  elements.statusMessage.textContent = `${label} reset to default.`;
  renderDetail();
}

function setOutreachTone(companyId, tone) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  const nextTone = String(tone || "Professional").trim() || "Professional";
  if (findSavedProspectId(company)) {
    ensureSavedProspect(company);
    const workflow = getProspectWorkflow(company.id);
    state.prospectWorkflows[company.id] = {
      ...workflow,
      outreach_tone: nextTone,
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistProspectWorkflows();
    applyProspectWorkflow(company);
  } else {
    state.outreachTemplateDrafts[company.id] = {
      ...(state.outreachTemplateDrafts[company.id] || {}),
      tone: nextTone,
    };
  }

  renderDetail();
}

function saveSenderProfile(profile) {
  state.senderProfile = {
    yourName: String(profile?.yourName || "").trim(),
    companyName: String(profile?.companyName || "").trim(),
    phone: String(profile?.phone || "").trim(),
    email: String(profile?.email || "").trim(),
    website: String(profile?.website || "").trim(),
    pitch: String(profile?.pitch || "").trim(),
  };
  persistSenderProfile();
  elements.statusMessage.textContent = "Sender profile saved.";
  renderDetail();
}

function markOutreachMilestone(companyId, milestone, message) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !milestone) {
    return;
  }

  addActivityEntry(company.id, {
    activityType: milestoneToActivityType(milestone),
    method: milestoneToMethod(milestone),
    date: getTodayDateKey(),
    outcome: message || "",
    notes: message || "",
    nextAction: getSuggestedNextAction(company),
    nextFollowUp: getSuggestedFollowUpDate(milestoneToActivityType(milestone), getTodayDateKey(), message || ""),
    source: "Manual",
    action: `mark-${normalizeText(milestone)}`,
    message: message || `Marked ${milestone}`,
  });
}

function updateProspectStatus(companyId, nextStatus) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !nextStatus) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const now = new Date().toISOString();
  state.prospectWorkflows[companyId] = {
    ...workflow,
    currentStage: nextStatus,
    prospect_stage: nextStatus,
    manual_stage_override: true,
    stageUpdateSource: "manual",
    stageUpdatedAt: now,
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  recordProspectActivity(company.id, `Status changed to ${nextStatus}`, "Manual", "status-change");
  elements.statusMessage.textContent = `Updated ${company.name || "prospect"} status to ${nextStatus}.`;
  updateSummary();
  applyFilters();
}

function addCommunicationEntry(payload) {
  const company = state.companies.find((item) => item.id === payload.companyId);
  const notes = String(payload.notes || "").trim();
  const outcome = String(payload.outcome || "").trim();
  const nextAction = String(payload.nextAction || "").trim();
  const method = String(payload.method || "Other").trim();
  const activityType = normalizeActivityType(
    payload.activityType || payload.type || mapMethodToActivityType(method) || "Status Changed"
  );
  const hasMeaningfulInput = Boolean(
    notes || outcome || nextAction || String(payload.activityType || payload.type || "").trim()
  );
  if (!company || !hasMeaningfulInput) {
    elements.statusMessage.textContent = "Enter communication details before saving.";
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(company.id);
  const communicationLogs = Array.isArray(workflow.communication_logs)
    ? workflow.communication_logs
    : [];
  const date = payload.date || getTodayDateKey();
  const nextFollowUp = String(payload.nextFollowUp || getSuggestedFollowUpDate(activityType, date, outcome) || "").trim();
  const now = new Date().toISOString();
  const activityEntry = {
    id: `activity-${Date.now()}`,
    created_at: now,
    date,
    activity_type: activityType,
    method,
    outcome,
    notes,
    next_action: nextAction,
    next_follow_up: nextFollowUp,
    source: "Manual",
    action: `activity-${normalizeText(activityType)}`,
    message: `${activityType}${outcome ? ` - ${outcome}` : ""}`.trim(),
  };
  const activity_log = appendWorkflowActivity(workflow.activity_log, activityEntry);
  const milestone = mapActivityToMilestone(activityType);

  state.prospectWorkflows[company.id] = {
    ...workflow,
    activity_log,
    communication_logs: [
      {
        id: `communication-${Date.now()}`,
        date,
        method: payload.method || "Other",
        outcome,
        notes,
        next_action: nextAction,
        next_follow_up: nextFollowUp,
        created_at: now,
        activity_type: activityType,
      },
      ...communicationLogs,
    ].slice(0, 25),
    last_contacted_at: date,
    next_action: nextAction || workflow.next_action || "",
    next_follow_up: nextFollowUp || workflow.next_follow_up || "",
    updated_at: now,
    lastUpdatedAt: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  if (milestone) {
    toggleMilestone(company.id, milestone, true);
  }
  elements.statusMessage.textContent = `Added communication entry for ${company.name || "prospect"}.`;
  renderDetail();
  renderTodayFollowups();
  updateSummary();
}

function addProspectNote(companyId, noteText) {
  const company = state.companies.find((item) => item.id === companyId);
  const text = String(noteText || "").trim();
  if (!company || !text) {
    elements.statusMessage.textContent = "Enter a note before saving.";
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const notes = Array.isArray(workflow.notes) ? workflow.notes : [];

  state.prospectWorkflows[companyId] = {
    ...workflow,
    notes: [
      {
        id: `note-${Date.now()}`,
        text,
        created_at: new Date().toISOString(),
      },
      ...notes,
    ].slice(0, 50),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  recordProspectActivity(company.id, `Added note: ${text.slice(0, 80)}`, "Manual", "note-added");
  elements.statusMessage.textContent = `Added note for ${company.name || "prospect"}.`;
  renderDetail();
  updateSummary();
}

function setNextFollowUp(companyId, followUpDetails) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  const details =
    followUpDetails && typeof followUpDetails === "object"
      ? followUpDetails
      : { nextFollowUp: followUpDetails };
  const nextFollowUpDate = String(details.nextFollowUp || "").trim();
  const nextAction = String(details.nextAction || "").trim();
  const followUpPriority = String(details.followUpPriority || "Normal").trim();
  const lastContacted = String(details.lastContacted || "").trim();
  const quoteStatus = String(details.quoteStatus || "").trim();

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    next_follow_up: nextFollowUpDate,
    next_action: nextAction,
    follow_up_priority: followUpPriority,
    last_contacted_at: lastContacted,
    quote_status: quoteStatus || workflow.quote_status || "Not Started",
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  if (nextFollowUpDate || nextAction || lastContacted || quoteStatus) {
    recordProspectActivity(
      company.id,
      nextFollowUpDate ? `Updated follow-up to ${nextFollowUpDate}` : "Updated follow-up plan",
      "Manual",
      "follow-up-update"
    );
  }
  elements.statusMessage.textContent = nextFollowUpDate
    ? `Set next follow-up for ${company.name || "prospect"} to ${nextFollowUpDate}.`
    : `Cleared next follow-up for ${company.name || "prospect"}.`;
  updateSummary();
  applyFilters();
}

async function checkWebsiteQuality(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !String(company.website || "").trim()) {
    elements.statusMessage.textContent = "No website available to check.";
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(company.id);
  const now = new Date().toISOString();
  state.prospectWorkflows[company.id] = {
    ...workflow,
    websiteCheckStatus: "Checking",
    websiteQualityStatus: workflow.websiteQualityStatus || company.websiteQualityStatus || "Not Checked",
    websiteQualityScore: Number(workflow.websiteQualityScore || company.websiteQualityScore || 0),
    websiteQualityReasons: Array.isArray(workflow.websiteQualityReasons)
      ? workflow.websiteQualityReasons
      : Array.isArray(company.websiteQualityReasons)
        ? company.websiteQualityReasons
        : [],
    websiteCheckedAt: workflow.websiteCheckedAt || company.websiteCheckedAt || "",
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  elements.statusMessage.textContent = `Checking website quality for ${company.name || "prospect"}...`;
  renderDetail();

  try {
    const params = new URLSearchParams({
      websiteUrl: company.website || "",
      businessName: company.name || "",
    });
    const response = await fetch(`/api/prospects/check-website-quality?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.success || !payload.quality) {
      throw new Error(payload.error || "Unable to check website quality.");
    }

    state.prospectWorkflows[company.id] = {
      ...getProspectWorkflow(company.id),
      ...payload.quality,
      websiteCheckStatus: payload.quality.websiteCheckStatus || "Checked",
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistProspectWorkflows();
    applyProspectWorkflow(company);
    elements.statusMessage.textContent = `Website quality checked for ${company.name || "prospect"}.`;
  } catch (error) {
    const failureStatus = String(error?.message || "").toLowerCase().includes("html") ? "Needs Review" : "Broken Website";
    state.prospectWorkflows[company.id] = {
      ...getProspectWorkflow(company.id),
      websiteCheckStatus: failureStatus,
      websiteQualityStatus: failureStatus,
      websiteQualityScore: failureStatus === "Broken Website" ? 0 : 35,
      websiteQualityReasons: ["Unable to check website quality"],
      websiteCheckedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    persistProspectWorkflows();
    applyProspectWorkflow(company);
    elements.statusMessage.textContent = "Unable to check website quality.";
  }

  renderDetail();
  updateSummary();
  applyFilters();
}

function toggleMilestone(companyId, milestone, isComplete) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !milestone) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const milestones = {
    ...(workflow.milestones || {}),
    [milestone]: Boolean(isComplete),
  };
  const currentStage = normalizeProspectStage(
    workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead"
  );
  const checklistStage = getStageFromProcessChecklist(milestones);
  const nextStage = applyStageUpdate(currentStage, checklistStage);
  const nextQuoteStatus = deriveQuoteStatusFromMilestones(milestones, workflow.quote_status || company.quote_status);
  const now = new Date().toISOString();
  const stageChanged = nextStage !== currentStage;
  const communicationLogs = Array.isArray(workflow.communication_logs) ? workflow.communication_logs : [];

  state.prospectWorkflows[companyId] = {
    ...workflow,
    milestones,
    currentStage: nextStage,
    prospect_stage: nextStage,
    quote_status: nextQuoteStatus,
    communication_logs: stageChanged
      ? addSystemStageActivity(communicationLogs, nextStage, now)
      : communicationLogs,
    manual_stage_override: Boolean(workflow.manual_stage_override) && nextStage === currentStage,
    stageUpdateSource: stageChanged ? "process" : workflow.stageUpdateSource || "",
    stageUpdatedAt: stageChanged ? now : workflow.stageUpdatedAt || "",
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  elements.statusMessage.textContent = `Updated process checklist for ${company.name || "prospect"}.`;
  updateSummary();
  applyFilters();
}

function getStageFromProcessChecklist(milestones = {}) {
  if (milestones["Advance payment received"]) {
    return "Client Onboarding";
  }

  if (milestones["Contract received"]) {
    return "Contract Received";
  }

  if (milestones["Contract sent"]) {
    return "Contract Expected";
  }

  if (milestones["Quote sent"]) {
    return "Quote Sent";
  }

  if (milestones["Quote requested"]) {
    return "Quote Requested";
  }

  if (milestones["Requirements discussed"]) {
    return "Requirements Discussed";
  }

  if (milestones["Virtual meeting done"] || milestones["Onsite visit done"]) {
    return "Meeting Done";
  }

  if (milestones["Client responded"]) {
    return "Engaged";
  }

  if (milestones["Initial intro email sent"] || milestones["Call attempted"] || milestones["WhatsApp/message sent"]) {
    return "Outreach Started";
  }

  if (milestones["Saved to prospects"]) {
    return "Saved";
  }

  return "";
}

function deriveStageFromMilestones(milestones, currentStage = "New Lead") {
  return applyStageUpdate(normalizeProspectStage(currentStage), getStageFromProcessChecklist(milestones));
}

function applyStageUpdate(currentStage, checklistStage) {
  const normalizedCurrentStage = normalizeProspectStage(currentStage || "New Lead");
  const normalizedChecklistStage = checklistStage ? normalizeProspectStage(checklistStage) : "";

  if (!normalizedChecklistStage) {
    return normalizedCurrentStage;
  }

  return compareStagePriority(normalizedChecklistStage, normalizedCurrentStage) > 0
    ? normalizedChecklistStage
    : normalizedCurrentStage;
}

function compareStagePriority(leftStage, rightStage) {
  return getStageRank(leftStage) - getStageRank(rightStage);
}

function addSystemStageActivity(communicationLogs, nextStage, timestamp) {
  const message = `Stage updated to ${nextStage} from process checklist`;
  if (communicationLogs.some((entry) => entry.source === "System" && entry.message === message)) {
    return communicationLogs;
  }

  return [
    {
      id: `system-stage-${Date.now()}`,
      date: normalizeDateKey(timestamp),
      method: "System",
      outcome: "Stage updated",
      notes: message,
      message,
      source: "System",
      created_at: timestamp,
    },
    ...communicationLogs,
  ].slice(0, 25);
}

function deriveQuoteStatusFromMilestones(milestones, currentQuoteStatus = "Not Started") {
  if (milestones["Quote sent"]) {
    return "Sent";
  }

  if (milestones["Quote requested"]) {
    return currentQuoteStatus === "Sent" ? currentQuoteStatus : "Quote Requested";
  }

  return currentQuoteStatus || "Not Started";
}

function parseMoneyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value || "")
    .replace(/[$,]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyValue(value) {
  const amount = parseMoneyValue(value);
  if (!amount) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function calculateFinalQuoteAmount(estimatedPrice, discount) {
  return Math.max(0, Math.round(parseMoneyValue(estimatedPrice) - parseMoneyValue(discount)));
}

function getSuggestedQuotePackage(company) {
  const websiteStatus = String(company?.websiteStatus || "").trim();
  const websiteQualityStatus = String(company?.websiteQualityStatus || "").trim();
  const opportunityPriority = String(company?.opportunityPriority || company?.lead_label || "").trim();

  if (opportunityPriority === "Best Prospect") {
    return {
      packageType: "Premium",
      hint: "Professional or Premium",
    };
  }

  if (websiteStatus === "No Website") {
    return {
      packageType: "Professional",
      hint: "Starter or Professional",
    };
  }

  if (websiteStatus === "Social Only") {
    return {
      packageType: "Professional",
      hint: "Professional",
    };
  }

  if (websiteStatus === "Booking Link Only") {
    return {
      packageType: "Professional",
      hint: "Website + Booking or Professional",
    };
  }

  if (
    websiteStatus === "Weak Website" ||
    websiteStatus === "Broken Website" ||
    websiteQualityStatus === "Weak Website" ||
    websiteQualityStatus === "Broken Website"
  ) {
    return {
      packageType: "Professional",
      hint: "Website Redesign or Professional",
    };
  }

  return {
    packageType: "Professional",
    hint: "Professional",
  };
}

function getSuggestedProjectType(company) {
  const websiteStatus = String(company?.websiteStatus || "").trim();
  const websiteQualityStatus = String(company?.websiteQualityStatus || "").trim();

  if (websiteStatus === "Booking Link Only") {
    return "Website + Booking";
  }

  if (websiteQualityStatus === "Weak Website") {
    return "Website Redesign";
  }

  if (websiteStatus === "Weak Website" || websiteStatus === "Broken Website") {
    return "Website Redesign";
  }

  if (websiteStatus === "No Website" || websiteStatus === "Social Only") {
    return "Website";
  }

  return "Website";
}

function getDefaultQuote(company = {}) {
  const packageSuggestion = getSuggestedQuotePackage(company);
  const estimatedPrice = parseMoneyValue(company?.quote_estimated_price || company?.estimated_price || 0);
  const discount = parseMoneyValue(company?.quote_discount || 0);
  const finalQuoteAmount = calculateFinalQuoteAmount(estimatedPrice, discount);

  return {
    quote_status: String(company?.quote_status || "Not Started").trim() || "Not Started",
    quote_project_type: String(company?.quote_project_type || getSuggestedProjectType(company)).trim() || "Website",
    quote_package_type: String(company?.quote_package_type || packageSuggestion.packageType).trim() || packageSuggestion.packageType,
    quote_estimated_price: estimatedPrice,
    quote_discount: discount,
    quote_final_quote_amount: finalQuoteAmount,
    quote_payment_terms: String(company?.quote_payment_terms || "").trim(),
    quote_timeline_estimate: String(company?.quote_timeline_estimate || "").trim(),
    quote_scope_notes: String(company?.quote_scope_notes || "").trim(),
    quote_internal_notes: String(company?.quote_internal_notes || "").trim(),
    quote_sent_date: String(company?.quote_sent_date || "").trim(),
    quote_follow_up_date: String(company?.quote_follow_up_date || company?.next_follow_up || "").trim(),
  };
}

function buildQuoteSummary(company, quote = {}, senderProfile = {}) {
  const quoteModel = { ...getDefaultQuote(company), ...quote };
  const finalAmount = formatMoneyValue(
    quoteModel.quote_final_quote_amount || calculateFinalQuoteAmount(quoteModel.quote_estimated_price, quoteModel.quote_discount)
  );
  const packageLabel = quoteModel.quote_package_type || "Professional";
  const projectType = quoteModel.quote_project_type || "Website";
  const businessName = company?.name || "your business";
  const scopeNotes = String(quoteModel.quote_scope_notes || "").trim() || "Scope to be confirmed";
  const timelineEstimate = String(quoteModel.quote_timeline_estimate || "").trim() || "To be confirmed";
  const paymentTerms = String(quoteModel.quote_payment_terms || "").trim() || "To be confirmed";
  const senderName = String(senderProfile?.yourName || "").trim();
  const senderCompany = String(senderProfile?.companyName || "").trim();
  const senderLabel = [senderName, senderCompany].filter(Boolean).join(" · ");
  const nextStep =
    quoteModel.quote_status === "Accepted"
      ? "Please confirm the final scope and we can get the project moving."
      : quoteModel.quote_status === "Rejected"
        ? "I appreciate the review. If anything changes, I am happy to revisit the scope."
        : "Please review the scope and let me know if you'd like any changes.";

  const summaryLines = [
    `Quote for ${businessName}`,
    `Project type: ${projectType}`,
    `Package: ${packageLabel}`,
    `Scope: ${scopeNotes}`,
    `Timeline: ${timelineEstimate}`,
    `Estimated price: ${formatMoneyValue(quoteModel.quote_estimated_price) || "TBD"}`,
    `Discount: ${formatMoneyValue(quoteModel.quote_discount) || "$0"}`,
    `Final quote amount: ${finalAmount || "TBD"}`,
    `Payment terms: ${paymentTerms}`,
    `Next step: ${nextStep}`,
  ];

  if (senderLabel) {
    summaryLines.push(`Prepared by: ${senderLabel}`);
  } else if (String(senderProfile?.pitch || "").trim()) {
    summaryLines.push(`Service pitch: ${String(senderProfile.pitch).trim()}`);
  }

  const senderContactLine = [
    String(senderProfile?.phone || "").trim() ? `Phone: ${String(senderProfile.phone).trim()}` : "",
    String(senderProfile?.email || "").trim() ? `Email: ${String(senderProfile.email).trim()}` : "",
    String(senderProfile?.website || "").trim() ? `Portfolio: ${String(senderProfile.website).trim()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (senderContactLine) {
    summaryLines.push(`Contact: ${senderContactLine}`);
  }

  return summaryLines.join("\n");
}

function saveQuoteDetails(companyId, quoteDetails = {}, options = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const now = new Date().toISOString();
  const estimate = parseMoneyValue(quoteDetails.estimatedPrice);
  const discount = parseMoneyValue(quoteDetails.discount);
  const finalQuoteAmount = calculateFinalQuoteAmount(estimate, discount);
  const quoteStatus = String(quoteDetails.quoteStatus || workflow.quote_status || company.quote_status || "Not Started").trim() || "Not Started";
  const quoteProjectType = String(quoteDetails.projectType || workflow.quote_project_type || company.quote_project_type || getSuggestedProjectType(company)).trim();
  const quotePackageType = String(quoteDetails.packageType || workflow.quote_package_type || company.quote_package_type || getSuggestedQuotePackage(company).packageType).trim();
  const quotePaymentTerms = String(quoteDetails.paymentTerms || workflow.quote_payment_terms || company.quote_payment_terms || "").trim();
  const quoteTimelineEstimate = String(quoteDetails.timelineEstimate || workflow.quote_timeline_estimate || company.quote_timeline_estimate || "").trim();
  const quoteScopeNotes = String(quoteDetails.scopeNotes || workflow.quote_scope_notes || company.quote_scope_notes || "").trim();
  const quoteInternalNotes = String(quoteDetails.internalNotes || workflow.quote_internal_notes || company.quote_internal_notes || "").trim();
  const quoteSentDate = String(quoteDetails.quoteSentDate || workflow.quote_sent_date || company.quote_sent_date || "").trim();
  const quoteFollowUpDate = String(quoteDetails.quoteFollowUpDate || workflow.quote_follow_up_date || company.quote_follow_up_date || "").trim();

  state.prospectWorkflows[companyId] = {
    ...workflow,
    quote_status: quoteStatus,
    quote_project_type: quoteProjectType,
    quote_package_type: quotePackageType,
    quote_estimated_price: estimate,
    quote_discount: discount,
    quote_final_quote_amount: finalQuoteAmount,
    quote_payment_terms: quotePaymentTerms,
    quote_timeline_estimate: quoteTimelineEstimate,
    quote_scope_notes: quoteScopeNotes,
    quote_internal_notes: quoteInternalNotes,
    quote_sent_date: quoteSentDate,
    quote_follow_up_date: quoteFollowUpDate,
    next_follow_up: quoteFollowUpDate || workflow.next_follow_up || company.next_follow_up || "",
    quote_summary: buildQuoteSummary(
      company,
      {
        quote_status: quoteStatus,
        quote_project_type: quoteProjectType,
        quote_package_type: quotePackageType,
        quote_estimated_price: estimate,
        quote_discount: discount,
        quote_final_quote_amount: finalQuoteAmount,
        quote_payment_terms: quotePaymentTerms,
        quote_timeline_estimate: quoteTimelineEstimate,
        quote_scope_notes: quoteScopeNotes,
        quote_internal_notes: quoteInternalNotes,
        quote_sent_date: quoteSentDate,
        quote_follow_up_date: quoteFollowUpDate,
      },
      state.senderProfile
    ),
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  if (!options.skipActivity) {
    recordProspectActivity(company.id, "Updated quote details", "Manual", "quote-update");
  }
  renderDetail();
  updateSummary();
  renderTodayFollowups();
  applyFilters();
}

function copyQuoteSummary(companyId, quoteDetails = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  const summary = buildQuoteSummary(
    company,
    {
      ...getDefaultQuote(company),
      ...quoteDetails,
    },
    state.senderProfile
  );
  copyToClipboard(summary, "Quote summary copied.");
  if (findSavedProspectId(company)) {
    recordProspectActivity(company.id, "Copied Quote Summary", "Manual", "quote-copy-summary");
  }
}

function moveProspectStageForward(companyId, nextStage, source = "manual") {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !nextStage) {
    return false;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const currentStage = normalizeProspectStage(
    workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead"
  );
  if (compareStagePriority(nextStage, currentStage) <= 0) {
    return false;
  }

  const now = new Date().toISOString();
  state.prospectWorkflows[companyId] = {
    ...workflow,
    currentStage: nextStage,
    prospect_stage: nextStage,
    manual_stage_override: source === "manual" ? true : Boolean(workflow.manual_stage_override),
    stageUpdateSource: source,
    stageUpdatedAt: now,
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  return true;
}

function markQuoteSent(companyId, quoteDetails = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  const today = getTodayDateKey();
  const followUpDate = getSuggestedFollowUpDate("Quote Sent", today, "");
  saveQuoteDetails(companyId, {
    ...quoteDetails,
    quoteStatus: "Sent",
    quoteSentDate: today,
    quoteFollowUpDate: followUpDate,
  }, { skipActivity: true });

  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    quote_status: "Sent",
    quote_sent_date: today,
    quote_follow_up_date: followUpDate,
    next_follow_up: followUpDate,
    last_contacted_at: today,
    next_action: String(quoteDetails.nextAction || workflow.next_action || "Follow up on quote").trim(),
    lastUpdatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  toggleMilestone(companyId, "Quote sent", true);
  recordProspectActivity(company.id, "Quote Sent", "Manual", "quote-sent");
  elements.statusMessage.textContent = `Marked quote sent for ${company.name || "prospect"}.`;
  renderDetail();
  renderTodayFollowups();
  updateSummary();
  applyFilters();
}

function markQuoteAccepted(companyId, quoteDetails = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  saveQuoteDetails(companyId, {
    ...quoteDetails,
    quoteStatus: "Accepted",
  }, { skipActivity: true });

  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    quote_status: "Accepted",
    lastUpdatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  moveProspectStageForward(company.id, "Contract Expected", "manual");
  recordProspectActivity(company.id, "Quote Accepted", "Manual", "quote-accepted");
  elements.statusMessage.textContent = `Marked quote accepted for ${company.name || "prospect"}.`;
  renderDetail();
  updateSummary();
  applyFilters();
}

function markQuoteRejected(companyId, quoteDetails = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  saveQuoteDetails(companyId, {
    ...quoteDetails,
    quoteStatus: "Rejected",
  }, { skipActivity: true });

  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    quote_status: "Rejected",
    lastUpdatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  moveProspectStageForward(company.id, "Lost", "manual");
  recordProspectActivity(company.id, "Quote Rejected", "Manual", "quote-rejected");
  elements.statusMessage.textContent = `Marked quote rejected for ${company.name || "prospect"}.`;
  renderDetail();
  updateSummary();
  applyFilters();
}

function getStageRank(stage) {
  const index = PROSPECT_STAGES.indexOf(stage);
  return index === -1 ? 0 : index;
}

function updateSummary() {
  const savedProspects = getSavedProspectCompanies();
  const followUpsDueToday = savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "due_today");
  const overdueFollowUps = savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "overdue");

  elements.totalCompanies.textContent = String(savedProspects.length);
  elements.companiesScanned.textContent = String(followUpsDueToday.length);
  elements.primaryContacts.textContent = String(overdueFollowUps.length);
  elements.verifiedEmails.textContent = String(
    savedProspects.filter((company) => company.quote_status === "Sent" || company.prospect_stage === "Quote Sent").length
  );
  elements.highConfidenceCount.textContent = String(
    savedProspects.filter((company) => company.prospect_stage === "Contract Expected").length
  );
  elements.needsReview.textContent = String(
    savedProspects.filter((company) => company.prospect_stage === "Contract Received").length
  );
  if (elements.guessedEmails) {
    elements.guessedEmails.textContent = "0";
  }
  if (elements.linkedInDecisionMakers) {
    elements.linkedInDecisionMakers.textContent = "0";
  }
  if (elements.failedScans) {
    elements.failedScans.textContent = String(
      state.companies.filter((company) => company.scan_status === SCAN_STATUS.FAILED).length
    );
  }
}

function renderBulkProgress() {
  if (!state.bulkScan.running && !state.bulkScan.paused) {
    elements.bulkProgress.textContent =
      state.bulkScan.total > 0
        ? `Last queue: ${state.bulkScan.completed} scanned, ${state.bulkScan.failed} failed, ${getRemainingQueueCount()} remaining.`
        : "Bulk scan is idle.";
    return;
  }

  if (state.bulkScan.paused) {
    elements.bulkProgress.textContent = `Queue paused. ${state.bulkScan.completed} scanned, ${state.bulkScan.failed} failed, ${getRemainingQueueCount()} remaining.`;
    return;
  }

  elements.bulkProgress.textContent = `Scanning ${state.bulkScan.currentCompany} (${state.bulkScan.completed}/${state.bulkScan.total}) - Failed ${state.bulkScan.failed} - Remaining ${getRemainingQueueCount()}`;
}

function renderBatchProgress() {
  if (!state.batchCollect.running) {
    elements.batchProgress.textContent =
      state.batchCollect.totalCities > 0
        ? `Last batch: ${state.batchCollect.completedCities}/${state.batchCollect.totalCities} cities, ${state.batchCollect.companiesAdded} added, ${state.batchCollect.duplicatesRemoved} duplicates removed.`
        : "Batch collection is idle.";
    return;
  }

  elements.batchProgress.textContent = `Collecting ${state.batchCollect.currentCity} (${state.batchCollect.completedCities}/${state.batchCollect.totalCities}) - Added ${state.batchCollect.companiesAdded} - Duplicates removed ${state.batchCollect.duplicatesRemoved}`;
}

function renderSavedSearches() {
  elements.savedSearchCount.textContent = String(state.savedSearches.length);

  if (!state.savedSearches.length) {
    elements.savedSearches.innerHTML = `<p class="sidebar-empty">No saved searches yet.</p>`;
    return;
  }

  elements.savedSearches.innerHTML = state.savedSearches
    .map(
      (search) => `
        <button class="saved-search-item" type="button" data-saved-search="${escapeAttribute(search.id)}">
          <span>${escapeHtml(search.label)}</span>
        </button>
      `
    )
    .join("");

  elements.savedSearches.querySelectorAll("[data-saved-search]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-saved-search");
      const saved = state.savedSearches.find((entry) => entry.id === id);
      if (!saved) {
        return;
      }

      setBusinessTypeSelection(
        saved.filters.industry || DEFAULT_INDUSTRY,
        saved.filters.globalSearch || DEFAULT_SEARCH_KEYWORD
      );
      elements.cityFilter.value = saved.filters.city;
      elements.stateFilter.value = saved.filters.state;
      elements.sourceFilter.value = saved.filters.source;
      elements.websiteConditionFilter.value = saved.filters.websiteCondition || "";
      elements.mobileAppConditionFilter.value = saved.filters.mobileAppCondition || "";
      elements.leadScoreFilter.value = saved.filters.leadScore || "";
      elements.reviewStatusFilter.value = saved.filters.reviewStatus || "";
      elements.contactTypeFilter.value = saved.filters.contactType || "";
      state.currentPage = 1;
      applyFilters();
      elements.statusMessage.textContent = `Loaded saved search for ${saved.label}.`;
    });
  });
}

function renderTodayFollowups() {
  if (!elements.todayFollowups || !elements.todayFollowupCount) {
    return;
  }

  const savedProspects = getSavedProspectCompanies();
  const dueCompanies = savedProspects
    .filter((company) => ["due_today", "overdue"].includes(getFollowUpState(company.next_follow_up)))
    .sort((left, right) =>
      String(left.next_follow_up || "").localeCompare(String(right.next_follow_up || "")) ||
      String(left.name || "").localeCompare(String(right.name || ""))
    );
  const upcomingCompanies = savedProspects
    .filter((company) => isUpcomingThisWeek(company.next_follow_up))
    .sort((left, right) =>
      String(left.next_follow_up || "").localeCompare(String(right.next_follow_up || "")) ||
      String(left.name || "").localeCompare(String(right.name || ""))
    );

  elements.todayFollowupCount.textContent = String(dueCompanies.length);

  if (!dueCompanies.length && !upcomingCompanies.length) {
    elements.todayFollowups.innerHTML = `<p class="sidebar-empty">No follow-ups due today.</p>`;
    return;
  }

  elements.todayFollowups.innerHTML = `
    <div class="followup-group-row">
      <span>Overdue: ${escapeHtml(String(dueCompanies.filter((company) => getFollowUpState(company.next_follow_up) === "overdue").length))}</span>
      <span>Due today: ${escapeHtml(String(dueCompanies.filter((company) => getFollowUpState(company.next_follow_up) === "due_today").length))}</span>
      <span>Upcoming this week: ${escapeHtml(String(upcomingCompanies.length))}</span>
    </div>
    ${[...dueCompanies, ...upcomingCompanies]
      .slice(0, 12)
      .map(
        (company) => `
        <button class="followup-item" type="button" data-followup-company="${escapeAttribute(company.id)}">
          <span>
            <strong>${escapeHtml(company.name || "NA")}</strong>
            <small>${escapeHtml(company.phone || "No phone")} - ${escapeHtml(company.prospect_stage || "New Lead")} - ${escapeHtml(company.follow_up_priority || "Normal")}</small>
            <small>Follow-up status: ${escapeHtml(
              getFollowUpState(company.next_follow_up) === "none"
                ? "No Follow-Up Set"
                : getFollowUpState(company.next_follow_up) === "overdue"
                  ? "Overdue"
                  : getFollowUpState(company.next_follow_up) === "due_today"
                    ? "Due Today"
                    : "Upcoming This Week"
            )}</small>
            <small>${escapeHtml(company.next_action || "No next action set")}</small>
          </span>
          <span>${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
        </button>
      `
      )
      .join("")}
  `;

  elements.todayFollowups.querySelectorAll("[data-followup-company]").forEach((button) => {
    button.addEventListener("click", () => openDetails(button.getAttribute("data-followup-company")));
  });
}

function exportVisibleCompaniesCsv() {
  const fields = [
    "name",
    "industry",
    "city",
    "state",
    "address",
    "website",
    "websiteStatus",
    "hasWebsite",
    "mobileAppStatus",
    "hasMobileApp",
    "bookingPlatform",
    "phone",
    "source",
    "lead_score",
    "lead_label",
    "outreach_ready",
    "review_status",
    "prospect_stage",
    "next_follow_up",
    "next_action",
    "follow_up_priority",
    "last_contacted_at",
    "quote_status",
    "latest_note",
    "scan_status",
    "contacts_found",
    "best_contact",
    "primary_email",
    "email_status",
    "contact_type",
    "confidence_score",
  ];

  const rows = [fields.join(",")];
  state.pagedCompanies.forEach((company) => {
    rows.push(
      fields
        .map((field) =>
          escapeCsvValue(
            {
              ...company,
              best_contact: company.primary_contact?.name || "",
              primary_email: company.primary_contact?.email || "",
              email_status: company.primary_contact?.email_status || "none",
              contact_type: company.primary_contact?.contact_type || "",
              confidence_score: company.primary_contact?.confidence_score || company.confidence_score,
              latest_note: company.communication_notes?.[0]?.text || "",
            }[field]
          )
        )
        .join(",")
    );
  });

  downloadBlob("visible_companies.csv", rows.join("\n"));
}

function setViewMode(viewMode) {
  state.viewMode = viewMode;
  render();
}

function changePage(direction) {
  const nextPage = state.currentPage + direction;
  if (nextPage < 1 || nextPage > getTotalPages()) {
    return;
  }

  state.currentPage = nextPage;
  paginate();
  render();
}

function getTotalPages() {
  return Math.max(1, Math.ceil(state.filteredCompanies.length / state.pageSize));
}

function getActiveFilters() {
  const keywordLabel = String(elements.globalSearch.value || "").trim();

  return {
    state: elements.stateFilter.value,
    city: String(elements.cityFilter.value || "").trim().toLowerCase(),
    cityLabel: String(elements.cityFilter.value || "").trim(),
    keyword: keywordLabel.toLowerCase(),
    keywordLabel,
    industry: elements.industryFilter.value || "",
    source: elements.sourceFilter.value,
    websiteCondition: elements.websiteConditionFilter.value || "",
    mobileAppCondition: elements.mobileAppConditionFilter.value || "",
    leadScore: elements.leadScoreFilter.value,
    reviewStatus: elements.reviewStatusFilter.value,
    contactType: elements.contactTypeFilter.value,
    hasPrimary: elements.hasPrimaryFilter.checked,
    hasWebsite: elements.hasWebsiteFilter.checked,
    hasEmail: elements.hasEmailFilter.checked,
    hasPhone: elements.hasPhoneFilter.checked,
    highConfidence: elements.highConfidenceFilter.checked,
    needsReview: elements.needsReviewFilter.checked,
    failedScans: elements.failedScansFilter.checked,
    showHidden: elements.showHiddenFilter?.checked || false,
    verifiedOnly: elements.verifiedOnlyFilter.checked,
    guessedEmails: elements.guessedEmailFilter.checked,
    linkedInFound: elements.linkedInFoundFilter.checked,
    savedStatus: elements.savedStatusFilter?.value || "",
    savedStage: elements.savedStageFilter?.value || "",
    savedFollowUp: elements.savedFollowupFilter?.value || "",
    savedQuoteStatus: elements.savedQuoteFilter?.value || "",
    savedBusinessType: elements.savedBusinessTypeFilter?.value || "",
    savedName: String(elements.savedNameFilter?.value || "").trim().toLowerCase(),
  };
}

function formatWebsiteCondition(value) {
  if (value === "no_website") {
    return "Has Website = No";
  }

  if (value === "has_website") {
    return "Has Website = Yes";
  }

  if (value === "social_only") {
    return "Social Only";
  }

  if (value === "booking_link_only") {
    return "Booking Link Only";
  }

  if (value === "weak_website") {
    return "Weak Website";
  }

  if (value === "broken_website") {
    return "Broken Website";
  }

  if (value === "unknown") {
    return "Unknown";
  }

  return "Any";
}

function matchesWebsiteCondition(company, condition) {
  if (!condition) {
    return true;
  }

  const websiteStatus = normalizeWebsiteStatus(company.websiteStatus) || deriveWebsiteStatus(company);

  if (condition === "has_website") {
    return websiteStatus === "Has Website";
  }

  if (condition === "no_website") {
    return ["No Website", "Social Only", "Booking Link Only", "Broken Website"].includes(websiteStatus);
  }

  return websiteStatus === formatWebsiteCondition(condition);
}

function formatMobileAppCondition(value) {
  if (value === "no_mobile_app") {
    return "Has Mobile App = No";
  }

  if (value === "has_mobile_app") {
    return "Has Mobile App = Yes";
  }

  if (value === "booking_app_only") {
    return "Booking App Only";
  }

  if (value === "marketplace_app_only") {
    return "Marketplace App Only";
  }

  if (value === "unknown") {
    return "Unknown";
  }

  return "Any";
}

function matchesMobileAppCondition(company, condition) {
  if (!condition) {
    return true;
  }

  if (condition === "has_mobile_app") {
    return company.hasMobileApp === true;
  }

  if (condition === "no_mobile_app") {
    return company.hasMobileApp === false;
  }

  if (condition === "booking_app_only") {
    return company.mobileAppStatus === "Booking App Only";
  }

  if (condition === "marketplace_app_only") {
    return company.mobileAppStatus === "Marketplace App Only";
  }

  if (condition === "unknown") {
    return company.mobileAppStatus === "Unknown";
  }

  return true;
}

function populateBusinessTypeGroups() {
  elements.industryFilter.innerHTML = Object.keys(BUSINESS_TYPE_GROUPS)
    .map((group) => `<option value="${escapeAttribute(group)}">${escapeHtml(group)}</option>`)
    .join("");
  setBusinessTypeSelection(DEFAULT_INDUSTRY, DEFAULT_SEARCH_KEYWORD);
}

function populateBusinessTypes(group, selectedType = "") {
  const groupConfig = BUSINESS_TYPE_GROUPS[group] || BUSINESS_TYPE_GROUPS[DEFAULT_INDUSTRY];
  const types = Object.keys(groupConfig.types);
  const nextType = types.includes(selectedType) ? selectedType : types[0] || DEFAULT_SEARCH_KEYWORD;

  elements.globalSearch.innerHTML = types
    .map((type) => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`)
    .join("");
  elements.globalSearch.value = nextType;
}

function setBusinessTypeSelection(group, type) {
  const nextGroup = BUSINESS_TYPE_GROUPS[group] ? group : DEFAULT_INDUSTRY;
  elements.industryFilter.value = nextGroup;
  populateBusinessTypes(nextGroup, normalizeBusinessTypeForGroup(nextGroup, type));
  syncPresetChips();
}

function getDefaultBusinessType(group) {
  const groupConfig = BUSINESS_TYPE_GROUPS[group] || BUSINESS_TYPE_GROUPS[DEFAULT_INDUSTRY];
  return Object.keys(groupConfig.types)[0] || DEFAULT_SEARCH_KEYWORD;
}

function normalizeBusinessTypeForGroup(group, type) {
  const groupConfig = BUSINESS_TYPE_GROUPS[group] || BUSINESS_TYPE_GROUPS[DEFAULT_INDUSTRY];
  const types = Object.keys(groupConfig.types);
  const normalizedType = String(type || "").trim().toLowerCase();
  const match = types.find((item) => item.toLowerCase() === normalizedType);

  if (match) {
    return match;
  }

  return getDefaultBusinessType(group);
}

function populateStates() {
  const states = [
    "", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
    "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
    "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
    "VT", "VA", "WA", "WV", "WI", "WY",
  ];

  elements.stateFilter.innerHTML = states
    .map((value) => `<option value="${value}">${value || "All states"}</option>`)
    .join("");
  elements.stateFilter.value = DEFAULT_STATE;
}

function populateSavedWorkqueueFilters() {
  if (elements.savedStageFilter) {
    elements.savedStageFilter.innerHTML = [
      `<option value="">All stages</option>`,
      ...PROSPECT_STAGES.map((stage) => `<option value="${escapeAttribute(stage)}">${escapeHtml(stage)}</option>`),
    ].join("");
  }

  if (elements.savedQuoteFilter) {
    elements.savedQuoteFilter.innerHTML = [
      `<option value="">All quote statuses</option>`,
      ...QUOTE_STATUSES.map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`),
    ].join("");
  }

  if (elements.savedBusinessTypeFilter) {
    const businessTypes = Object.values(BUSINESS_TYPE_GROUPS).flatMap((group) => Object.keys(group.types));
    elements.savedBusinessTypeFilter.innerHTML = [
      `<option value="">All business types</option>`,
      ...businessTypes.map((type) => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`),
    ].join("");
  }
}

async function loadTargetCities() {
  try {
    const response = await fetch("/data/target-cities.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load target cities (${response.status})`);
    }

    const payload = await response.json();
    state.targetCities = Array.isArray(payload) ? payload : DEFAULT_BATCH_CITIES;
  } catch (error) {
    state.targetCities = DEFAULT_BATCH_CITIES;
  }
}

function getTargetCitiesForState(stateCode) {
  const targetState = String(stateCode || "").trim().toUpperCase();
  return state.targetCities.filter((entry) => String(entry.state || "").trim().toUpperCase() === targetState);
}

function buildTestProspect(filters) {
  const city = filters.cityLabel || "Farmers Branch";
  const stateCode = filters.state || DEFAULT_STATE;
  const businessType = filters.keywordLabel || DEFAULT_SEARCH_KEYWORD;

  return {
    id: "manual-luxe-beauty-studio-farmers-branch-tx",
    name: "Luxe Beauty Studio",
    keyword: businessType,
    industry: DEFAULT_INDUSTRY,
    industry_tags: ["Salon & Beauty", "Local Beauty", "Website Prospect"],
    city,
    state: stateCode,
    address: `123 Valley View Ln, ${city}, ${stateCode}`,
    phone: "(972) 555-0148",
    website: "",
    websiteStatus: "No Website",
    hasWebsite: false,
    socialPlatform: "Unknown",
    websiteQualityStatus: "Not Checked",
    websiteQualityScore: 0,
    websiteQualityReasons: [],
    websiteCheckStatus: "Not Checked",
    websiteCheckedAt: "",
    mobileAppStatus: "Has Mobile App = No",
    hasMobileApp: false,
    bookingPlatform: "Unknown",
    rating: 4.6,
    reviews: 82,
    opportunityScore: 95,
    opportunityPriority: "Best Prospect",
    scoreReasons: ["No owned website", "Strong reviews", "Phone available", "Address available"],
    reasonChips: ["No owned website", "Strong reviews", "Phone available", "Address available"],
    source: "manual",
    source_url: "",
    base_lead_score: 92,
    lead_score: 95,
    lead_label: "Best Prospect",
    confidence_score: 95,
    outreach_ready: false,
    review_status: "new",
    prospect_stage: "New Lead",
    stage: "New Lead",
    quote_status: "Not Started",
    follow_up_priority: "Normal",
    contacts: [],
    contacts_found: 0,
    primary_contact: null,
    has_primary_contact: false,
    has_email: false,
    has_valid_email: false,
    has_phone: true,
    needs_review: false,
    scan_status: SCAN_STATUS.NOT_SCANNED,
    collected_at: new Date().toISOString(),
    manual_prospect: true,
  };
}

function mergeManualProspects(companies, manualProspects) {
  return dedupeProspectList([...(Array.isArray(manualProspects) ? manualProspects : []), ...(Array.isArray(companies) ? companies : [])]);
}

function makeStableManualId(name, address) {
  return `manual-${String(`${name || "prospect"}-${address || ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

async function collectCompaniesForLocation({ keyword, city, state: stateCode, source }) {
  const response = await fetch("/api/collect-companies", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      keyword,
      city,
      state: stateCode,
      source,
    }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Unable to collect companies for ${city}, ${stateCode}.`);
  }

  return payload;
}

async function searchLiveProspects({ businessType, location, state: stateCode, websiteCondition }) {
  const params = new URLSearchParams({
    businessType,
    location,
    state: stateCode,
    websiteCondition: websiteCondition || "",
  });
  const response = await fetch(`/api/prospects/search?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Unable to load live prospects. You can still add a manual prospect.");
  }

  return {
    prospects: Array.isArray(payload.prospects) ? payload.prospects : [],
  };
}

function mapLiveProspectToCompany(prospect) {
  const score = Number(prospect.opportunityScore || 0);
  const websiteStatus = normalizeWebsiteStatus(prospect.websiteStatus) || "Unknown";

  return {
    id: prospect.id || prospect.placeId || makeStableManualId(prospect.businessName, prospect.address),
    placeId: prospect.placeId || "",
    name: prospect.businessName || "Unknown",
    keyword: prospect.businessType || DEFAULT_SEARCH_KEYWORD,
    industry: inferCompanyIndustry({
      keyword: prospect.businessType,
      name: prospect.businessName,
      website: prospect.websiteUrl,
    }),
    industry_tags: buildIndustryTags({
      keyword: prospect.businessType,
      name: prospect.businessName,
      website: prospect.websiteUrl,
    }),
    city: prospect.city || elements.cityFilter.value || "",
    state: prospect.state || elements.stateFilter.value || "",
    address: prospect.address || "",
    phone: prospect.phone || "",
    website: prospect.websiteUrl || "",
    websiteStatus,
    hasWebsite: prospect.hasWebsite ?? null,
    socialPlatform: prospect.socialPlatform || "Unknown",
    websiteQualityStatus: prospect.websiteQualityStatus || "Not Checked",
    websiteQualityScore: Number(prospect.websiteQualityScore || 0),
    websiteQualityReasons: Array.isArray(prospect.websiteQualityReasons) ? prospect.websiteQualityReasons : [],
    websiteCheckStatus: prospect.websiteCheckStatus || "Not Checked",
    websiteCheckedAt: prospect.websiteCheckedAt || "",
    mobileAppStatus: prospect.mobileAppStatus || "Unknown",
    hasMobileApp: prospect.hasMobileApp ?? null,
    bookingPlatform: prospect.bookingPlatform || "Unknown",
    rating: Number(prospect.rating || 0),
    reviews: Number(prospect.reviewCount || 0),
    reviewCount: Number(prospect.reviewCount || 0),
    source: "google_places",
    source_url: prospect.googleProfileUrl || prospect.mapsUrl || "",
    base_lead_score: score,
    lead_score: score,
    opportunityScore: score,
    opportunityPriority: String(prospect.opportunityPriority || getOpportunityPriority(score)).trim() || getOpportunityPriority(score),
    lead_label: String(prospect.opportunityPriority || getOpportunityPriority(score)).trim() || getOpportunityPriority(score),
    scoreReasons: normalizeReasonChips(prospect.scoreReasons || prospect.reasonChips),
    reasonChips: normalizeReasonChips(prospect.scoreReasons || prospect.reasonChips),
    confidence_score: score,
    outreach_ready: false,
    review_status: "new",
    prospect_stage: prospect.prospectStatus || "New Lead",
    stage: prospect.prospectStatus || "New Lead",
    quote_status: "Not Started",
    follow_up_priority: "Normal",
    contacts: [],
    contacts_found: 0,
    primary_contact: null,
    has_primary_contact: false,
    has_email: false,
    has_valid_email: false,
    has_phone: Boolean(prospect.phone),
    needs_review: false,
    scan_status: SCAN_STATUS.NOT_SCANNED,
    collected_at: new Date().toISOString(),
  };
}

function normalizeReasonChips(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4);
}

function augmentCompaniesWithScannerData(companies) {
  return companies.map((company) => {
    const scanState = scanner.getState(company.id);
    const mergedContacts =
      scanState.contacts.length > (company.contacts || []).length ? scanState.contacts : company.contacts || [];
    const primaryContact = company.primary_contact || mergedContacts[0] || null;
    const websiteModel = buildWebsiteModel(company);
    const websiteQualityModel = buildWebsiteQualityModel(company);
    const mobileAppModel = buildMobileAppModel(company);
    const scoreReasons = normalizeReasonChips(company.scoreReasons || company.reasonChips);
    const reasonChips = scoreReasons.length
      ? scoreReasons
      : buildQualificationReasonChips({ ...company, ...websiteModel, ...websiteQualityModel, ...mobileAppModel });

    return applyProspectWorkflow({
      ...company,
      ...mobileAppModel,
      ...websiteModel,
      ...websiteQualityModel,
      scoreReasons,
      reasonChips,
      contacts: mergedContacts,
      primary_contact: primaryContact,
      contacts_found: mergedContacts.length || company.contacts_found || 0,
      has_primary_contact: Boolean(primaryContact),
      has_email: mergedContacts.some((contact) => Boolean(contact.email)),
      has_valid_email: mergedContacts.some((contact) =>
        ["verified", "generic"].includes(String(contact.email_status || "").toLowerCase())
      ),
      has_phone: mergedContacts.some((contact) => Boolean(contact.phone)) || Boolean(company.phone),
      needs_review:
        company.needs_review ||
        scanState.status === SCAN_STATUS.NEEDS_REVIEW ||
        scanState.status === SCAN_STATUS.FAILED,
      scan_status: scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED,
      scan_failure_reason: scanState.failureReason || company.scan_failure_reason || "",
      last_scanned: scanState.lastScanned || company.last_scanned || "",
    });
  });
}

function applyProspectWorkflow(company) {
  if (!company?.id) {
    return company;
  }

  const workflow = getProspectWorkflow(company.id);
  const communicationLogs = Array.isArray(workflow.communication_logs)
    ? workflow.communication_logs
    : [];
  const legacyCommunicationNotes = Array.isArray(workflow.communication_notes)
    ? workflow.communication_notes.map((note) => ({
        id: note.id || `legacy-${Date.now()}`,
        date: normalizeDateKey(note.created_at) || "",
        method: "Other",
        outcome: "",
        notes: note.text || "",
        next_action: "",
        next_follow_up: "",
        created_at: note.created_at || "",
      }))
    : [];
  const notes = Array.isArray(workflow.notes) ? workflow.notes : [];
  const allCommunicationLogs = communicationLogs.length ? communicationLogs : legacyCommunicationNotes;
  const lastCommunication = allCommunicationLogs[0] || null;
  const activityLog = Array.isArray(workflow.activity_log)
    ? workflow.activity_log
    : allCommunicationLogs.length
      ? allCommunicationLogs.map((entry) => ({
          id: entry.id || `activity-${Date.now()}`,
          created_at: entry.created_at || entry.date || "",
          date: entry.date || normalizeDateKey(entry.created_at) || "",
          activity_type: normalizeActivityType(entry.activity_type || entry.action || entry.method || entry.message || "Update"),
          method: entry.method || "Other",
          notes: entry.notes || entry.message || "",
          next_action: entry.next_action || "",
          next_follow_up: entry.next_follow_up || "",
          source: entry.source || "Manual",
          action: entry.action || "update",
          message: entry.message || entry.outcome || "Updated",
        }))
      : [];

  Object.assign(company, {
    prospect_stage: normalizeProspectStage(
      workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead"
    ),
    stage: normalizeProspectStage(
      workflow.currentStage || workflow.prospect_stage || company.stage || company.prospect_stage || "New Lead"
    ),
    next_follow_up: workflow.next_follow_up || company.next_follow_up || "",
    next_action: workflow.next_action || lastCommunication?.next_action || "",
    last_contacted_at: workflow.last_contacted_at || lastCommunication?.date || "",
    follow_up_priority: workflow.follow_up_priority || company.follow_up_priority || "Normal",
    quote_status: workflow.quote_status || company.quote_status || "Not Started",
    quote_project_type: workflow.quote_project_type || company.quote_project_type || getSuggestedProjectType(company),
    quote_package_type:
      workflow.quote_package_type || company.quote_package_type || getSuggestedQuotePackage(company).packageType,
    quote_estimated_price: Number(
      workflow.quote_estimated_price ?? company.quote_estimated_price ?? company.quote_price ?? 0
    ),
    quote_discount: Number(workflow.quote_discount ?? company.quote_discount ?? 0),
    quote_final_quote_amount: Number(
      workflow.quote_final_quote_amount ??
        company.quote_final_quote_amount ??
        calculateFinalQuoteAmount(
          workflow.quote_estimated_price ?? company.quote_estimated_price ?? company.quote_price ?? 0,
          workflow.quote_discount ?? company.quote_discount ?? 0
        )
    ),
    quote_payment_terms: workflow.quote_payment_terms || company.quote_payment_terms || "",
    quote_timeline_estimate: workflow.quote_timeline_estimate || company.quote_timeline_estimate || "",
    quote_scope_notes: workflow.quote_scope_notes || company.quote_scope_notes || "",
    quote_internal_notes: workflow.quote_internal_notes || company.quote_internal_notes || "",
    quote_sent_date: workflow.quote_sent_date || company.quote_sent_date || "",
    quote_follow_up_date: workflow.quote_follow_up_date || company.quote_follow_up_date || company.next_follow_up || "",
    quote_summary:
      workflow.quote_summary ||
      company.quote_summary ||
      buildQuoteSummary(
        company,
        {
          quote_status: workflow.quote_status || company.quote_status || "Not Started",
          quote_project_type: workflow.quote_project_type || company.quote_project_type || getSuggestedProjectType(company),
          quote_package_type:
            workflow.quote_package_type || company.quote_package_type || getSuggestedQuotePackage(company).packageType,
          quote_estimated_price: workflow.quote_estimated_price ?? company.quote_estimated_price ?? company.quote_price ?? 0,
          quote_discount: workflow.quote_discount ?? company.quote_discount ?? 0,
          quote_final_quote_amount:
            workflow.quote_final_quote_amount ??
            company.quote_final_quote_amount ??
            calculateFinalQuoteAmount(
              workflow.quote_estimated_price ?? company.quote_estimated_price ?? company.quote_price ?? 0,
              workflow.quote_discount ?? company.quote_discount ?? 0
            ),
          quote_payment_terms: workflow.quote_payment_terms || company.quote_payment_terms || "",
          quote_timeline_estimate: workflow.quote_timeline_estimate || company.quote_timeline_estimate || "",
          quote_scope_notes: workflow.quote_scope_notes || company.quote_scope_notes || "",
          quote_internal_notes: workflow.quote_internal_notes || company.quote_internal_notes || "",
          quote_sent_date: workflow.quote_sent_date || company.quote_sent_date || "",
          quote_follow_up_date: workflow.quote_follow_up_date || company.quote_follow_up_date || company.next_follow_up || "",
        },
        state.senderProfile
      ),
    websiteQualityStatus: workflow.websiteQualityStatus || company.websiteQualityStatus || "Not Checked",
    websiteQualityScore: Number(
      workflow.websiteQualityScore ?? company.websiteQualityScore ?? company.website_quality_score ?? 0
    ),
    websiteQualityReasons: Array.isArray(workflow.websiteQualityReasons)
      ? workflow.websiteQualityReasons
      : Array.isArray(company.websiteQualityReasons)
        ? company.websiteQualityReasons
        : [],
    websiteCheckStatus: workflow.websiteCheckStatus || company.websiteCheckStatus || "Not Checked",
    websiteCheckedAt: workflow.websiteCheckedAt || company.websiteCheckedAt || "",
    outreach_templates:
      workflow.outreach_templates && typeof workflow.outreach_templates === "object"
        ? workflow.outreach_templates
        : company.outreach_templates && typeof company.outreach_templates === "object"
          ? company.outreach_templates
          : {},
    outreach_tone: workflow.outreach_tone || company.outreach_tone || "Professional",
    communication_logs: allCommunicationLogs,
    activity_log: activityLog.length ? activityLog : Array.isArray(company.activity_log) ? company.activity_log : [],
    notes,
    milestones: workflow.milestones || {},
    latest_communication_note: lastCommunication?.notes || "",
    is_saved_prospect: Boolean(findSavedProspectId(company)),
    archived: Boolean(workflow.archived || company.archived),
    archived_at: workflow.archived_at || company.archived_at || "",
    workflow_updated_at: workflow.updated_at || "",
    manual_stage_override: Boolean(workflow.manual_stage_override),
    currentStage: normalizeProspectStage(
      workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead"
    ),
    stageUpdatedAt: workflow.stageUpdatedAt || "",
    stageUpdateSource: workflow.stageUpdateSource || "",
    lastUpdatedAt: workflow.lastUpdatedAt || workflow.updated_at || "",
    base_lead_score: Number(company.base_lead_score || company.lead_score || 0),
  });

  company.opportunityScore = calculateOpportunityScore(company);
  company.opportunityPriority = getOpportunityPriority(company.opportunityScore);
  company.lead_score = company.opportunityScore;
  company.lead_label = company.opportunityPriority;
  company.scoreReasons = getScoreReasons(company, company.opportunityScore);
  company.reasonChips = normalizeReasonChips(company.scoreReasons.length ? company.scoreReasons : company.reasonChips);
  company.archived = Boolean(workflow.archived || company.archived);
  company.archived_at = workflow.archived_at || company.archived_at || "";
  company.is_hidden = isProspectHidden(company);

  return company;
}

function buildQualificationReasonChips(company) {
  const scoreReasons = getScoreReasons(company, calculateOpportunityScore(company));
  return scoreReasons.length ? scoreReasons : ["Needs review"];
}

function calculateOpportunityScore(company) {
  let score = Number(company.base_lead_score || company.opportunityScore || company.lead_score || company.confidence_score || 40);
  const websiteStatus = normalizeWebsiteStatus(company.websiteStatus) || "Unknown";
  const websiteQualityStatus = String(company.websiteQualityStatus || "Not Checked").trim();
  const rating = Number(company.rating || 0);
  const reviewCount = Number(company.reviewCount || company.reviews || 0);
  const phone = String(company.phone || "").trim();
  const address = String(company.address || "").trim();
  const mobileAppStatus = String(company.mobileAppStatus || company.mobile_app_status || "").trim();
  const hasMobileApp = Boolean(company.hasMobileApp) || /yes|booking app only|marketplace app only/i.test(mobileAppStatus);

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
  }

  if (websiteQualityStatus === "Strong Website") {
    score -= 15;
  } else if (websiteQualityStatus === "Weak Website") {
    score += 20;
  } else if (websiteQualityStatus === "Broken Website") {
    score += 25;
  } else if (websiteQualityStatus === "Needs Review") {
    score += 10;
  }

  if (phone) {
    score += 10;
  } else {
    score -= 10;
  }

  if (address) {
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

  if (!isLikelyChainBusiness(company.name || company.businessName || "")) {
    score += 8;
  } else {
    score -= 15;
  }

  if (hasMobileApp) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
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

function getScoreReasons(company, score) {
  const reasons = [];
  const websiteStatus = normalizeWebsiteStatus(company.websiteStatus) || deriveWebsiteStatus(company);
  const websiteQualityStatus = String(company.websiteQualityStatus || company.website_quality_status || "Not Checked").trim();
  const rating = Number(company.rating || 0);
  const reviewCount = Number(company.reviewCount || company.reviews || 0);
  const phone = String(company.phone || "").trim();
  const address = String(company.address || "").trim();

  if (websiteStatus === "No Website") {
    reasons.push("No owned website");
  } else if (websiteStatus === "Social Only") {
    reasons.push("Social profile only");
  } else if (websiteStatus === "Booking Link Only") {
    reasons.push("Booking platform only");
  } else if (websiteStatus === "Broken Website") {
    reasons.push("Broken website");
  } else if (websiteStatus === "Weak Website") {
    reasons.push("Weak website");
  } else if (websiteStatus === "Has Website") {
    reasons.push("Strong website, lower priority");
  }

  if (websiteQualityStatus === "Strong Website") {
    reasons.push("Strong website, lower priority");
  } else if (websiteQualityStatus === "Weak Website") {
    reasons.push("Weak website");
  } else if (websiteQualityStatus === "Broken Website") {
    reasons.push("Broken website");
  } else if (websiteQualityStatus === "Needs Review") {
    reasons.push("Needs review");
  }

  if (rating >= 4.3 && reviewCount >= 25) {
    reasons.push("Strong reviews");
  } else if (rating > 0 && rating < 3.8) {
    reasons.push("Low rating");
  }

  if (reviewCount >= 25) {
    reasons.push("High review count");
  } else if (reviewCount > 0 && reviewCount < 5) {
    reasons.push("Very low reviews");
  }

  if (phone) {
    reasons.push("Phone available");
  } else {
    reasons.push("Missing phone");
  }

  if (address) {
    reasons.push("Address available");
  }

  if (isLikelyChainBusiness(company.name || company.businessName || "")) {
    reasons.push("Possible chain/franchise");
  } else {
    reasons.push("Independent local business");
  }

  if (company.hasMobileApp || /yes|booking app only|marketplace app only/i.test(String(company.mobileAppStatus || ""))) {
    reasons.push("Mobile app present");
  }

  const priority = getOpportunityPriority(score);
  if (priority === "Not Recommended") {
    reasons.push("Not recommended");
  }

  return [...new Set(reasons)].slice(0, 4);
}

function isLikelyChainBusiness(name) {
  return /(\bgreat clips\b|\bsupercuts\b|\bsport clips\b|\bfantastic sams\b|\bmassage envy\b|\beuropean wax center\b|\bthe lash lounge\b|\bamazing lash studio\b|\bhand & stone\b|\bpalm beach tan\b|\bulta\b|\bsephora\b|\bregis\b|\bcost cutters\b|\bjcpenney\b|\bwalmart\b|\btarget\b|\bcostco\b)/i.test(
    String(name || "")
  );
}

function getProspectWorkflow(companyId) {
  return state.prospectWorkflows[companyId] || {};
}

function normalizeProspectStage(stage) {
  const normalized = String(stage || "New Lead").trim();
  if (normalized === "Meeting Scheduled") {
    return "Meeting Done";
  }

  return PROSPECT_STAGES.includes(normalized) ? normalized : "New Lead";
}

function ensureProspectWorkflow(companyId, company) {
  if (!companyId || state.prospectWorkflows[companyId]) {
    return;
  }

  state.prospectWorkflows[companyId] = {
    currentStage: normalizeProspectStage(company?.prospect_stage || company?.stage || "New Lead"),
    prospect_stage: company?.prospect_stage || company?.stage || "New Lead",
    communication_logs: [],
    notes: [],
    milestones: {},
    next_follow_up: company?.next_follow_up || "",
    next_action: company?.next_action || "",
    last_contacted_at: company?.last_contacted_at || "",
    follow_up_priority: company?.follow_up_priority || "Normal",
    ...getDefaultQuote(company),
    opportunityScore: Number(company?.opportunityScore || company?.lead_score || company?.confidence_score || 0),
    opportunityPriority:
      String(company?.opportunityPriority || company?.lead_label || getOpportunityPriority(company?.lead_score || 0)).trim() ||
      getOpportunityPriority(company?.lead_score || 0),
    scoreReasons: Array.isArray(company?.scoreReasons) ? company.scoreReasons : normalizeReasonChips(company?.reasonChips),
    websiteQualityStatus: company?.websiteQualityStatus || "Not Checked",
    websiteQualityScore: Number(company?.websiteQualityScore || 0),
    websiteQualityReasons: Array.isArray(company?.websiteQualityReasons) ? company.websiteQualityReasons : [],
    websiteCheckStatus: company?.websiteCheckStatus || "Not Checked",
    websiteCheckedAt: company?.websiteCheckedAt || "",
    outreach_templates: company?.outreach_templates && typeof company.outreach_templates === "object" ? company.outreach_templates : {},
    outreach_tone: company?.outreach_tone || "Professional",
    archived: Boolean(company?.archived),
    archived_at: company?.archived_at || "",
    activity_log: Array.isArray(company?.activity_log) ? company.activity_log : [],
    manual_stage_override: false,
    stageUpdateSource: "",
    stageUpdatedAt: "",
    lastUpdatedAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
}

function appendWorkflowActivity(existingEntries, entry) {
  const entries = Array.isArray(existingEntries) ? existingEntries : [];
  const nextEntry = {
    id: `activity-${Date.now()}`,
    created_at: new Date().toISOString(),
    source: entry?.source || "User",
    action: entry?.action || "update",
    message: entry?.message || "Updated",
  };

  const latest = entries[0];
  if (
    latest &&
    String(latest.action || "") === nextEntry.action &&
    String(latest.message || "") === nextEntry.message &&
    String(latest.source || "") === nextEntry.source
  ) {
    return entries;
  }

  return [nextEntry, ...entries].slice(0, 50);
}

function recordProspectActivity(companyId, message, source = "User", action = "update") {
  if (!companyId) {
    return;
  }

  ensureProspectWorkflow(companyId, state.companies.find((item) => item.id === companyId));
  const workflow = getProspectWorkflow(companyId);
  const activity_log = appendWorkflowActivity(workflow.activity_log, { message, source, action });

  state.prospectWorkflows[companyId] = {
    ...workflow,
    activity_log,
    lastUpdatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
}

function normalizeActivityType(value) {
  const label = String(value || "").trim();
  if (!label) {
    return "Status Changed";
  }

  const match = {
    "intro email copied": "Intro Email Copied",
    "intro email sent": "Intro Email Sent",
    "sms/whatsapp copied": "SMS/WhatsApp Copied",
    "sms whatsapp copied": "SMS/WhatsApp Copied",
    "sms/whatsapp": "SMS/WhatsApp Copied",
    "sms whatsapp sent": "SMS/WhatsApp Sent",
    "message sent": "Message Sent",
    "call attempted": "Call Attempted",
    "onsite visit done": "Onsite Visit Done",
    "virtual meeting done": "Virtual Meeting Done",
    "client responded": "Client Responded",
    "requirements discussed": "Requirements Discussed",
    "quote requested": "Quote Requested",
    "quote sent": "Quote Sent",
    "follow-up sent": "Follow-Up Sent",
    "follow up sent": "Follow-Up Sent",
    "contract sent": "Contract Sent",
    "contract received": "Contract Received",
    "advance payment received": "Advance Payment Received",
    "note added": "Note Added",
    "status changed": "Status Changed",
    saved: "Saved",
    hidden: "Hidden",
    archived: "Archived",
    unarchived: "Unarchived",
  }[normalizeText(label)];

  return match || titleCase(label);
}

function templateLabelFromKey(templateKey) {
  const labels = {
    intro_email: "Intro Email",
    sms_message: "SMS / WhatsApp",
    call_script: "Phone Call Script",
    onsite_visit: "Onsite Visit Script",
    follow_up: "Follow-Up Message",
    quote_follow_up: "Quote Follow-Up",
  };
  return labels[templateKey] || titleCase(templateKey);
}

function milestoneToActivityType(milestone) {
  const normalized = normalizeText(milestone);
  const map = {
    "initialintroemailsent": "Intro Email Sent",
    "callattempted": "Call Attempted",
    "whatsappmessagesent": "Message Sent",
    "onsitevisitdone": "Onsite Visit Done",
    "virtualmeetingdone": "Virtual Meeting Done",
    "clientresponded": "Client Responded",
    "requirementsdiscussed": "Requirements Discussed",
    "quoterequested": "Quote Requested",
    "quotesent": "Quote Sent",
    "followupsent": "Follow-Up Sent",
    "contractsent": "Contract Sent",
    "contractreceived": "Contract Received",
    "advancepaymentreceived": "Advance Payment Received",
    "savedtoprospects": "Saved",
  };
  return map[normalized] || normalizeActivityType(milestone);
}

function milestoneToMethod(milestone) {
  const normalized = normalizeText(milestone);
  if (normalized.includes("email")) {
    return "Email";
  }
  if (normalized.includes("whatsapp") || normalized.includes("message")) {
    return "WhatsApp";
  }
  if (normalized.includes("call")) {
    return "Call";
  }
  if (normalized.includes("onsite")) {
    return "Onsite Visit";
  }
  if (normalized.includes("virtual")) {
    return "Virtual Meeting";
  }
  return "Other";
}

function mapMethodToActivityType(method) {
  const normalized = normalizeText(method);
  if (!normalized) {
    return "Status Changed";
  }

  if (normalized.includes("call")) {
    return "Call Attempted";
  }
  if (normalized.includes("email")) {
    return "Intro Email Sent";
  }
  if (normalized.includes("sms") || normalized.includes("whatsapp") || normalized.includes("message")) {
    return "Message Sent";
  }
  if (normalized.includes("onsite")) {
    return "Onsite Visit Done";
  }
  if (normalized.includes("virtual") || normalized.includes("meeting")) {
    return "Virtual Meeting Done";
  }

  return "Status Changed";
}

function mapActivityToMilestone(activityType) {
  const normalized = normalizeActivityType(activityType);
  const map = {
    "Intro Email Sent": "Initial intro email sent",
    "Call Attempted": "Call attempted",
    "SMS/WhatsApp Copied": "",
    "SMS/WhatsApp Sent": "WhatsApp/message sent",
    "Message Sent": "WhatsApp/message sent",
    "Onsite Visit Done": "Onsite visit done",
    "Virtual Meeting Done": "Virtual meeting done",
    "Client Responded": "Client responded",
    "Requirements Discussed": "Requirements discussed",
    "Quote Requested": "Quote requested",
    "Quote Sent": "Quote sent",
    "Follow-Up Sent": "Follow-up sent",
    "Contract Sent": "Contract sent",
    "Contract Received": "Contract received",
    "Advance Payment Received": "Advance payment received",
    Saved: "Saved to prospects",
  };

  return map[normalized] || "";
}

function getSuggestedFollowUpDate(activityType, dateValue = getTodayDateKey(), outcome = "") {
  const baseKey = normalizeDateKey(dateValue) || getTodayDateKey();
  const baseDate = new Date(`${baseKey}T00:00:00`);
  const normalized = normalizeActivityType(activityType);
  const noResponse = /no response|no answer|voicemail|left message|left voicemail/i.test(String(outcome || ""));
  const offsets = {
    "Intro Email Sent": 3,
    "Message Sent": 2,
    "Follow-Up Sent": 2,
    "Quote Sent": 2,
    "Call Attempted": noResponse ? 1 : 0,
    "Virtual Meeting Done": 1,
    "Onsite Visit Done": 1,
    "Client Responded": 1,
  };
  const days = offsets[normalized] || 0;
  if (!days) {
    return "";
  }

  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function addActivityEntry(companyId, payload = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const now = new Date().toISOString();
  const date = String(payload.date || getTodayDateKey()).trim();
  const activityType = normalizeActivityType(payload.activityType || payload.type || payload.action || "Status Changed");
  const method = String(payload.method || "Other").trim();
  const notes = String(payload.notes || "").trim();
  const nextAction = String(payload.nextAction || payload.next_action || "").trim();
  const suggestedFollowUp = getSuggestedFollowUpDate(activityType, date, payload.outcome || notes);
  const nextFollowUp = String(payload.nextFollowUp || payload.next_follow_up || suggestedFollowUp || "").trim();
  const message = String(
    payload.message ||
      notes ||
      payload.outcome ||
      `${activityType}${method ? ` via ${method}` : ""}`
  ).trim();
  const activityEntry = {
    id: `activity-${Date.now()}`,
    created_at: now,
    date,
    activity_type: activityType,
    method,
    notes,
    next_action: nextAction,
    next_follow_up: nextFollowUp,
    source: payload.source || "Manual",
    action: payload.action || normalizeText(activityType),
    message,
  };
  const activity_log = appendWorkflowActivity(workflow.activity_log, activityEntry);
  const communicationLogs = Array.isArray(workflow.communication_logs) ? workflow.communication_logs : [];
  const nextMilestone = mapActivityToMilestone(activityType);

  state.prospectWorkflows[companyId] = {
    ...workflow,
    activity_log,
    communication_logs:
      notes || payload.outcome || method !== "Other"
        ? [
            {
              id: `communication-${Date.now()}`,
              date,
              method,
              outcome: String(payload.outcome || "").trim(),
              notes,
              next_action: nextAction,
              next_follow_up: nextFollowUp,
              created_at: now,
              activity_type: activityType,
            },
            ...communicationLogs,
          ].slice(0, 25)
        : communicationLogs,
    last_contacted_at: date || workflow.last_contacted_at || "",
    next_action: nextAction || workflow.next_action || "",
    next_follow_up: nextFollowUp || workflow.next_follow_up || "",
    updated_at: now,
    lastUpdatedAt: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);

  if (nextMilestone) {
    toggleMilestone(companyId, nextMilestone, true);
  }
}

function updateProspectFromActivity(companyId, payload = {}) {
  addActivityEntry(companyId, payload);
}

function ensureSavedProspect(company) {
  if (!company?.id) {
    return;
  }

  if (!findSavedProspectId(company)) {
    state.savedCompanies = [...state.savedCompanies, company.id];
    persistSavedCompanies();
  }

  ensureProspectWorkflow(company.id, company);
  const workflow = getProspectWorkflow(company.id);
  const nextStage = !workflow.prospect_stage || workflow.prospect_stage === "New Lead" ? "Saved" : workflow.prospect_stage;
  const now = new Date().toISOString();
  state.prospectWorkflows[company.id] = {
    ...workflow,
    milestones: {
      ...(workflow.milestones || {}),
      "Saved to prospects": true,
    },
    currentStage: nextStage,
    prospect_stage: nextStage,
    quote_status: workflow.quote_status || "Not Started",
    stageUpdateSource: workflow.stageUpdateSource || (nextStage === "Saved" ? "process" : ""),
    stageUpdatedAt: workflow.stageUpdatedAt || (nextStage === "Saved" ? now : ""),
    lastUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
}

function findSavedProspectId(company) {
  if (!company) {
    return "";
  }

  const companyKeys = getProspectDedupeKeys(company);
  return (
    state.savedCompanies.find((savedId) => {
      if (savedId === company.id) {
        return true;
      }

      const savedCompany = state.companies.find((item) => item.id === savedId);
      if (!savedCompany) {
        return false;
      }

      const savedKeys = getProspectDedupeKeys(savedCompany);
      return companyKeys.some((key) => savedKeys.includes(key));
    }) || ""
  );
}

function getSavedProspectCompanies() {
  return state.companies
    .filter((company) => Boolean(findSavedProspectId(company)) && !company.archived)
    .map((company) => applyProspectWorkflow(company));
}

function getFollowUpState(dateValue) {
  const dateKey = normalizeDateKey(dateValue);
  if (!dateKey) {
    return "none";
  }

  const today = getTodayDateKey();
  if (dateKey < today) {
    return "overdue";
  }

  if (dateKey === today) {
    return "due_today";
  }

  return "upcoming";
}

function matchesSavedFollowUpFilter(dateValue, filterValue) {
  const stateValue = getFollowUpState(dateValue);
  if (["none", "no_follow_up", "no_followup", "no follow-up set"].includes(String(filterValue || "").toLowerCase())) {
    return stateValue === "none";
  }

  if (filterValue === "upcoming_week") {
    return isUpcomingThisWeek(dateValue);
  }

  return stateValue === filterValue;
}

function isUpcomingThisWeek(dateValue) {
  const dateKey = normalizeDateKey(dateValue);
  if (!dateKey) {
    return false;
  }

  const today = new Date(`${getTodayDateKey()}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 1 && diffDays <= 7;
}

function buildResultsSubtitle() {
  const filters = getActiveFilters();
  if (state.activeView === "saved") {
    return `${state.filteredCompanies.length} saved prospect${state.filteredCompanies.length === 1 ? "" : "s"} sorted for follow-up and conversion work.`;
  }

  const parts = [
    filters.keywordLabel || "Any business type",
    filters.cityLabel || "All cities",
    filters.state || "All states",
    formatWebsiteCondition(filters.websiteCondition),
    formatMobileAppCondition(filters.mobileAppCondition),
  ];

  return `${state.filteredCompanies.length} matches - ${parts.join(" - ")}`;
}

function buildWebsiteModel(company) {
  const explicitStatus = normalizeWebsiteStatus(company.websiteStatus || company.website_status);
  const derived = classifyWebsiteStatus({
    websiteUrl: company.website || company.website_url || company.websiteUrl || company.website_uri || "",
    websiteStatus: explicitStatus,
    scanFailureReason: company.scan_failure_reason || company.website_scan_failure_reason || "",
    businessName: company.name || company.businessName || "",
  });
  const derivedStatus = explicitStatus || derived.websiteStatus || "Unknown";
  const hasWebsite =
    typeof company.hasWebsite === "boolean"
      ? company.hasWebsite
      : typeof company.has_website === "boolean"
        ? company.has_website
        : derived.hasWebsite;

  return {
    hasWebsite,
    websiteStatus: derivedStatus,
    bookingPlatform: company.bookingPlatform || company.booking_platform || derived.bookingPlatform || "Unknown",
    socialPlatform: company.socialPlatform || company.social_platform || derived.socialPlatform || "Unknown",
  };
}

function buildWebsiteQualityModel(company) {
  return {
    websiteQualityStatus: String(company.websiteQualityStatus || company.website_quality_status || "Not Checked").trim() || "Not Checked",
    websiteQualityScore: Number(company.websiteQualityScore || company.website_quality_score || 0),
    websiteQualityReasons: Array.isArray(company.websiteQualityReasons || company.website_quality_reasons)
      ? [...new Set([...(company.websiteQualityReasons || []), ...(company.website_quality_reasons || [])].map((item) => String(item || "").trim()).filter(Boolean))]
      : [],
    websiteCheckStatus: String(company.websiteCheckStatus || company.website_check_status || "Not Checked").trim() || "Not Checked",
    websiteCheckedAt: String(company.websiteCheckedAt || company.website_checked_at || ""),
  };
}

function normalizeWebsiteStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]/g, " ");

  if (!normalized) {
    return "";
  }

  if (normalized.includes("social")) {
    return "Social Only";
  }

  if (normalized.includes("booking")) {
    return "Booking Link Only";
  }

  if (normalized.includes("weak")) {
    return "Weak Website";
  }

  if (normalized.includes("broken")) {
    return "Broken Website";
  }

  if (normalized === "unknown") {
    return "Unknown";
  }

  if (normalized.includes("yes") || normalized === "has website") {
    return "Has Website";
  }

  if (normalized.includes("no") || normalized === "no website") {
    return "No Website";
  }

  return "";
}

function classifyWebsiteStatus({ websiteUrl, websiteStatus, scanFailureReason, businessName } = {}) {
  const explicitStatus = normalizeWebsiteStatus(websiteStatus);
  if (explicitStatus) {
    return {
      websiteStatus: explicitStatus,
      hasWebsite: ["Has Website", "Weak Website"].includes(explicitStatus)
        ? true
        : explicitStatus === "Unknown"
          ? null
          : false,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  const raw = String(websiteUrl || "").trim();
  const normalized = raw.toLowerCase();

  if (!raw || isUnavailableWebsiteValue(normalized)) {
    return {
      websiteStatus: "No Website",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  if (isSocialProfileUrl(normalized)) {
    return {
      websiteStatus: "Social Only",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: detectSocialPlatform(normalized),
    };
  }

  const bookingPlatform = detectBookingPlatform(normalized);
  if (bookingPlatform !== "Unknown") {
    return {
      websiteStatus: "Booking Link Only",
      hasWebsite: false,
      bookingPlatform,
      socialPlatform: "Unknown",
    };
  }

  if (isClearlyBrokenWebsite(normalized, scanFailureReason)) {
    return {
      websiteStatus: "Broken Website",
      hasWebsite: false,
      bookingPlatform: "Unknown",
      socialPlatform: "Unknown",
    };
  }

  if (looksLikeOwnedWebsite(normalized, businessName)) {
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

function deriveWebsiteStatus(company) {
  return classifyWebsiteStatus({
    websiteUrl: company.website || company.website_url || company.websiteUrl || company.website_uri || "",
    websiteStatus: company.websiteStatus || company.website_status,
    scanFailureReason: company.scan_failure_reason || company.website_scan_failure_reason || "",
    businessName: company.name || company.businessName || "",
  }).websiteStatus;
}

function isSocialProfileUrl(value) {
  return /(facebook\.com|instagram\.com|linktr\.ee|yelp\.com|google\.com\/maps|business\.google\.com|g\.page|tiktok\.com|x\.com|twitter\.com)/i.test(value);
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

  const normalizedBusinessName = String(businessName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const normalizedUrl = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalizedBusinessName && normalizedUrl.includes(normalizedBusinessName)) {
    return true;
  }

  return true;
}

function buildMobileAppModel(company) {
  const explicitStatus = normalizeMobileAppStatus(company.mobileAppStatus || company.mobile_app_status);
  const explicitHasMobileApp = readBooleanish(company.hasMobileApp ?? company.has_mobile_app);
  const explicitAppUrl = [
    company.mobileAppUrl,
    company.mobile_app_url,
    company.iosAppUrl,
    company.ios_app_url,
    company.androidAppUrl,
    company.android_app_url,
    company.app_url,
  ].some((value) => Boolean(String(value || "").trim()));
  const bookingPlatform = deriveBookingPlatform(company);

  if (explicitStatus) {
    return {
      mobileAppStatus: explicitStatus,
      hasMobileApp: explicitStatus === "Unknown" ? null : explicitStatus !== "Has Mobile App = No",
      bookingPlatform,
    };
  }

  if (explicitHasMobileApp === false) {
    return {
      mobileAppStatus: "Has Mobile App = No",
      hasMobileApp: false,
      bookingPlatform,
    };
  }

  if (bookingPlatform && bookingPlatform !== "Unknown") {
    return {
      mobileAppStatus: isMarketplacePlatform(bookingPlatform) ? "Marketplace App Only" : "Booking App Only",
      hasMobileApp: true,
      bookingPlatform,
    };
  }

  if (explicitHasMobileApp === true || explicitAppUrl) {
    return {
      mobileAppStatus: "Has Mobile App = Yes",
      hasMobileApp: true,
      bookingPlatform,
    };
  }

  return {
    mobileAppStatus: "Unknown",
    hasMobileApp: null,
    bookingPlatform,
  };
}

function normalizeMobileAppStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[_-]/g, " ");

  if (!normalized) {
    return "";
  }

  if (normalized.includes("booking")) {
    return "Booking App Only";
  }

  if (normalized.includes("marketplace")) {
    return "Marketplace App Only";
  }

  if (normalized === "unknown") {
    return "Unknown";
  }

  if (normalized.includes("yes") || normalized === "has mobile app") {
    return "Has Mobile App = Yes";
  }

  if (normalized.includes("no") || normalized === "no mobile app") {
    return "Has Mobile App = No";
  }

  return "";
}

function deriveBookingPlatform(company) {
  const explicitPlatform = String(
    company.bookingPlatform || company.booking_platform || company.booking_app || company.app_platform || ""
  ).trim();

  if (explicitPlatform) {
    return normalizeBookingPlatform(explicitPlatform);
  }

  const haystack = [
    company.website,
    company.source_url,
    company.booking_url,
    company.bookingUrl,
    company.profile_url,
    company.profileUrl,
    ...(company.contacts || []).map((contact) => contact.source_url),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const platforms = [
    ["Vagaro", "vagaro"],
    ["Booksy", "booksy"],
    ["Square", "squareup"],
    ["Square", "square.site"],
    ["Square", "appointments.squareup.com"],
    ["Acuity", "acuityscheduling"],
    ["Schedulicity", "schedulicity"],
    ["Mindbody", "mindbodyonline"],
    ["Fresha", "fresha"],
    ["GlossGenius", "glossgenius"],
    ["StyleSeat", "styleseat"],
    ["Setmore", "setmore"],
    ["SimplyBook", "simplybook"],
    ["Zenoti", "zenoti"],
    ["Calendly", "calendly"],
    ["Yelp", "yelp"],
    ["Facebook", "facebook"],
    ["Instagram", "instagram"],
    ["Google Business Profile", "google"],
    ["Thumbtack", "thumbtack"],
  ];

  const match = platforms.find(([, token]) => haystack.includes(token));
  return match ? normalizeBookingPlatform(match[0]) : "Unknown";
}

function isMarketplacePlatform(platform) {
  return ["Yelp", "Facebook", "Instagram", "Google Business Profile", "Thumbtack"].includes(platform);
}

function normalizeBookingPlatform(platform) {
  const normalized = String(platform || "").trim().toLowerCase();

  if (!normalized) {
    return "Unknown";
  }

  if (normalized === "square appointments" || normalized === "squareup" || normalized === "square") {
    return "Square";
  }

  if (normalized === "fresha") {
    return "Fresha";
  }

  if (normalized === "booksy") {
    return "Booksy";
  }

  if (normalized === "vagaro") {
    return "Vagaro";
  }

  if (normalized === "glossgenius") {
    return "GlossGenius";
  }

  if (normalized === "mindbody" || normalized === "mindbodyonline") {
    return "Mindbody";
  }

  if (normalized === "schedulicity") {
    return "Schedulicity";
  }

  if (normalized === "styleseat") {
    return "StyleSeat";
  }

  if (normalized === "acuity" || normalized === "acuityscheduling") {
    return "Acuity";
  }

  if (normalized === "calendly") {
    return "Calendly";
  }

  if (normalized === "setmore") {
    return "Setmore";
  }

  if (normalized === "simplybook") {
    return "SimplyBook";
  }

  if (normalized === "zenoti") {
    return "Zenoti";
  }

  if (normalized === "google business profile" || normalized === "google") {
    return "Other Booking Platform";
  }

  if (normalized === "yelp" || normalized === "facebook" || normalized === "instagram" || normalized === "thumbtack") {
    return "Other Booking Platform";
  }

  return platform === "Unknown" ? "Unknown" : "Other Booking Platform";
}

function readBooleanish(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function buildIndustryQuery(industry, keywordLabel) {
  const groupConfig = BUSINESS_TYPE_GROUPS[industry] || BUSINESS_TYPE_GROUPS[DEFAULT_INDUSTRY];
  const businessType = normalizeBusinessTypeForGroup(industry || DEFAULT_INDUSTRY, keywordLabel || DEFAULT_SEARCH_KEYWORD);
  const typeQuery = groupConfig.types[businessType] || businessType;
  return [businessType, typeQuery, groupConfig.query].filter(Boolean).join(" ").trim();
}

function buildSearchKeyword(filters) {
  const keyword = filters.keywordLabel || DEFAULT_SEARCH_KEYWORD;
  return buildIndustryQuery(filters.industry, keyword);
}

function mapCollectorSource(source) {
  const normalizedSource = String(source || "").trim().toLowerCase();

  if (normalizedSource === "google_places") {
    return "google";
  }

  if (normalizedSource === "serp_api") {
    return "serp";
  }

  if (normalizedSource === "fallback_search") {
    return "fallback";
  }

  return normalizedSource;
}

function formatFriendlyError(error) {
  const message = String(error?.message || error || "").trim();

  if (!message) {
    return "Search failed. Try another city, keyword, or source.";
  }

  if (message.toLowerCase().includes("failed to fetch")) {
    return "Unable to load live prospects. You can still add a manual prospect.";
  }

  return message;
}

function inferCompanyIndustry(company) {
  const haystack = [
    company.keyword,
    company.name,
    company.website,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const match = Object.entries(BUSINESS_TYPE_GROUPS).find(([, groupConfig]) =>
    Object.keys(groupConfig.types).some((type) => haystack.includes(type.toLowerCase()))
  );

  return match?.[0] || DEFAULT_INDUSTRY;
}

function buildIndustryTags(company) {
  const industry = inferCompanyIndustry(company);
  const tags = [industry];
  const groupTags = BUSINESS_TYPE_GROUPS[industry]?.tags || [];

  return [...new Set([...tags, ...groupTags])];
}

function compareCompanies(left, right, sortBy, activeView) {
  const leftScore = Number(left.opportunityScore || left.lead_score || left.confidence_score || 0);
  const rightScore = Number(right.opportunityScore || right.lead_score || right.confidence_score || 0);
  const leftReviews = Number(left.reviewCount || left.reviews || 0);
  const rightReviews = Number(right.reviewCount || right.reviews || 0);
  const leftRating = Number(left.rating || 0);
  const rightRating = Number(right.rating || 0);
  const leftName = String(left.name || "");
  const rightName = String(right.name || "");

  if (sortBy === "name") {
    return leftName.localeCompare(rightName);
  }

  if (sortBy === "recent") {
    return String(right.last_scanned || right.collected_at || "").localeCompare(
      String(left.last_scanned || left.collected_at || "")
    );
  }

  if (sortBy === "confidence") {
    return rightScore - leftScore || rightReviews - leftReviews || rightRating - leftRating || leftName.localeCompare(rightName);
  }

  if (sortBy === "reviews") {
    return rightReviews - leftReviews || rightScore - leftScore || rightRating - leftRating || leftName.localeCompare(rightName);
  }

  if (sortBy === "rating") {
    return rightRating - leftRating || rightReviews - leftReviews || rightScore - leftScore || leftName.localeCompare(rightName);
  }

  if (sortBy === "score") {
    return rightScore - leftScore || rightReviews - leftReviews || rightRating - leftRating || leftName.localeCompare(rightName);
  }

  if (sortBy === "best_match") {
    if (activeView === "saved") {
      return 0;
    }

    return rightScore - leftScore || rightReviews - leftReviews || rightRating - leftRating || leftName.localeCompare(rightName);
  }

  return rightScore - leftScore || rightReviews - leftReviews || rightRating - leftRating || leftName.localeCompare(rightName);
}

function syncIndustryNav() {
  const selectedIndustry = elements.industryFilter.value || "";
  elements.industryNav.forEach((button) => {
    const industry = button.getAttribute("data-industry-nav") || "";
    const isActive = !industry ? selectedIndustry === "" : industry === selectedIndustry;
    button.classList.toggle("active", isActive);
  });
  syncPresetChips();
}

function syncPresetChips() {
  const selectedGroup = elements.industryFilter.value || "";
  const selectedType = elements.globalSearch.value || "";

  elements.presetButtons.forEach((button) => {
    const presetGroup = button.getAttribute("data-business-group") || "";
    const presetType = button.getAttribute("data-business-type") || "";
    button.classList.toggle("active", presetGroup === selectedGroup && presetType === selectedType);
  });

  elements.appViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.getAttribute("data-app-view") || "discovery";
      state.currentPage = 1;
      applyFilters();
    });
  });
}

function flattenContacts(companies) {
  return companies.flatMap((company) => company.contacts || []);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  render();
}

function getRemainingQueueCount() {
  return Math.max(0, state.bulkScan.total - state.bulkScan.completed);
}

function persistScanQueueState() {
  localStorage.setItem(
    SCAN_QUEUE_KEY,
    JSON.stringify({
      ...state.bulkScan,
      running: false,
      currentCompany: state.bulkScan.running ? state.bulkScan.currentCompany : state.bulkScan.currentCompany,
    })
  );
}

function restoreQueueState() {
  try {
    const raw = localStorage.getItem(SCAN_QUEUE_KEY);
    const parsed = JSON.parse(raw || "null");
    if (!parsed || !Array.isArray(parsed.queue) || !parsed.queue.length) {
      return;
    }

    state.bulkScan = {
      running: false,
      paused: Boolean(parsed.queue.length),
      canceled: false,
      currentCompany: parsed.currentCompany || "",
      completed: Number(parsed.completed || 0),
      failed: Number(parsed.failed || 0),
      total: Number(parsed.total || parsed.queue.length || 0),
      queue: parsed.queue,
      currentIndex: Number(parsed.currentIndex || 0),
    };

    if (state.bulkScan.queue.length) {
      elements.statusMessage.textContent = "Restored paused scan queue from a previous session.";
    }
  } catch (error) {
    localStorage.removeItem(SCAN_QUEUE_KEY);
  }
}

async function copyToClipboard(value, successMessage) {
  if (!value) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  } else {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  elements.statusMessage.textContent = successMessage;
}

function downloadFile(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function loadSavedSearches() {
  const parsed = readLocalJson(SAVED_SEARCHES_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function persistSavedSearches() {
  writeLocalJson(SAVED_SEARCHES_KEY, state.savedSearches);
}

function loadSavedCompanies() {
  const parsed = readLocalJson(SAVED_COMPANIES_KEY, []);
  return Array.isArray(parsed) ? [...new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean))] : [];
}

function persistSavedCompanies() {
  state.savedCompanies = [...new Set(state.savedCompanies.filter(Boolean))];
  writeLocalJson(SAVED_COMPANIES_KEY, state.savedCompanies);
}

function loadProspectWorkflows() {
  const parsed = readLocalJson(PROSPECT_WORKFLOWS_KEY, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function persistProspectWorkflows() {
  writeLocalJson(PROSPECT_WORKFLOWS_KEY, state.prospectWorkflows);
}

function loadManualProspects() {
  const parsed = readLocalJson(MANUAL_PROSPECTS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function persistManualProspects() {
  writeLocalJson(MANUAL_PROSPECTS_KEY, state.manualProspects);
}

function loadSenderProfile() {
  const parsed = readLocalJson(SENDER_PROFILE_KEY, null);
  return {
    yourName: String(parsed?.yourName || "").trim(),
    companyName: String(parsed?.companyName || "").trim(),
    phone: String(parsed?.phone || "").trim(),
    email: String(parsed?.email || "").trim(),
    website: String(parsed?.website || "").trim(),
    pitch: String(
      parsed?.pitch ||
        "I help local businesses create clean, mobile-friendly websites that make services, photos, and contact options easier for customers to find."
    ).trim(),
  };
}

function persistSenderProfile() {
  writeLocalJson(SENDER_PROFILE_KEY, state.senderProfile);
}

function loadHiddenProspects() {
  const parsed = readLocalJson(HIDDEN_PROSPECTS_KEY, []);
  return Array.isArray(parsed)
    ? [...new Set(parsed.map((value) => normalizeText(value)).filter(Boolean))]
    : [];
}

function persistHiddenProspects() {
  state.hiddenProspects = [...new Set(state.hiddenProspects.map((value) => normalizeText(value)).filter(Boolean))];
  writeLocalJson(HIDDEN_PROSPECTS_KEY, state.hiddenProspects);
}

function readLocalJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return JSON.parse(raw || JSON.stringify(fallbackValue));
  } catch (error) {
    return fallbackValue;
  }
}

function writeLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  return String(value || "").slice(0, 10);
}

function maybeCloseMenu({ button, menu, eventTarget, onClose }) {
  if (!menu || !button || menu.classList.contains("hidden")) {
    return;
  }

  if (menu.contains(eventTarget) || button.contains(eventTarget)) {
    return;
  }

  onClose();
}

function escapeCsvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
