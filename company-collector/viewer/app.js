import { createScanner, SCAN_STATUS } from "./scanner.js";
import { renderDetailPanel, renderResultsView } from "./ui.js";

const DEFAULT_INDUSTRY = "Salon & Beauty";
const DEFAULT_SEARCH_KEYWORD = "Salon";
const DEFAULT_STATE = "TX";
const SAVED_SEARCHES_KEY = "find-any-company.saved-searches";
const SAVED_COMPANIES_KEY = "find-any-company.saved-companies";
const PROSPECT_WORKFLOWS_KEY = "find-any-company.prospect-workflows";
const MANUAL_PROSPECTS_KEY = "find-any-company.manual-prospects";
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

const state = {
  companies: [],
  filteredCompanies: [],
  pagedCompanies: [],
  selectedCompanyId: null,
  currentPage: 1,
  pageSize: 20,
  viewMode: "grid",
  loading: false,
  sortBy: "best_match",
  activeDetailTab: "overview",
  savedSearches: loadSavedSearches(),
  savedCompanies: loadSavedCompanies(),
  prospectWorkflows: loadProspectWorkflows(),
  manualProspects: loadManualProspects(),
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
  todayFollowupCount: document.querySelector("#today-followup-count"),
  todayFollowups: document.querySelector("#today-followups"),
  guessedEmails: document.querySelector("#guessed-emails"),
  linkedInDecisionMakers: document.querySelector("#linkedin-decision-makers"),
  failedScans: document.querySelector("#failed-scans"),
  failedScansFilter: document.querySelector("#failed-scans-filter"),
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
};

await initialize();

async function initialize() {
  bindEvents();
  populateBusinessTypeGroups();
  populateStates();
  await loadTargetCities();
  renderSavedSearches();
  await refreshCompanies();
  restoreQueueState();
  applyFilters();
}

function bindEvents() {
  elements.searchButton.addEventListener("click", handleSearch);

  elements.collectMoreButton.addEventListener("click", handleCollectMore);
  elements.batchCollectButton.addEventListener("click", handleBatchCollect);
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

  elements.listViewButton.addEventListener("click", () => setViewMode("list"));
  elements.gridViewButton.addEventListener("click", () => setViewMode("grid"));
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
    elements.verifiedOnlyFilter,
    elements.guessedEmailFilter,
    elements.linkedInFoundFilter,
  ].forEach((input) => {
    input.addEventListener("change", () => {
      state.currentPage = 1;
      syncPresetChips();
      applyFilters();
    });
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
  elements.collectMoreButton.disabled = true;

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
    elements.collectMoreButton.disabled = false;
  }
}

function applyFilters() {
  const filters = getActiveFilters();
  syncIndustryNav();

  state.filteredCompanies = state.companies
    .filter((company) => {
      if (filters.state && company.state !== filters.state) {
        return false;
      }

      if (filters.city && !String(company.city || "").toLowerCase().includes(filters.city)) {
        return false;
      }

      if (filters.industry && company.industry !== filters.industry) {
        return false;
      }

      if (!matchesWebsiteCondition(company, filters.websiteCondition)) {
        return false;
      }

      if (!matchesMobileAppCondition(company, filters.mobileAppCondition)) {
        return false;
      }

      if (filters.keyword) {
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

      if (filters.leadScore && company.lead_label !== filters.leadScore) {
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
    .sort((left, right) => compareCompanies(left, right, state.sortBy));

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
  elements.resultCount.textContent = String(state.filteredCompanies.length);
  elements.resultsSubtitle.textContent = buildResultsSubtitle();
  elements.emptyState.classList.toggle("hidden", state.filteredCompanies.length > 0 || state.loading);
  elements.resultsContainer.classList.toggle("hidden", state.filteredCompanies.length === 0);
  elements.loadingState.classList.toggle("hidden", !state.loading);
  elements.pageIndicator.textContent = `Page ${state.currentPage} of ${getTotalPages()}`;
  elements.prevPageButton.disabled = state.currentPage <= 1;
  elements.nextPageButton.disabled = state.currentPage >= getTotalPages();
  elements.listViewButton.classList.toggle("active", state.viewMode === "list");
  elements.gridViewButton.classList.toggle("active", state.viewMode === "grid");
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
  elements.collectMoreButton.disabled = true;

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
    elements.collectMoreButton.disabled = false;
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
  elements.batchCollectButton.disabled = true;
  elements.collectMoreButton.disabled = true;

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
    elements.batchCollectButton.disabled = false;
    elements.collectMoreButton.disabled = false;
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
  const existing = findDuplicateProspect(prospect, [...state.companies, ...state.manualProspects]);

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
    elements.statusMessage.textContent = "Prospect saved.";
  }

  persistSavedCompanies();
  if (company) {
    applyProspectWorkflow(company);
  }
  updateSummary();
  applyFilters();
}

function updateProspectStatus(companyId, nextStatus) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company || !nextStatus) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    prospect_stage: nextStatus,
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  elements.statusMessage.textContent = `Updated ${company.name || "prospect"} status to ${nextStatus}.`;
  updateSummary();
  applyFilters();
}

function addCommunicationEntry(payload) {
  const company = state.companies.find((item) => item.id === payload.companyId);
  const notes = String(payload.notes || "").trim();
  const outcome = String(payload.outcome || "").trim();
  const nextAction = String(payload.nextAction || "").trim();
  if (!company || (!notes && !outcome && !nextAction)) {
    elements.statusMessage.textContent = "Enter communication details before saving.";
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(company.id);
  const communicationLogs = Array.isArray(workflow.communication_logs)
    ? workflow.communication_logs
    : [];
  const date = payload.date || getTodayDateKey();
  const nextFollowUp = String(payload.nextFollowUp || "").trim();

  state.prospectWorkflows[company.id] = {
    ...workflow,
    communication_logs: [
      {
        id: `communication-${Date.now()}`,
        date,
        method: payload.method || "Other",
        outcome,
        notes,
        next_action: nextAction,
        next_follow_up: nextFollowUp,
        created_at: new Date().toISOString(),
      },
      ...communicationLogs,
    ].slice(0, 25),
    last_contacted_at: date,
    next_action: nextAction || workflow.next_action || "",
    next_follow_up: nextFollowUp || workflow.next_follow_up || "",
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
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
  elements.statusMessage.textContent = `Added note for ${company.name || "prospect"}.`;
  renderDetail();
  updateSummary();
}

function setNextFollowUp(companyId, followUpDate) {
  const company = state.companies.find((item) => item.id === companyId);
  const nextFollowUpDate = String(followUpDate || "").trim();
  if (!company) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  state.prospectWorkflows[companyId] = {
    ...workflow,
    next_follow_up: nextFollowUpDate,
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  elements.statusMessage.textContent = nextFollowUpDate
    ? `Set next follow-up for ${company.name || "prospect"} to ${nextFollowUpDate}.`
    : `Cleared next follow-up for ${company.name || "prospect"}.`;
  updateSummary();
  applyFilters();
}

function updateSummary() {
  const savedProspects = getSavedProspectCompanies();
  const followUpsDueToday = savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "due_today");
  const overdueFollowUps = savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "overdue");

  elements.totalCompanies.textContent = String(savedProspects.length);
  elements.companiesScanned.textContent = String(followUpsDueToday.length);
  elements.primaryContacts.textContent = String(overdueFollowUps.length);
  elements.verifiedEmails.textContent = String(
    savedProspects.filter((company) => company.prospect_stage === "Quote Sent").length
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

  const dueCompanies = getSavedProspectCompanies()
    .filter((company) => ["due_today", "overdue"].includes(getFollowUpState(company.next_follow_up)))
    .sort((left, right) =>
      String(left.next_follow_up || "").localeCompare(String(right.next_follow_up || "")) ||
      String(left.name || "").localeCompare(String(right.name || ""))
    );

  elements.todayFollowupCount.textContent = String(dueCompanies.length);

  if (!dueCompanies.length) {
    elements.todayFollowups.innerHTML = `<p class="sidebar-empty">No follow-ups due today.</p>`;
    return;
  }

  elements.todayFollowups.innerHTML = dueCompanies
    .map(
      (company) => `
        <button class="followup-item" type="button" data-followup-company="${escapeAttribute(company.id)}">
          <span>
            <strong>${escapeHtml(company.name || "NA")}</strong>
            <small>${escapeHtml(company.phone || "No phone")} - ${escapeHtml(company.prospect_stage || "New Lead")}</small>
            <small>${escapeHtml(company.next_action || "No next action set")}</small>
          </span>
          <span>${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
        </button>
      `
    )
    .join("");

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
    verifiedOnly: elements.verifiedOnlyFilter.checked,
    guessedEmails: elements.guessedEmailFilter.checked,
    linkedInFound: elements.linkedInFoundFilter.checked,
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

  if (condition === "has_website") {
    return company.hasWebsite === true;
  }

  if (condition === "no_website") {
    return company.hasWebsite === false;
  }

  return company.websiteStatus === formatWebsiteCondition(condition);
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
    websiteStatus: "Has Website = No",
    hasWebsite: false,
    mobileAppStatus: "Has Mobile App = No",
    hasMobileApp: false,
    bookingPlatform: "",
    rating: 4.6,
    reviews: 82,
    source: "manual",
    source_url: "",
    lead_score: 92,
    lead_label: "High Fit",
    confidence_score: 92,
    outreach_ready: false,
    review_status: "new",
    prospect_stage: "New Lead",
    stage: "New Lead",
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
  const merged = [...manualProspects, ...companies];
  return merged.reduce((deduped, company) => {
    if (!findDuplicateProspect(company, deduped)) {
      deduped.push(company);
    }
    return deduped;
  }, []);
}

function findDuplicateProspect(prospect, candidates) {
  const prospectKeys = getProspectIdentityKeys(prospect);
  return candidates.find((candidate) => {
    const candidateKeys = getProspectIdentityKeys(candidate);
    return prospectKeys.some((key) => candidateKeys.includes(key));
  });
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
    websiteStatus: prospect.websiteStatus || "Unknown",
    hasWebsite: Boolean(prospect.hasWebsite),
    mobileAppStatus: prospect.mobileAppStatus || "Unknown",
    hasMobileApp: prospect.hasMobileApp ?? null,
    bookingPlatform: prospect.bookingPlatform || "Unknown",
    rating: Number(prospect.rating || 0),
    reviews: Number(prospect.reviewCount || 0),
    reviewCount: Number(prospect.reviewCount || 0),
    source: "google_places",
    source_url: prospect.googleProfileUrl || prospect.mapsUrl || "",
    lead_score: score,
    lead_label: score >= 80 ? "High Fit" : score >= 65 ? "Medium Fit" : "Needs Review",
    confidence_score: score,
    outreach_ready: false,
    review_status: "new",
    prospect_stage: prospect.prospectStatus || "New Lead",
    stage: prospect.prospectStatus || "New Lead",
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

function augmentCompaniesWithScannerData(companies) {
  return companies.map((company) => {
    const scanState = scanner.getState(company.id);
    const mergedContacts =
      scanState.contacts.length > (company.contacts || []).length ? scanState.contacts : company.contacts || [];
    const primaryContact = company.primary_contact || mergedContacts[0] || null;
    const websiteModel = buildWebsiteModel(company);
    const mobileAppModel = buildMobileAppModel(company);

    return applyProspectWorkflow({
      ...company,
      ...websiteModel,
      ...mobileAppModel,
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

  Object.assign(company, {
    prospect_stage: workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead",
    stage: workflow.prospect_stage || company.stage || company.prospect_stage || "New Lead",
    next_follow_up: workflow.next_follow_up || company.next_follow_up || "",
    next_action: workflow.next_action || lastCommunication?.next_action || "",
    last_contacted_at: workflow.last_contacted_at || lastCommunication?.date || "",
    communication_logs: allCommunicationLogs,
    notes,
    latest_communication_note: lastCommunication?.notes || "",
    is_saved_prospect: Boolean(findSavedProspectId(company)),
    workflow_updated_at: workflow.updated_at || "",
  });

  return company;
}

function getProspectWorkflow(companyId) {
  return state.prospectWorkflows[companyId] || {};
}

function ensureProspectWorkflow(companyId, company) {
  if (!companyId || state.prospectWorkflows[companyId]) {
    return;
  }

  state.prospectWorkflows[companyId] = {
    prospect_stage: company?.prospect_stage || company?.stage || "New Lead",
    communication_logs: [],
    notes: [],
    next_follow_up: company?.next_follow_up || "",
    next_action: company?.next_action || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
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
}

function findSavedProspectId(company) {
  if (!company) {
    return "";
  }

  const companyKeys = getProspectIdentityKeys(company);
  return (
    state.savedCompanies.find((savedId) => {
      if (savedId === company.id) {
        return true;
      }

      const savedCompany = state.companies.find((item) => item.id === savedId);
      if (!savedCompany) {
        return false;
      }

      const savedKeys = getProspectIdentityKeys(savedCompany);
      return companyKeys.some((key) => savedKeys.includes(key));
    }) || ""
  );
}

function getProspectIdentityKeys(company) {
  const keys = [
    company.id,
    company.website,
    company.phone,
    [company.name, company.address].filter(Boolean).join("|"),
    [company.name, company.city, company.state].filter(Boolean).join("|"),
  ];

  return keys
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function getSavedProspectCompanies() {
  return state.companies
    .filter((company) => Boolean(findSavedProspectId(company)))
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

function buildResultsSubtitle() {
  const filters = getActiveFilters();
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
  const derivedStatus = explicitStatus || deriveWebsiteStatus(company);
  const hasWebsite =
    typeof company.hasWebsite === "boolean"
      ? company.hasWebsite
      : typeof company.has_website === "boolean"
        ? company.has_website
        : ["Has Website = Yes", "Weak Website", "Broken Website"].includes(derivedStatus);

  return {
    hasWebsite,
    websiteStatus: derivedStatus,
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
    return "Has Website = Yes";
  }

  if (normalized.includes("no") || normalized === "no website") {
    return "Has Website = No";
  }

  return "";
}

function deriveWebsiteStatus(company) {
  const website = String(company.website || "").trim();

  if (!website) {
    return "Has Website = No";
  }

  const normalizedWebsite = website.toLowerCase();
  if (isSocialUrl(normalizedWebsite)) {
    return "Social Only";
  }

  if (isBookingUrl(normalizedWebsite)) {
    return "Booking Link Only";
  }

  if (String(company.scan_failure_reason || "").toLowerCase() === "blocked") {
    return "Broken Website";
  }

  return "Has Website = Yes";
}

function isSocialUrl(value) {
  return /(facebook\.com|instagram\.com|linktr\.ee|yelp\.com|google\.com\/maps|g\.page)/i.test(value);
}

function isBookingUrl(value) {
  return /(vagaro\.com|booksy\.com|squareup\.com|acuityscheduling\.com|schedulicity\.com|mindbodyonline\.com|fresha\.com|glossgenius\.com|styleseat\.com|setmore\.com|calendly\.com)/i.test(value);
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

  if (bookingPlatform) {
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
    return explicitPlatform;
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
    ["Square Appointments", "squareup"],
    ["Acuity Scheduling", "acuityscheduling"],
    ["Schedulicity", "schedulicity"],
    ["Mindbody", "mindbodyonline"],
    ["Fresha", "fresha"],
    ["GlossGenius", "glossgenius"],
    ["StyleSeat", "styleseat"],
    ["Setmore", "setmore"],
    ["Calendly", "calendly"],
    ["Yelp", "yelp"],
    ["Facebook", "facebook"],
    ["Instagram", "instagram"],
    ["Google Business Profile", "google"],
    ["Thumbtack", "thumbtack"],
  ];

  const match = platforms.find(([, token]) => haystack.includes(token));
  return match ? match[0] : "";
}

function isMarketplacePlatform(platform) {
  return ["Yelp", "Facebook", "Instagram", "Google Business Profile", "Thumbtack"].includes(platform);
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

function compareCompanies(left, right, sortBy) {
  if (sortBy === "name") {
    return String(left.name || "").localeCompare(String(right.name || ""));
  }

  if (sortBy === "recent") {
    return String(right.last_scanned || right.collected_at || "").localeCompare(
      String(left.last_scanned || left.collected_at || "")
    );
  }

  if (sortBy === "confidence") {
    return getCompanyConfidence(right) - getCompanyConfidence(left);
  }

  return (
    getCompanyScore(right) - getCompanyScore(left) ||
    String(left.name || "").localeCompare(String(right.name || ""))
  );
}

function getCompanyScore(company) {
  let score = Number(company.lead_score || 0) * 2 + getCompanyConfidence(company);

  if (company.has_primary_contact) {
    score += 40;
  }

  if (company.contacts_found) {
    score += Math.min(20, company.contacts_found);
  }

  if (company.primary_contact?.decision_maker) {
    score += 30;
  }

  return score;
}

function getCompanyConfidence(company) {
  return Number(company.lead_score || company.primary_contact?.confidence_score || company.confidence_score || 0);
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
  return Array.isArray(parsed) ? parsed : [];
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
