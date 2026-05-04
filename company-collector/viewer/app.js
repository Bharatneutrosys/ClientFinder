import { createScanner, SCAN_STATUS } from "./scanner.js";
import { renderDetailPanel, renderResultsView } from "./ui.js";

const DEFAULT_INDUSTRY = "IT Services & Staffing";
const SAVED_SEARCHES_KEY = "find-any-company.saved-searches";
const SAVED_COMPANIES_KEY = "find-any-company.saved-companies";
const SCAN_QUEUE_KEY = "find-any-company.scan-queue";
const DEFAULT_BATCH_CITIES = [
  { city: "Dallas", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "Houston", state: "TX" },
  { city: "San Antonio", state: "TX" },
  { city: "Fort Worth", state: "TX" },
];

const INDUSTRY_QUERY_MAP = {
  "IT Services & Staffing":
    "IT staffing staffing agency recruiting firm IT consulting technology services talent solutions workforce solutions vendor consulting company",
  Healthcare: "healthcare medical practice clinic provider healthcare services",
  Construction: "construction contractor building services workforce solutions",
  Finance: "finance accounting advisory tax wealth lending services",
  Manufacturing: "manufacturing industrial production plant operations",
  "Retail & eCommerce": "retail ecommerce commerce fulfillment digital commerce",
  "Real Estate": "real estate property development brokerage leasing",
  Education: "education school university training learning services",
  Legal: "legal law firm compliance advisory",
  "Marketing & Advertising": "marketing advertising agency digital media branding",
  "Other Services": "business services professional services local services",
};

const state = {
  companies: [],
  filteredCompanies: [],
  pagedCompanies: [],
  selectedCompanyId: null,
  currentPage: 1,
  pageSize: 20,
  viewMode: "list",
  loading: false,
  sortBy: "best_match",
  activeDetailTab: "overview",
  savedSearches: loadSavedSearches(),
  savedCompanies: loadSavedCompanies(),
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
  pauseQueueButton: document.querySelector("#pause-queue-button"),
  resumeQueueButton: document.querySelector("#resume-queue-button"),
  cancelQueueButton: document.querySelector("#cancel-queue-button"),
};

await initialize();

async function initialize() {
  bindEvents();
  populateStates();
  await loadTargetCities();
  renderSavedSearches();
  await refreshCompanies();
  restoreQueueState();
  applyFilters();
}

function bindEvents() {
  elements.searchButton.addEventListener("click", () => {
    state.currentPage = 1;
    applyFilters();
  });

  elements.collectMoreButton.addEventListener("click", handleCollectMore);
  elements.batchCollectButton.addEventListener("click", handleBatchCollect);
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
    elements.industryFilter,
    elements.stateFilter,
    elements.cityFilter,
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
      applyFilters();
    });
  });

  elements.globalSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.currentPage = 1;
      applyFilters();
    }
  });

  elements.industryNav.forEach((button) => {
    button.addEventListener("click", () => {
      const nextIndustry = button.getAttribute("data-industry-nav") || "";
      elements.industryFilter.value = nextIndustry;
      syncIndustryNav();
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
    state.companies = Array.isArray(payload.companies)
      ? payload.companies.map((company) => ({
          ...company,
          industry: inferCompanyIndustry(company),
          industry_tags: buildIndustryTags(company),
        }))
      : [];

    scanner.applySavedContacts(state.companies, flattenContacts(state.companies));
    state.companies = augmentCompaniesWithScannerData(state.companies);

    if (!state.selectedCompanyId && state.companies[0]) {
      state.selectedCompanyId = state.companies[0].id;
    }

    updateSummary();
  } catch (error) {
    elements.statusMessage.textContent = error.message;
  } finally {
    setLoading(false);
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

      if (filters.hasWebsite && !company.website) {
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
    onOpenDetails: openDetails,
    onScanCompany: handleScanCompany,
    onRetryScan: handleRetryScan,
  });

  renderDetail();
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
    elements.statusMessage.textContent = "Choose both state and city before collecting more companies.";
    return;
  }

  elements.statusMessage.textContent = `Collecting more companies for ${filters.cityLabel}, ${filters.state}...`;
  elements.collectMoreButton.disabled = true;

  try {
    const payload = await collectCompaniesForLocation({
      keyword: buildIndustryQuery(filters.industry, filters.keywordLabel || DEFAULT_INDUSTRY),
      city: filters.cityLabel,
      state: filters.state,
      source: mapCollectorSource(filters.source),
    });

    await refreshCompanies();
    applyFilters();
    elements.statusMessage.textContent = `Collected more companies. Total saved: ${payload.stats?.totalCompanies || state.companies.length}.`;
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
        keyword: buildIndustryQuery(filters.industry, filters.keywordLabel || DEFAULT_INDUSTRY),
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
  const label = `${filters.industry || "All Industries"} - ${filters.cityLabel || "All cities"}${filters.state ? `, ${filters.state}` : ""}`;
  const entry = {
    id: `search-${Date.now()}`,
    label,
    filters: {
      globalSearch: filters.keywordLabel || "",
      industry: filters.industry || "",
      city: filters.cityLabel || "",
      state: filters.state || "",
      source: filters.source || "",
    },
  };

  state.savedSearches = [entry, ...state.savedSearches].slice(0, 8);
  persistSavedSearches();
  renderSavedSearches();
  elements.statusMessage.textContent = `Saved search for ${label}.`;
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
    elements.statusMessage.textContent = "No visible companies with websites to scan.";
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

  elements.statusMessage.textContent = `Queued ${queue.length} visible companies for scanning.`;
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

  if (state.savedCompanies.includes(companyId)) {
    state.savedCompanies = state.savedCompanies.filter((id) => id !== companyId);
    elements.statusMessage.textContent = "Company removed from saved.";
  } else {
    state.savedCompanies = [...state.savedCompanies, companyId];
    elements.statusMessage.textContent = "Company saved.";
  }

  persistSavedCompanies();
  renderDetail();
}

function updateSummary() {
  const totalContacts = state.companies.reduce(
    (count, company) => count + (company.contacts || []).length,
    0
  );
  const guessedEmails = state.companies.reduce(
    (count, company) => count + company.contacts.filter((contact) => contact.email_status === "guessed").length,
    0
  );
  const linkedInDecisionMakers = state.companies.reduce(
    (count, company) =>
      count +
      company.contacts.filter((contact) => Boolean(contact.linkedin_url) && Boolean(contact.decision_maker)).length,
    0
  );

  elements.totalCompanies.textContent = String(state.companies.length);
  elements.companiesScanned.textContent = String(totalContacts);
  elements.primaryContacts.textContent = String(
    state.companies.filter((company) => company.lead_label === "High Fit").length
  );
  elements.verifiedEmails.textContent = String(
    state.companies.filter((company) => company.outreach_ready).length
  );
  elements.highConfidenceCount.textContent = String(
    state.companies.filter((company) => company.review_status === "approved").length
  );
  elements.needsReview.textContent = String(
    state.companies.filter((company) => company.needs_review || company.lead_label === "Needs Review").length
  );
  elements.guessedEmails.textContent = String(guessedEmails);
  elements.linkedInDecisionMakers.textContent = String(linkedInDecisionMakers);
  elements.failedScans.textContent = String(
    state.companies.filter((company) => company.scan_status === SCAN_STATUS.FAILED).length
  );
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

      elements.globalSearch.value = saved.filters.globalSearch;
      elements.industryFilter.value = saved.filters.industry || "";
      elements.cityFilter.value = saved.filters.city;
      elements.stateFilter.value = saved.filters.state;
      elements.sourceFilter.value = saved.filters.source;
      elements.leadScoreFilter.value = saved.filters.leadScore || "";
      elements.reviewStatusFilter.value = saved.filters.reviewStatus || "";
      elements.contactTypeFilter.value = saved.filters.contactType || "";
      state.currentPage = 1;
      applyFilters();
      elements.statusMessage.textContent = `Loaded saved search for ${saved.label}.`;
    });
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
    "phone",
    "source",
    "lead_score",
    "lead_label",
    "outreach_ready",
    "review_status",
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
  return {
    state: elements.stateFilter.value,
    city: String(elements.cityFilter.value || "").trim().toLowerCase(),
    cityLabel: String(elements.cityFilter.value || "").trim(),
    keyword: String(elements.globalSearch.value || "").trim().toLowerCase(),
    keywordLabel: String(elements.globalSearch.value || "").trim(),
    industry: elements.industryFilter.value || "",
    source: elements.sourceFilter.value,
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

function augmentCompaniesWithScannerData(companies) {
  return companies.map((company) => {
    const scanState = scanner.getState(company.id);
    const mergedContacts =
      scanState.contacts.length > (company.contacts || []).length ? scanState.contacts : company.contacts || [];
    const primaryContact = company.primary_contact || mergedContacts[0] || null;

    return {
      ...company,
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
    };
  });
}

function buildResultsSubtitle() {
  const filters = getActiveFilters();
  const parts = [
    filters.industry || "All Industries",
    filters.cityLabel || "All cities",
    filters.state || "All states",
  ];

  return `${state.filteredCompanies.length} matches - ${parts.join(" - ")}`;
}

function buildIndustryQuery(industry, keywordLabel) {
  const normalizedIndustry = industry || "";
  const industryQuery = normalizedIndustry ? INDUSTRY_QUERY_MAP[normalizedIndustry] || normalizedIndustry : "";
  return [keywordLabel, industryQuery].filter(Boolean).join(" ").trim();
}

function mapCollectorSource(source) {
  const normalizedSource = String(source || "").trim().toLowerCase();

  if (normalizedSource === "google_places") {
    return "google";
  }

  if (normalizedSource === "serp_api") {
    return "serp";
  }

  return normalizedSource;
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

  const match = Object.keys(INDUSTRY_QUERY_MAP).find((industry) => {
    if (industry === DEFAULT_INDUSTRY) {
      return /(staffing|recruiting|talent|consulting|technology|it services|workforce)/i.test(haystack);
    }

    return haystack.includes(industry.toLowerCase().split(" ")[0]);
  });

  return match || DEFAULT_INDUSTRY;
}

function buildIndustryTags(company) {
  const industry = inferCompanyIndustry(company);
  const tags = [industry];

  if (industry === DEFAULT_INDUSTRY) {
    tags.push("Talent Solutions", "Vendor Search");
  }

  return tags;
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
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistSavedSearches() {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(state.savedSearches));
}

function loadSavedCompanies() {
  try {
    const raw = localStorage.getItem(SAVED_COMPANIES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistSavedCompanies() {
  localStorage.setItem(SAVED_COMPANIES_KEY, JSON.stringify(state.savedCompanies));
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
