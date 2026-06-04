import { createScanner, SCAN_STATUS } from "./scanner.js";
import {
  BUSINESS_TYPE_GROUPS,
  DEFAULT_SEARCH_MODE,
  QUICK_PRESETS,
  SEARCH_MODES,
  getBusinessTypePreset,
  getDefaultFiltersForBusinessType,
  getSearchMode,
} from "./searchConfig.js";
import { storageService } from "./storageService.js";
import { renderDetailPanel, renderResultsView } from "./ui.js";

const DEFAULT_INDUSTRY = "Beauty & Wellness";
const DEFAULT_SEARCH_KEYWORD = "Salon";
const DEFAULT_STATE = "TX";
const DEFAULT_CITY = "Farmers Branch";
const DEFAULT_WEBSITE_CONDITION = "no_website";
const DEFAULT_DISCOVERY_PROMPT = "Enter a business type and location to find prospects.";
const SAVED_SEARCHES_KEY = "find-any-company.saved-searches";
const SAVED_COMPANIES_KEY = "find-any-company.saved-companies";
const SAVED_LISTS_KEY = "find-any-company.saved-lists";
const PROSPECT_WORKFLOWS_KEY = "find-any-company.prospect-workflows";
const CLIENTS_KEY = "find-any-company.clients";
const MANUAL_PROSPECTS_KEY = "find-any-company.manual-prospects";
const HIDDEN_PROSPECTS_KEY = "find-any-company.hidden-prospects";
const SENDER_PROFILE_KEY = "find-any-company.sender-profile";
const SCAN_QUEUE_KEY = "find-any-company.scan-queue";
const STORAGE_MODE_KEY = "CLIENT_FINDER_STORAGE_MODE";
const BACKUP_SCHEMA_VERSION = "1.0";
const CLIENT_FINDER_LOCAL_KEYS = [
  SAVED_SEARCHES_KEY,
  SAVED_COMPANIES_KEY,
  SAVED_LISTS_KEY,
  PROSPECT_WORKFLOWS_KEY,
  CLIENTS_KEY,
  MANUAL_PROSPECTS_KEY,
  HIDDEN_PROSPECTS_KEY,
  SENDER_PROFILE_KEY,
  SCAN_QUEUE_KEY,
  STORAGE_MODE_KEY,
];
const DEFAULT_BATCH_CITIES = [
  { city: "Dallas", state: "TX" },
  { city: "Austin", state: "TX" },
  { city: "Houston", state: "TX" },
  { city: "San Antonio", state: "TX" },
  { city: "Fort Worth", state: "TX" },
];

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
  "Client Converted",
  "Client Onboarding",
  "Lost",
  "Archived",
];
const PIPELINE_STAGE_GROUPS = [
  { label: "New / Saved", stages: ["New Lead", "Saved"] },
  { label: "Contacted", stages: ["Outreach Started"] },
  { label: "Follow-Up Needed", matcher: (company) => ["overdue", "due_today"].includes(getFollowUpState(company.next_follow_up)) },
  { label: "Responded", stages: ["Engaged"] },
  { label: "Meeting Scheduled", stages: ["Meeting Done"] },
  { label: "Requirements Received", stages: ["Requirements Discussed"] },
  { label: "Quote Drafting", stages: ["Quote Requested", "Negotiation"] },
  { label: "Quote Sent", stages: ["Quote Sent"] },
  { label: "Quote Accepted", matcher: (company) => String(company.quote_status || "") === "Accepted" },
  { label: "Contract Expected", stages: ["Contract Expected", "Contract Received"] },
  { label: "Client Converted", stages: ["Client Converted", "Client Onboarding"] },
  { label: "Lost / Not Interested", stages: ["Lost", "Archived"] },
  { label: "Follow Up Later", matcher: (company) => getFollowUpState(company.next_follow_up) === "upcoming" },
];
const QUOTE_STATUSES = ["Not Started", "Quote Requested", "Drafting", "Sent", "Under Review", "Accepted", "Rejected"];
const CLIENT_PROJECT_STATUSES = [
  "Client Onboarding",
  "Discovery",
  "Content Collection",
  "Design",
  "Development",
  "Client Review",
  "Revision",
  "Final Approval",
  "Go Live",
  "Handover",
  "Maintenance",
  "Completed",
  "Paused",
  "Blocked",
];
const CLIENT_TABS = ["overview", "project", "onboarding", "documents", "payments", "credentials", "handover", "support"];
const HANDOVER_STATUSES = [
  "Not Started",
  "Preparing",
  "Ready for Client",
  "Sent to Client",
  "Client Trained",
  "Completed",
  "Support Started",
  "Blocked",
];
const DOCUMENT_CATEGORIES = [
  "Contract",
  "Quote",
  "Invoice",
  "Payment Receipt",
  "Logo / Brand Assets",
  "Business Photos",
  "Service List",
  "Pricing / Packages",
  "Website Content",
  "Approval",
  "Handover",
  "Maintenance / Support",
  "Other",
];
const DOCUMENT_STATUSES = ["Needed", "Requested", "Received", "Approved", "Sent to Client", "Missing", "Not Required"];
const DOCUMENT_STORAGE_LOCATIONS = [
  "Local computer",
  "Google Drive",
  "Email",
  "WhatsApp",
  "Client provided link",
  "Vercel/GitHub",
  "Other",
];
const PAYMENT_STATUSES = ["Not Started", "Advance Pending", "Partially Paid", "Paid in Full", "Overdue", "Refunded", "Cancelled"];
const PAYMENT_METHODS = ["Cash", "Check", "Zelle", "Bank Transfer", "Credit/Debit Card", "PayPal", "Venmo", "Cash App", "Other"];
const PAYMENT_TYPES = ["Advance", "Milestone", "Final Balance", "Maintenance", "Refund", "Other"];
const PAYMENT_RECORD_STATUSES = ["Expected", "Received", "Pending", "Failed", "Refunded", "Cancelled"];
const PAYMENT_STORAGE_LOCATIONS = ["Local computer", "Google Drive", "Email", "WhatsApp", "Client provided", "Other"];
const ACCESS_CATEGORIES = [
  "Domain Registrar",
  "Hosting",
  "Existing Website / CMS",
  "Website Admin",
  "Google Business Profile",
  "Google Analytics",
  "Google Search Console",
  "Social Media",
  "Booking Platform",
  "Email Account",
  "Payment / Checkout Provider",
  "GitHub / Code Repository",
  "Vercel / Hosting Deployment",
  "Other",
];
const ACCESS_STATUSES = ["Needed", "Requested", "Received", "Verified", "Not Required", "Blocked", "Revoked"];
const ACCESS_PERMISSION_LEVELS = ["Owner", "Admin", "Editor", "Viewer", "Limited", "Unknown"];
const ACCESS_STORAGE_REFERENCES = [
  "1Password",
  "Google Password Manager",
  "Client secure link",
  "Email thread",
  "WhatsApp message",
  "Not stored",
  "Other",
];
const SUPPORT_STATUSES = ["Not Started", "Active", "Paused", "Renewal Due", "Cancelled", "Completed", "No Support Plan"];
const MAINTENANCE_PLANS = ["None", "Basic", "Standard", "Premium", "Custom"];
const SUPPORT_REQUEST_TYPES = [
  "Content Update",
  "Design Change",
  "Bug Fix",
  "Hosting / Domain",
  "Booking / Form Issue",
  "SEO / Analytics",
  "Training / How-To",
  "New Feature",
  "Other",
];
const SUPPORT_PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const SUPPORT_REQUEST_STATUSES = ["New", "In Progress", "Waiting on Client", "Completed", "Cancelled"];
const REQUIRED_ACCESS_ITEMS = [
  ["domainAccess", "Domain access"],
  ["hostingAccess", "Hosting access"],
  ["websiteAdminAccess", "Website admin access"],
  ["googleBusinessProfileAccess", "Google Business Profile access"],
  ["socialMediaAccess", "Social media links/access"],
  ["bookingPlatformAccess", "Booking platform access"],
  ["analyticsSearchConsoleAccess", "Analytics/Search Console access"],
  ["deploymentAccess", "Deployment access if applicable"],
];
const REQUIRED_DOCUMENT_ITEMS = [
  ["signedContract", "Signed contract"],
  ["finalQuote", "Final quote"],
  ["paymentReceipt", "Payment receipt"],
  ["logoBrandAssets", "Logo/brand assets"],
  ["serviceList", "Service list"],
  ["pricingPackages", "Pricing/packages"],
  ["businessPhotos", "Business photos/gallery"],
  ["websiteContent", "Website content"],
  ["finalApproval", "Final approval"],
  ["handoverNotes", "Handover notes"],
  ["maintenanceAgreement", "Maintenance/support agreement if applicable"],
];
const PROJECT_PHASES = [
  {
    key: "discovery",
    title: "Discovery",
    status: "Discovery",
    items: [
      ["kickoffCompleted", "Kickoff completed", true],
      ["businessGoalsConfirmed", "Business goals confirmed"],
      ["targetAudienceConfirmed", "Target audience confirmed"],
      ["referenceSitesReviewed", "Competitor/reference sites reviewed"],
      ["sitemapConfirmed", "Sitemap/pages confirmed"],
    ],
  },
  {
    key: "contentCollection",
    title: "Content Collection",
    status: "Content Collection",
    items: [
      ["logoReceived", "Logo received"],
      ["servicesContentReceived", "Services content received"],
      ["pricingReceived", "Pricing/packages received"],
      ["photosReceived", "Photos/gallery received"],
      ["testimonialsReceived", "Testimonials received"],
      ["contactDetailsConfirmed", "Business hours/contact details confirmed"],
    ],
  },
  {
    key: "design",
    title: "Design",
    status: "Design",
    items: [
      ["homepageStarted", "Homepage design started"],
      ["homepageCompleted", "Homepage design completed"],
      ["servicesDesignCompleted", "Services page design completed"],
      ["mobileLayoutReviewed", "Mobile layout reviewed"],
      ["designSent", "Design sent to client", true],
      ["designApproved", "Design approved", true],
    ],
  },
  {
    key: "development",
    title: "Development",
    status: "Development",
    items: [
      ["projectSetupCompleted", "Project setup completed"],
      ["pagesBuilt", "Pages built"],
      ["contactFormConfigured", "Contact form configured"],
      ["bookingFlowConfigured", "Booking/contact flow configured"],
      ["seoBasicsAdded", "SEO basics added"],
      ["mobileChecked", "Mobile responsiveness checked"],
      ["qaCompleted", "Performance/basic QA completed"],
    ],
  },
  {
    key: "clientReview",
    title: "Client Review",
    status: "Client Review",
    items: [
      ["reviewLinkShared", "Review link shared", true],
      ["feedbackReceived", "Client feedback received"],
      ["revisionsLogged", "Revisions logged"],
      ["revisionsCompleted", "Revisions completed"],
    ],
  },
  {
    key: "launch",
    title: "Launch",
    status: "Go Live",
    items: [
      ["domainHostingConfirmed", "Domain/hosting confirmed"],
      ["finalApprovalReceived", "Final approval received", true, "Final Approval"],
      ["websiteDeployed", "Website deployed", true, "Go Live"],
      ["sslVerified", "SSL/live URL verified"],
      ["googleProfileUpdated", "Google Business/Profile link updated if applicable"],
    ],
  },
  {
    key: "handover",
    title: "Handover",
    status: "Handover",
    items: [
      ["adminShared", "Admin/login shared if applicable"],
      ["trainingCompleted", "Client training completed"],
      ["resourcesShared", "Final files/resources shared"],
      ["supportTermsConfirmed", "Support/maintenance terms confirmed"],
      ["handoverCompleted", "Handover completed", true, "Completed"],
    ],
  },
];
const HANDOVER_CHECKLIST_GROUPS = [
  {
    key: "launchVerification",
    title: "Launch Verification",
    items: [
      ["liveUrlVerified", "Live URL verified", true],
      ["sslVerified", "SSL/HTTPS verified", true],
      ["mobileLoads", "Website loads on mobile"],
      ["desktopLoads", "Website loads on desktop"],
      ["contactFormTested", "Contact form tested", true],
      ["bookingFlowTested", "Booking/contact flow tested"],
      ["seoChecked", "Basic SEO title/description checked"],
      ["googleProfileChecked", "Google Business/Profile link checked if applicable"],
    ],
  },
  {
    key: "clientAccess",
    title: "Client Access",
    items: [
      ["adminUrlPrepared", "Admin URL prepared"],
      ["clientLoginCreated", "Client login created if applicable"],
      ["accessSharedSecurely", "Login/access shared securely", true],
      ["passwordNotStored", "Password not stored in plain text"],
      ["clientAccessConfirmed", "Client confirmed access works"],
    ],
  },
  {
    key: "training",
    title: "Training",
    items: [
      ["walkthroughCompleted", "Client walkthrough completed"],
      ["adminTrainingCompleted", "Admin/content update training completed"],
      ["maintenanceInstructionsShared", "Basic maintenance instructions shared"],
      ["supportProcessExplained", "Support process explained"],
    ],
  },
  {
    key: "finalDeliverables",
    title: "Final Deliverables",
    items: [
      ["finalUrlShared", "Final website URL shared"],
      ["scopeReviewed", "Final scope reviewed"],
      ["finalChangesCompleted", "Final changes completed"],
      ["clientApprovalReceived", "Client approval received", true],
      ["invoicePaymentConfirmed", "Final invoice/payment status confirmed", true],
      ["supportPlanConfirmed", "Maintenance/support plan confirmed", true],
    ],
  },
  {
    key: "closure",
    title: "Closure",
    items: [
      ["handoverCompleted", "Handover completed", true],
      ["projectMarkedCompleted", "Project marked completed"],
      ["supportPeriodStarted", "Support period started", true],
      ["internalNotesUpdated", "Internal notes updated"],
    ],
  },
];
const ONBOARDING_CHECKLIST_GROUPS = [
  {
    key: "businessInformation",
    title: "Business Information",
    items: [
      ["businessName", "Confirm business legal/display name"],
      ["ownerContact", "Confirm owner/manager contact", true],
      ["phone", "Confirm phone number"],
      ["email", "Confirm email"],
      ["address", "Confirm address"],
      ["businessHours", "Confirm business hours", true],
      ["serviceArea", "Confirm service area"],
    ],
  },
  {
    key: "brandContent",
    title: "Brand & Content",
    items: [
      ["logo", "Collect logo"],
      ["brandColors", "Collect brand colors"],
      ["serviceList", "Collect service list", true],
      ["pricingPackages", "Collect pricing/packages"],
      ["businessPhotos", "Collect business photos"],
      ["gallerySamples", "Collect gallery/work samples"],
      ["testimonials", "Collect testimonials/reviews"],
      ["aboutStory", "Collect about/business story"],
    ],
  },
  {
    key: "digitalAccess",
    title: "Digital Access",
    items: [
      ["domainAccess", "Domain access received"],
      ["hostingAccess", "Hosting access received"],
      ["websiteAccess", "Existing website access received"],
      ["googleBusinessProfile", "Google Business Profile access discussed"],
      ["socialLinks", "Social media links collected"],
      ["bookingPlatform", "Booking platform link/access collected"],
    ],
  },
  {
    key: "projectSetup",
    title: "Project Setup",
    items: [
      ["scopeConfirmed", "Project scope confirmed", true],
      ["quoteConfirmed", "Quote/price confirmed"],
      ["timelineConfirmed", "Timeline confirmed"],
      ["paymentTermsConfirmed", "Payment terms confirmed", true],
      ["advancePaymentConfirmed", "Advance payment confirmed", true],
      ["contractReceived", "Contract received", true],
      ["kickoffCompleted", "Kickoff completed"],
    ],
  },
  {
    key: "approvals",
    title: "Approvals",
    items: [
      ["homepageApproved", "Homepage direction approved"],
      ["servicesContentApproved", "Services/content approved"],
      ["galleryApproved", "Gallery/images approved"],
      ["contactFlowApproved", "Contact/booking flow approved"],
      ["launchApprovalPending", "Final launch approval pending"],
    ],
  },
];

const state = {
  companies: [],
  filteredCompanies: [],
  pagedCompanies: [],
  selectedCompanyId: null,
  currentPage: 1,
  pageSize: 20,
  viewMode: "list",
  activeView: "dashboard",
  loading: false,
  searchStarted: false,
  sortBy: "best_match",
  activeDetailTab: "overview",
  selectedClientId: null,
  activeClientTab: "overview",
  savedSearches: loadSavedSearches(),
  savedLists: loadSavedLists(),
  selectedListId: "",
  pipelineFilters: {},
  pendingBackup: null,
  savedCompanies: loadSavedCompanies(),
  clients: getClients(),
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
let clientSyncSnapshot = new Map();

const elements = {
  searchModeFilter: document.querySelector("#search-mode-filter"),
  globalSearch: document.querySelector("#global-search"),
  industryFilter: document.querySelector("#industry-filter"),
  stateFilter: document.querySelector("#state-filter"),
  stateOptions: document.querySelector("#state-options"),
  cityFilter: document.querySelector("#city-filter"),
  websiteConditionFilter: document.querySelector("#website-condition-filter"),
  mobileAppConditionFilter: document.querySelector("#mobile-app-condition-filter"),
  bookingSystemConditionFilter: document.querySelector("#booking-system-condition-filter"),
  onlinePaymentConditionFilter: document.querySelector("#online-payment-condition-filter"),
  socialPresenceConditionFilter: document.querySelector("#social-presence-condition-filter"),
  phoneAvailableFilter: document.querySelector("#phone-available-filter"),
  keywordFilter: document.querySelector("#keyword-filter"),
  radiusFilter: document.querySelector("#radius-filter"),
  minimumRatingFilter: document.querySelector("#minimum-rating-filter"),
  minimumReviewCountFilter: document.querySelector("#minimum-review-count-filter"),
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
  exportSavedProspectsButton: document.querySelector("#export-saved-prospects-button"),
  exportSelectedListButton: document.querySelector("#export-selected-list-button"),
  exportClientsButton: document.querySelector("#export-clients-button"),
  exportFollowupsButton: document.querySelector("#export-followups-button"),
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
  presetRow: document.querySelector("#preset-row"),
  storageStatus: document.querySelector("#storage-status"),
  topbar: document.querySelector(".topbar"),
  followupsPanel: document.querySelector(".followups-panel"),
  queueActions: document.querySelector(".queue-actions"),
  resultsToolbarRight: document.querySelector(".results-toolbar-right"),
  syncSavedProspectsButton: document.querySelector("#sync-saved-prospects-button"),
  syncClientsButton: document.querySelector("#sync-clients-button"),
  savedSearchCount: document.querySelector("#saved-search-count"),
  industryNav: [...document.querySelectorAll("[data-industry-nav]")],
  presetButtons: [...document.querySelectorAll("[data-search-preset]")],
  pauseQueueButton: document.querySelector("#pause-queue-button"),
  resumeQueueButton: document.querySelector("#resume-queue-button"),
  cancelQueueButton: document.querySelector("#cancel-queue-button"),
  appViewButtons: [...document.querySelectorAll("[data-app-view]")],
};

try {
  await initialize();
} catch (error) {
  console.error("Client Finder failed to initialize.", error);
  showAppError("Client Finder could not finish loading. Navigation is still available; try refreshing after checking the console.");
}

async function initialize() {
  populateSearchModes();
  populateBusinessTypeGroups();
  applySafeSearchDefaults();
  renderPresetChips();
  populateSavedWorkqueueFilters();
  populateStates();
  bindEvents();
  await loadTargetCities();
  await hydrateSavedProspectsFromStorage();
  await hydrateClientsFromStorage();
  resetClientSyncSnapshot();
  renderSavedSearches();
  restoreQueueState();
  applyFilters();
}

function bindEvents() {
  elements.searchButton?.addEventListener("click", handleSearch);

  elements.collectMoreButton?.addEventListener("click", handleCollectMore);
  elements.batchCollectButton?.addEventListener("click", handleBatchCollect);
  elements.addTestProspectButton?.addEventListener("click", addTestProspect);
  elements.emptyAddTestProspectButton?.addEventListener("click", addTestProspect);
  elements.saveSearchButton?.addEventListener("click", handleSaveSearch);
  elements.filtersButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFiltersMenu();
  });
  elements.exportsButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleExportsMenu();
  });

  elements.pageSizeSelect?.addEventListener("change", () => {
    state.pageSize = Number(elements.pageSizeSelect.value || 20);
    state.currentPage = 1;
    paginate();
    render();
  });

  elements.sortBySelect?.addEventListener("change", () => {
    state.sortBy = elements.sortBySelect.value || "best_match";
    state.currentPage = 1;
    applyFilters();
  });

  elements.listViewButton?.addEventListener("click", () => setViewMode("list"));
  elements.gridViewButton?.addEventListener("click", () => setViewMode("grid"));
  elements.scanVisibleButton?.addEventListener("click", handleScanAllVisible);
  elements.pauseQueueButton?.addEventListener("click", pauseScanQueue);
  elements.resumeQueueButton?.addEventListener("click", resumeScanQueue);
  elements.cancelQueueButton?.addEventListener("click", cancelScanQueue);
  elements.exportVisibleButton?.addEventListener("click", () =>
    exportProspectsToCsv(state.filteredCompanies, `client-finder-search-results-${getTodayDateKey()}.csv`)
  );
  elements.exportSavedProspectsButton?.addEventListener("click", () =>
    exportProspectsToCsv(getSavedProspectCompanies(), `client-finder-saved-prospects-${getTodayDateKey()}.csv`)
  );
  elements.exportSelectedListButton?.addEventListener("click", exportSelectedListCsv);
  elements.exportClientsButton?.addEventListener("click", () =>
    exportClientsToCsv(state.clients, `client-finder-clients-${getTodayDateKey()}.csv`)
  );
  elements.exportFollowupsButton?.addEventListener("click", () =>
    exportProspectsToCsv(getFollowUpDueProspects(), `client-finder-follow-ups-due-${getTodayDateKey()}.csv`)
  );
  elements.exportCompaniesButton?.addEventListener("click", () => downloadFile("/api/exports/companies.csv"));
  elements.exportHighFitButton?.addEventListener("click", () =>
    exportProspectsToCsv(
      getSavedProspectCompanies().filter((company) => ["Best Prospect", "Strong Prospect"].includes(company.opportunityPriority || company.lead_label)),
      `client-finder-high-priority-prospects-${getTodayDateKey()}.csv`
    )
  );
  elements.exportContactsButton?.addEventListener("click", () => downloadFile("/api/exports/contacts.csv"));
  elements.exportOutreachButton?.addEventListener("click", () =>
    downloadFile("/api/exports/outreach-ready-contacts.csv")
  );
  elements.exportPhoneOnlyButton?.addEventListener("click", () =>
    downloadFile("/api/exports/phone-only-leads.csv")
  );
  elements.exportNoEmailButton?.addEventListener("click", () =>
    downloadFile("/api/exports/no-email-leads.csv")
  );
  elements.exportPrimaryButton?.addEventListener("click", () =>
    downloadFile("/api/exports/primary-contacts.csv")
  );
  elements.exportVerifiedButton?.addEventListener("click", () =>
    downloadFile("/api/exports/verified-decision-makers.csv")
  );
  elements.exportGuessedButton?.addEventListener("click", () =>
    downloadFile("/api/exports/guessed-decision-makers.csv")
  );
  elements.exportLinkedInButton?.addEventListener("click", () =>
    downloadFile("/api/exports/linkedin-decision-makers.csv")
  );
  elements.syncSavedProspectsButton?.addEventListener("click", syncLocalSavedProspectsToSupabase);
  elements.syncClientsButton?.addEventListener("click", syncLocalClientsToSupabase);
  elements.prevPageButton?.addEventListener("click", () => changePage(-1));
  elements.nextPageButton?.addEventListener("click", () => changePage(1));
  elements.closeDetailButton?.addEventListener("click", closeDetails);
  elements.detailModal?.addEventListener("click", (event) => {
    if (event.target.hasAttribute("data-close-detail")) {
      closeDetails();
    }
  });

  [
    elements.searchModeFilter,
    elements.globalSearch,
    elements.stateFilter,
    elements.cityFilter,
    elements.websiteConditionFilter,
    elements.mobileAppConditionFilter,
    elements.bookingSystemConditionFilter,
    elements.onlinePaymentConditionFilter,
    elements.socialPresenceConditionFilter,
    elements.phoneAvailableFilter,
    elements.keywordFilter,
    elements.radiusFilter,
    elements.minimumRatingFilter,
    elements.minimumReviewCountFilter,
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

  elements.keywordFilter?.addEventListener("input", () => {
    state.currentPage = 1;
    applyFilters();
  });

  elements.industryFilter?.addEventListener("change", () => {
    populateBusinessTypes(elements.industryFilter.value, getDefaultBusinessType(elements.industryFilter.value));
    state.currentPage = 1;
    syncPresetChips();
    applyFilters();
  });

  elements.globalSearch?.addEventListener("keydown", (event) => {
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

  elements.presetRow?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-preset]");
    if (!button) {
      return;
    }

    setBusinessTypeSelection(
      button.getAttribute("data-business-group") || DEFAULT_INDUSTRY,
      button.getAttribute("data-business-type") || DEFAULT_SEARCH_KEYWORD,
      { applyDefaults: true }
    );
    state.currentPage = 1;
    applyFilters();
  });

  elements.appViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.getAttribute("data-app-view") || "discovery";
      state.selectedClientId = null;
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
  state.searchStarted = true;
  const searchLabel = formatSearchLabel(filters);

  if (!isSearchLocationValid(filters.cityLabel) || !filters.state) {
    applyFilters();
    elements.statusMessage.textContent = "Please enter a city or location before searching.";
    return;
  }

  setLoading(true);
  elements.statusMessage.textContent = `Searching: ${searchLabel}`;
  elements.searchButton.disabled = true;
  if (elements.collectMoreButton) {
    elements.collectMoreButton.disabled = true;
  }

  try {
    const payload = await searchLiveProspects({
      businessType: buildSearchKeyword(filters),
      location: filters.cityLabel,
      state: filters.state,
      websiteCondition: filters.websiteCondition,
    });

    state.companies = augmentCompaniesWithScannerData(
      mergeManualProspects(
        payload.prospects.map((prospect) => mapLiveProspectToCompany(prospect, filters)),
        state.manualProspects
      )
    );
    applyFilters();
    elements.statusMessage.textContent =
      state.filteredCompanies.length > 0
        ? `Showing results for ${searchLabel}`
        : `No results found for ${searchLabel}. Try a broader business type, larger radius, or Website Condition = Any.`;
  } catch (error) {
    elements.statusMessage.textContent = formatFriendlyError(error);
  } finally {
    setLoading(false);
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

function isSearchLocationValid(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !["city", "location", "undefined", "null"].includes(normalized);
}

function formatSearchLabel(filters) {
  const businessType = filters.customKeyword || filters.keywordLabel || DEFAULT_SEARCH_KEYWORD;
  const city = isSearchLocationValid(filters.cityLabel) ? filters.cityLabel : DEFAULT_CITY;
  const stateCode = String(filters.state || DEFAULT_STATE).trim().toUpperCase();
  return `${businessType} in ${city}, ${stateCode}`;
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
      const contacts = Array.isArray(company?.contacts) ? company.contacts : [];

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

      if (
        state.activeView === "discovery" &&
        !matchesBookingSystemCondition(company, filters.bookingSystemCondition)
      ) {
        return false;
      }

      if (
        state.activeView === "discovery" &&
        !matchesOnlinePaymentCondition(company, filters.onlinePaymentCondition)
      ) {
        return false;
      }

      if (
        state.activeView === "discovery" &&
        !matchesSocialPresenceCondition(company, filters.socialPresenceCondition)
      ) {
        return false;
      }

      if (state.activeView === "discovery" && !matchesPhoneAvailable(company, filters.phoneAvailable)) {
        return false;
      }

      if (state.activeView === "discovery" && filters.minimumRating > 0 && Number(company.rating || 0) < filters.minimumRating) {
        return false;
      }

      if (
        state.activeView === "discovery" &&
        filters.minimumReviewCount > 0 &&
        Number(company.reviewCount || company.reviews || 0) < filters.minimumReviewCount
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

      if (filters.source && !matchesSource(company, filters.source)) {
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
        !contacts.some((contact) => contact.contact_type === filters.contactType)
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
        !contacts.some((contact) => Number(contact.confidence_score || 0) >= 85)
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
        !contacts.some((contact) => contact.email_status === "verified")
      ) {
        return false;
      }

      if (
        filters.guessedEmails &&
        !contacts.some((contact) => contact.email_status === "guessed")
      ) {
        return false;
      }

      if (
        filters.linkedInFound &&
        !contacts.some((contact) => Boolean(contact.linkedin_url))
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
  try {
    renderUnsafe();
  } catch (error) {
    console.error(`Client Finder render failed for ${state.activeView}.`, error);
    showSectionError(`${formatViewLabel(state.activeView)} could not be displayed right now. Use the navigation to continue.`);
  }
}

function renderUnsafe() {
  const isDashboardView = state.activeView === "dashboard";
  const isSavedView = state.activeView === "saved";
  const isPipelineView = state.activeView === "pipeline";
  const isClientsView = state.activeView === "clients";
  const isListsView = state.activeView === "lists";
  const isFollowupsView = state.activeView === "followups";
  const isSettingsView = state.activeView === "settings";
  const visibleCount = isDashboardView
    ? getTodaysActions().length
    : isPipelineView
      ? getFilteredPipelineProspects().length
      : isClientsView
        ? state.clients.length
        : isListsView
          ? state.savedLists.length
          : isFollowupsView
            ? getActionCenterItems().length
            : isSettingsView
              ? 1
              : state.filteredCompanies.length;
  elements.resultCount.textContent = String(visibleCount);
  elements.resultsSubtitle.textContent = buildResultsSubtitle();
  elements.resultsTitle.textContent = isDashboardView
    ? "Dashboard"
    : isPipelineView
      ? "Pipeline"
      : isClientsView
        ? "Clients"
        : isListsView
          ? "Saved Lists"
          : isFollowupsView
            ? "Action Center"
            : isSettingsView
              ? "Settings"
              : isSavedView
                ? "Saved Prospects"
                : "Search Results";
  elements.workflowDashboard.classList.toggle("hidden", !isSavedView);
  elements.savedWorkqueueFilters?.classList.toggle("hidden", !isSavedView);
  elements.topbar?.classList.toggle("hidden", state.activeView !== "discovery");
  elements.followupsPanel?.classList.add("hidden");
  elements.batchProgress?.classList.toggle("hidden", !state.batchCollect.running);
  elements.bulkProgress?.classList.toggle("hidden", !state.bulkScan.running && !state.bulkScan.paused);
  elements.queueActions?.classList.toggle("hidden", !state.bulkScan.running && !state.bulkScan.paused);
  elements.statusMessage?.classList.toggle(
    "hidden",
    state.activeView !== "discovery"
  );
  elements.scanVisibleButton?.classList.toggle("hidden", !state.bulkScan.running && state.activeView !== "saved");
  elements.resultsToolbarRight?.classList.toggle("hidden", !(state.activeView === "discovery" || state.activeView === "saved"));
  renderEmptyState();
  elements.emptyState.classList.toggle(
    "hidden",
    isDashboardView ||
      isPipelineView ||
      isFollowupsView ||
      isListsView ||
      isSettingsView ||
      (state.activeView === "discovery" && !state.searchStarted) ||
      visibleCount > 0 ||
      state.loading
  );
  elements.resultsContainer.classList.toggle(
    "hidden",
    !(isDashboardView || isPipelineView || isFollowupsView || isListsView || isSettingsView) && visibleCount === 0
  );
  elements.loadingState.classList.toggle("hidden", !state.loading);
  elements.pageIndicator.textContent = isDashboardView
    ? "Dashboard"
    : isPipelineView
      ? "Pipeline"
      : isClientsView
        ? "Clients"
        : isListsView
          ? "Lists"
          : isFollowupsView
            ? "Action Center"
            : isSettingsView
              ? "Settings"
              : `Page ${state.currentPage} of ${getTotalPages()}`;
  elements.prevPageButton.disabled =
    isDashboardView || isPipelineView || isClientsView || isListsView || isFollowupsView || isSettingsView || state.currentPage <= 1;
  elements.nextPageButton.disabled =
    isDashboardView || isPipelineView || isClientsView || isListsView || isFollowupsView || isSettingsView || state.currentPage >= getTotalPages();
  elements.listViewButton?.classList.toggle("active", state.viewMode === "list");
  elements.gridViewButton?.classList.toggle("active", state.viewMode === "grid");
  if (elements.scanVisibleButton) {
    elements.scanVisibleButton.disabled =
    state.bulkScan.running || !state.pagedCompanies.some((company) => company.website);
  }
  if (elements.pauseQueueButton) {
    elements.pauseQueueButton.disabled = !state.bulkScan.running || state.bulkScan.paused;
  }
  if (elements.resumeQueueButton) {
    elements.resumeQueueButton.disabled =
    state.bulkScan.running || !state.bulkScan.paused || !state.bulkScan.queue.length;
  }
  if (elements.cancelQueueButton) {
    elements.cancelQueueButton.disabled =
    (!state.bulkScan.running && !state.bulkScan.paused) || !state.bulkScan.queue.length;
  }

  if (isDashboardView) {
    renderDashboardView();
  } else if (isPipelineView) {
    renderPipelineView();
  } else if (isClientsView) {
    renderClientsView();
  } else if (isListsView) {
    renderSavedListsView();
  } else if (isFollowupsView) {
    renderFollowUpsView();
  } else if (isSettingsView) {
    renderSettingsView();
  } else {
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
      searchMode: getActiveFilters().searchMode,
    });
  }

  elements.appViewButtons.forEach((button) => {
    button.classList.toggle("active", (button.getAttribute("data-app-view") || "discovery") === state.activeView);
  });

  renderDetail();
  renderTodayFollowups();
  renderBatchProgress();
  renderBulkProgress();
  renderStorageStatus();
}

function showAppError(message) {
  showSectionError(message);
  if (elements.statusMessage) {
    elements.statusMessage.textContent = message;
  }
}

function showSectionError(message) {
  if (!elements.resultsContainer) {
    return;
  }

  elements.resultsContainer.className = "results-container list-view";
  elements.resultsContainer.classList.remove("hidden");
  elements.resultsContainer.innerHTML = `
    <section class="workflow-card">
      <p class="detail-section-title">Page temporarily unavailable</p>
      <p class="toolbar-subtle">${escapeHtml(message)}</p>
    </section>
  `;
  elements.loadingState?.classList.add("hidden");
  elements.emptyState?.classList.add("hidden");
}

function formatViewLabel(value) {
  const labels = {
    dashboard: "Dashboard",
    discovery: "Search",
    saved: "Saved Prospects",
    pipeline: "Pipeline",
    followups: "Follow-Ups",
    clients: "Clients",
    lists: "Saved Lists",
    settings: "Settings",
  };
  return labels[value] || "this page";
}

function renderStorageStatus() {
  if (!elements.storageStatus) {
    return;
  }

  const status = storageService.getStatus();
  const modeLabel = status.activeMode === "localStorage" ? "LocalStorage" : titleCase(status.activeMode);
  elements.storageStatus.textContent = `Active storage: ${modeLabel} - Supabase configured: ${
    status.supabaseConfigured ? "Yes" : "No"
  } - Saved prospects source: ${status.activeMode === "supabase" ? "Supabase" : "LocalStorage"} - Clients source: ${
    status.activeMode === "supabase" ? "Supabase" : "LocalStorage"
  }`;
  elements.syncSavedProspectsButton?.classList.toggle(
    "hidden",
    !(status.supabaseConfigured && status.activeMode === "supabase")
  );
  elements.syncClientsButton?.classList.toggle("hidden", !(status.supabaseConfigured && status.activeMode === "supabase"));
}

async function hydrateSavedProspectsFromStorage() {
  const status = storageService.getStatus();
  if (status.activeMode !== "supabase") {
    return;
  }

  try {
    const savedProspects = await storageService.getSavedProspects();
    if (!Array.isArray(savedProspects) || !savedProspects.length || typeof savedProspects[0] === "string") {
      return;
    }

    const nextManualProspects = [...state.manualProspects];
    savedProspects.forEach((entry) => {
      if (!entry?.id) {
        return;
      }

      state.savedCompanies = [...new Set([...state.savedCompanies, entry.id])];
      state.prospectWorkflows[entry.id] = {
        ...(state.prospectWorkflows[entry.id] || {}),
        ...(entry.workflow || {}),
      };

      if (entry.company && !nextManualProspects.some((prospect) => isDuplicateProspect(prospect, entry.company))) {
        nextManualProspects.push(entry.company);
      }
    });
    state.manualProspects = nextManualProspects;
  } catch (error) {
    elements.statusMessage.textContent = "Supabase saved prospects unavailable. Using localStorage fallback.";
  }
}

async function syncLocalSavedProspectsToSupabase() {
  const status = storageService.getStatus();
  if (!status.supabaseConfigured || status.activeMode !== "supabase") {
    elements.statusMessage.textContent = "Supabase sync is not available in the current storage mode.";
    return;
  }

  elements.syncSavedProspectsButton.disabled = true;
  elements.statusMessage.textContent = "Syncing local saved prospects to Supabase...";
  try {
    const result = await storageService.syncLocalSavedProspectsToSupabase(state.companies);
    elements.statusMessage.textContent = `Supabase sync complete. ${result.synced} synced, ${result.failed} failed.`;
  } catch (error) {
    elements.statusMessage.textContent = "Supabase sync failed. LocalStorage data was not changed.";
  } finally {
    elements.syncSavedProspectsButton.disabled = false;
  }
}

async function hydrateClientsFromStorage() {
  const status = storageService.getStatus();
  if (status.activeMode !== "supabase") {
    return;
  }

  try {
    const clients = await storageService.getClients();
    if (Array.isArray(clients)) {
      state.clients = clients.map((client) => normalizeClientRecord(client));
    }
  } catch (error) {
    elements.statusMessage.textContent = "Supabase clients unavailable. Using localStorage fallback.";
  }
}

async function syncLocalClientsToSupabase() {
  const status = storageService.getStatus();
  if (!status.supabaseConfigured || status.activeMode !== "supabase") {
    elements.statusMessage.textContent = "Client Supabase sync is not available in the current storage mode.";
    return;
  }

  elements.syncClientsButton.disabled = true;
  elements.statusMessage.textContent = "Syncing local clients to Supabase...";
  try {
    const result = await storageService.syncLocalClientsToSupabase();
    resetClientSyncSnapshot();
    elements.statusMessage.textContent = `Client sync complete. ${result.synced} synced, ${result.failed} failed.`;
  } catch (error) {
    elements.statusMessage.textContent = "Client sync failed. LocalStorage data was not changed.";
  } finally {
    elements.syncClientsButton.disabled = false;
  }
}

function renderDashboardView() {
  const metrics = getDashboardMetrics();
  const todaysActions = getTodaysActions().slice(0, 8);
  const followUpActions = getActionCenterItems()
    .filter((item) => String(item.type || item.actionNeeded || "").toLowerCase().includes("follow"))
    .slice(0, 5);
  const blockedClients = state.clients.filter((client) => isClientBlocked(client)).slice(0, 5);
  const pipelineSummary = getPipelineSummary();
  const recentActivity = getRecentActivity().slice(0, 10);
  const hasWorkspaceData =
    metrics.totalSavedProspects > 0 ||
    metrics.activeClients > 0 ||
    metrics.blockedClients > 0 ||
    todaysActions.length > 0 ||
    recentActivity.length > 0;

  elements.resultsContainer.className = "results-container list-view";
  elements.resultsContainer.innerHTML = `
    <section class="dashboard-hero">
      <div class="dashboard-hero-content">
        <p class="dashboard-kicker">Client Finder Command Center</p>
        <h1>Business prospecting that stays focused.</h1>
        <p>Track the prospects, follow-ups, and client work that need attention today.</p>
        <div class="dashboard-hero-actions">
          <button class="primary-btn" type="button" data-dashboard-view="discovery">Go to Search</button>
          <button class="secondary-btn" type="button" data-dashboard-view="pipeline">Review Pipeline</button>
        </div>
      </div>
      <div class="dashboard-hero-metrics">
        <span><strong>${escapeHtml(String(metrics.totalSavedProspects))}</strong> saved prospects</span>
        <span><strong>${escapeHtml(String(metrics.followUpsDueToday))}</strong> due today</span>
        <span><strong>${escapeHtml(String(metrics.activeClients))}</strong> active clients</span>
      </div>
    </section>

    ${
      hasWorkspaceData
        ? ""
        : `
          <section class="workflow-card">
            <div class="workflow-header-row">
              <div>
                <p class="detail-section-title">No saved prospects yet.</p>
                <p class="toolbar-subtle">Start by searching for businesses.</p>
              </div>
              <button class="primary-btn" type="button" data-dashboard-view="discovery">Go to Search</button>
            </div>
          </section>
        `
    }

    <section class="dashboard-metric-grid">
      ${[
        ["Follow-Ups Due Today", metrics.followUpsDueToday, "Needs attention now"],
        ["Pipeline Prospects", metrics.totalSavedProspects, "Saved opportunities"],
        ["Active Clients", metrics.activeClients, "Current projects"],
        ["Blocked Clients", metrics.blockedClients, "Requires unblock"],
      ]
        .map(
          ([label, value, helper]) => `
            <div class="overview-card dashboard-stat-card">
              <span class="overview-label">${escapeHtml(label)}</span>
              <strong>${escapeHtml(String(value))}</strong>
              <small>${escapeHtml(helper)}</small>
            </div>
          `
        )
        .join("")}
    </section>

    <section class="dashboard-section-grid">
      <article class="workflow-card">
        <div class="workflow-header-row">
          <div>
            <p class="detail-section-title">Today's Actions</p>
            <p class="toolbar-subtle">Follow-ups, blocked work, and client items that need attention.</p>
          </div>
          <button class="secondary-btn" type="button" data-dashboard-view="followups">Open Follow-Ups</button>
        </div>
        <div class="action-list">
          ${todaysActions.length ? todaysActions.map(renderActionItem).join("") : `<div class="na-panel">No actions need attention right now.</div>`}
        </div>
      </article>

      <article class="workflow-card">
        <div class="workflow-header-row">
          <div>
            <p class="detail-section-title">Follow-Ups Due</p>
            <p class="toolbar-subtle">${escapeHtml(String(metrics.followUpsDueToday))} due today, ${escapeHtml(String(metrics.overdueFollowUps))} overdue.</p>
          </div>
          <button class="secondary-btn" type="button" data-dashboard-view="followups">Review Follow-Ups</button>
        </div>
        <div class="action-list">
          ${followUpActions.length ? followUpActions.map(renderActionItem).join("") : `<div class="na-panel">No follow-ups due.</div>`}
        </div>
      </article>

      <article class="workflow-card">
        <div class="workflow-header-row">
          <div>
            <p class="detail-section-title">Pipeline Summary</p>
            <p class="toolbar-subtle">Saved prospects by current stage.</p>
          </div>
          <button class="secondary-btn" type="button" data-dashboard-view="pipeline">Open Pipeline</button>
        </div>
        <div class="pipeline-summary-grid">
          ${pipelineSummary
            .map(
              (item) => `
                <div class="pipeline-summary-item">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(String(item.count))}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="workflow-card">
        <p class="detail-section-title">Active Clients</p>
        <div class="overview-grid">
          ${[
            ["Active Clients", metrics.activeClients],
            ["Blocked Clients", metrics.blockedClients],
          ]
            .map(
              ([label, value]) => `
                <div class="overview-card">
                  <span class="overview-label">${escapeHtml(label)}</span>
                  <strong>${escapeHtml(String(value))}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="workflow-card">
        <p class="detail-section-title">Blocked Clients</p>
        <div class="action-list">
          ${
            blockedClients.length
              ? blockedClients
                  .map(
                    (client) => `
                      <article class="action-item">
                        <div class="action-main">
                          <strong>${escapeHtml(client.businessName || "Client")}</strong>
                          <span>${escapeHtml(client.projectStatus || "Blocked")}</span>
                          <small>${escapeHtml(client.ownerOrManagerName || client.phone || "No owner contact")}</small>
                        </div>
                        <div class="workflow-actions action-buttons">
                          <button class="secondary-btn" type="button" data-open-action-client="${escapeAttribute(client.clientId)}">Open Client</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `<div class="na-panel">No blocked clients.</div>`
          }
        </div>
      </article>

      <article class="workflow-card">
        <p class="detail-section-title">Recent Activity</p>
        <div class="activity-list">
          ${
            recentActivity.length
              ? recentActivity
                  .map(
                    (entry) => `
                      <div class="activity-item">
                        <span class="activity-dot"></span>
                        <div>
                          <strong>${escapeHtml(entry.name)}</strong>
                          <p>${escapeHtml(entry.message)}</p>
                          <small>${escapeHtml(entry.source)} - ${escapeHtml(formatDateOnly(entry.date))}</small>
                        </div>
                      </div>
                    `
                  )
                  .join("")
              : `<div class="na-panel">No recent activity yet.</div>`
          }
        </div>
      </article>
    </section>
  `;

  bindActionCenterButtons(elements.resultsContainer);
  elements.resultsContainer.querySelectorAll("[data-dashboard-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.getAttribute("data-dashboard-view") || "dashboard";
      render();
    });
  });
}

function isClientBlocked(client = {}) {
  return (
    String(client.projectStatus || "").trim() === "Blocked" ||
    String(client.handoverStatus || "").trim() === "Blocked" ||
    String(client.currentClientStatus || "").trim() === "Blocked" ||
    Boolean(String(client.handoverBlocker || "").trim()) ||
    calculateAccessProgress(client.accessChecklist, client.accessRecords).blocked > 0
  );
}

function renderPipelineView() {
  const prospects = getFilteredPipelineProspects();
  const grouped = groupProspectsByStage(prospects);
  elements.resultsContainer.className = "results-container list-view";
  elements.resultsContainer.innerHTML = `
    <section class="workflow-card">
      <div class="workflow-header-row">
        <div>
          <p class="detail-section-title">Prospect Pipeline</p>
          <p class="toolbar-subtle">Saved prospects grouped by current stage. Update stage directly from a card when progress changes.</p>
        </div>
      </div>
      ${renderPipelineFilters()}
    </section>
    <section class="pipeline-board">
      ${grouped
        .map(
          (group) => `
            <article class="pipeline-column">
              <div class="pipeline-column-header">
                <strong>${escapeHtml(group.label)}</strong>
                <span class="stage-chip">${escapeHtml(String(group.prospects.length))}</span>
              </div>
              <div class="pipeline-card-list">
                ${group.prospects.length ? group.prospects.map(renderPipelineCard).join("") : `<div class="na-panel">No prospects in this stage.</div>`}
              </div>
            </article>
          `
        )
        .join("")}
    </section>
  `;

  bindPipelineActions();
}

function renderPipelineFilters() {
  const activeFilters = getActiveFilters();
  const businessTypes = getSavedBusinessTypes();
  const filters = state.pipelineFilters || {};
  return `
    <div class="saved-workqueue-filters pipeline-filters">
      <label class="inline-field"><span>Search Mode</span><select data-pipeline-filter="searchMode">
        <option value="">All modes</option>
        ${Object.values(SEARCH_MODES)
          .map((mode) => `<option value="${escapeAttribute(mode.label)}" ${filters.searchMode === mode.label ? "selected" : ""}>${escapeHtml(mode.label)}</option>`)
          .join("")}
      </select></label>
      <label class="inline-field"><span>Business Type</span><select data-pipeline-filter="businessType">
        <option value="">All types</option>
        ${businessTypes.map((type) => `<option value="${escapeAttribute(type)}" ${filters.businessType === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
      </select></label>
      <label class="inline-field"><span>City / State</span><input data-pipeline-filter="location" type="search" value="${escapeAttribute(filters.location || "")}" placeholder="${escapeAttribute([activeFilters.cityLabel, activeFilters.state].filter(Boolean).join(", ") || "Any location")}" /></label>
      <label class="inline-field"><span>Opportunity Priority</span><select data-pipeline-filter="priority">
        <option value="">All priorities</option>
        ${["High Priority", "Good Fit", "Needs Review", "Not Recommended"].map(
          (priority) => `<option value="${escapeAttribute(priority)}" ${filters.priority === priority ? "selected" : ""}>${escapeHtml(priority)}</option>`
        ).join("")}
      </select></label>
      <label class="inline-field"><span>Follow-Up Status</span><select data-pipeline-filter="followUp">
        <option value="">All follow-ups</option>
        ${[
          ["overdue", "Overdue"],
          ["due_today", "Due today"],
          ["upcoming_week", "Upcoming this week"],
          ["none", "No follow-up set"],
        ].map(([value, label]) => `<option value="${escapeAttribute(value)}" ${filters.followUp === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
      </select></label>
      <label class="inline-field"><span>Quote Status</span><select data-pipeline-filter="quoteStatus">
        <option value="">All quotes</option>
        ${QUOTE_STATUSES.map((status) => `<option value="${escapeAttribute(status)}" ${filters.quoteStatus === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
      </select></label>
      <label class="inline-field"><span>Saved List</span><select data-pipeline-filter="listId">
        <option value="">All lists</option>
        ${state.savedLists
          .map(
            (list) =>
              `<option value="${escapeAttribute(list.listId)}" ${filters.listId === list.listId ? "selected" : ""}>${escapeHtml(list.listName)}</option>`
          )
          .join("")}
      </select></label>
    </div>
  `;
}

function renderPipelineCard(company) {
  const latestActivity = getLatestProspectActivity(company);
  const ready = getConvertReadiness(company);
  return `
    <article class="pipeline-card ${ready.ready ? "ready" : ""}">
      <div>
        <strong>${escapeHtml(company.name || "NA")}</strong>
        <p class="toolbar-subtle">${escapeHtml(company.industry || company.keyword || "Business")} - ${escapeHtml([company.city, company.state].filter(Boolean).join(", ") || "No location")}</p>
      </div>
      <div class="pipeline-card-meta">
        <span class="stage-chip">${escapeHtml(company.opportunityPriority || company.lead_label || "Needs Review")}</span>
        <span>${escapeHtml(company.next_follow_up || "No follow-up")}</span>
        <span>${escapeHtml(company.quote_status || "Quote not started")}</span>
        <span>${escapeHtml(latestActivity.message || "No activity yet")}</span>
      </div>
      ${ready.ready ? `<p class="workflow-note">${escapeHtml(ready.reason)}</p>` : ""}
      <label class="inline-field">
        <span>Current Stage</span>
        <select data-pipeline-stage="${escapeAttribute(company.id)}">
          ${PROSPECT_STAGES.map(
            (stage) => `<option value="${escapeAttribute(stage)}" ${normalizeProspectStage(company.prospect_stage) === stage ? "selected" : ""}>${escapeHtml(stage)}</option>`
          ).join("")}
        </select>
      </label>
      <div class="workflow-actions">
        <button class="secondary-btn" type="button" data-open-pipeline-prospect="${escapeAttribute(company.id)}">Open</button>
        ${ready.ready ? `<button class="primary-btn" type="button" data-open-pipeline-prospect="${escapeAttribute(company.id)}">Review Conversion</button>` : ""}
      </div>
    </article>
  `;
}

function renderClientsView() {
  const clients = [...state.clients].sort((left, right) =>
    String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
  );

  elements.resultsContainer.className = "results-container list-view";
  elements.resultsContainer.innerHTML = clients.length
    ? `
      <div class="prospect-list-shell">
        <div class="prospect-list-head">
          <span>Business</span>
          <span>Project</span>
          <span>Client</span>
          <span>Actions</span>
        </div>
        <div class="prospect-list">
          ${clients.map((client) => renderClientRow(client)).join("")}
        </div>
      </div>
    `
    : `
      <section class="workflow-card premium-empty-panel">
        <p class="detail-section-title">Clients</p>
        <h3>No clients yet.</h3>
        <p class="toolbar-subtle">Convert a qualified saved prospect when the quote is accepted or the contract is expected.</p>
      </section>
    `;

  elements.resultsContainer.querySelectorAll("[data-open-client]").forEach((button) => {
    button.addEventListener("click", () => openClientProfile(button.getAttribute("data-open-client")));
  });
}

function renderFollowUpsView() {
  const groups = getActionCenterGroups();
  elements.resultsContainer.className = "results-container list-view";
  elements.resultsContainer.innerHTML = `
    <section class="workflow-card">
      <div class="workflow-header-row">
        <div>
          <p class="detail-section-title">Daily Action Center</p>
          <p class="toolbar-subtle">Open this page each day to handle follow-ups, quotes, client blockers, missing info, and support requests.</p>
        </div>
      </div>
    </section>
    <section class="action-center-grid">
      ${groups
        .map(
          (group) => `
            <article class="workflow-card action-group-card">
              <div class="workflow-header-row">
                <div>
                  <p class="detail-section-title">${escapeHtml(group.label)}</p>
                  <p class="toolbar-subtle">${escapeHtml(String(group.items.length))} item${group.items.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div class="action-list">
                ${group.items.length ? group.items.map(renderActionItem).join("") : `<div class="na-panel">No items.</div>`}
              </div>
            </article>
          `
        )
        .join("")}
    </section>
  `;

  bindActionCenterButtons(elements.resultsContainer);
}

function renderFollowUpRow(company) {
  const followUpState = getFollowUpState(company.next_follow_up);
  return `
    <article class="prospect-row">
      <button class="prospect-main" type="button" data-open-followup="${escapeAttribute(company.id)}">
        <span class="row-title">${escapeHtml(company.name || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.phone || "No phone")} - ${escapeHtml([company.city, company.state].filter(Boolean).join(", "))}</span>
      </button>
      <div class="prospect-fit">
        <span class="stage-chip">${escapeHtml(company.prospect_stage || "Saved")}</span>
        <span class="row-subtitle">${escapeHtml(company.quote_status || "Quote not started")}</span>
      </div>
      <div class="prospect-signals">
        <span>${escapeHtml(followUpState === "overdue" ? "Overdue" : followUpState === "due_today" ? "Due Today" : "Upcoming")}</span>
        <span>${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
        <span>${escapeHtml(company.next_action || "No next action set")}</span>
      </div>
      <div class="prospect-actions">
        <button class="secondary-btn" type="button" data-open-followup="${escapeAttribute(company.id)}">Open</button>
      </div>
    </article>
  `;
}

function renderActionItem(item) {
  return `
    <article class="action-item ${escapeAttribute(item.severity || "")}">
      <div class="action-main">
        <strong>${escapeHtml(item.name || "NA")}</strong>
        <span>${escapeHtml(item.actionNeeded || item.type || "Review")}</span>
        <small>${escapeHtml([item.priority, item.dueLabel, item.lastActivity].filter(Boolean).join(" - ") || "No extra details")}</small>
        <p>${escapeHtml(item.suggestedAction || "Open the record and review next steps.")}</p>
      </div>
      <div class="workflow-actions action-buttons">
        ${item.kind === "prospect" ? `<button class="secondary-btn" type="button" data-open-action-prospect="${escapeAttribute(item.id)}">Open Prospect</button>` : ""}
        ${item.kind === "client" ? `<button class="secondary-btn" type="button" data-open-action-client="${escapeAttribute(item.id)}">Open Client</button>` : ""}
        ${
          item.allowFollowedUp
            ? `<button class="secondary-btn" type="button" data-mark-followed-up="${escapeAttribute(item.id)}">Mark Followed Up</button>`
            : ""
        }
        ${
          item.kind === "prospect"
            ? `<button class="secondary-btn" type="button" data-set-action-followup="${escapeAttribute(item.id)}">Set New Follow-Up</button>
               <button class="secondary-btn" type="button" data-copy-action-outreach="${escapeAttribute(item.id)}">Copy Outreach</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function bindActionCenterButtons(container) {
  container.querySelectorAll("[data-open-action-prospect]").forEach((button) => {
    button.addEventListener("click", () => openDetails(button.getAttribute("data-open-action-prospect")));
  });
  container.querySelectorAll("[data-open-action-client]").forEach((button) => {
    button.addEventListener("click", () => openClientProfile(button.getAttribute("data-open-action-client")));
  });
  container.querySelectorAll("[data-mark-followed-up]").forEach((button) => {
    button.addEventListener("click", () => markActionFollowedUp(button.getAttribute("data-mark-followed-up")));
  });
  container.querySelectorAll("[data-set-action-followup]").forEach((button) => {
    button.addEventListener("click", () => promptForNewFollowUp(button.getAttribute("data-set-action-followup")));
  });
  container.querySelectorAll("[data-copy-action-outreach]").forEach((button) => {
    button.addEventListener("click", () => copyDefaultActionOutreach(button.getAttribute("data-copy-action-outreach")));
  });
}

function bindPipelineActions() {
  elements.resultsContainer.querySelectorAll("[data-open-pipeline-prospect]").forEach((button) => {
    button.addEventListener("click", () => openDetails(button.getAttribute("data-open-pipeline-prospect")));
  });
  elements.resultsContainer.querySelectorAll("[data-pipeline-stage]").forEach((select) => {
    select.addEventListener("change", () => updateProspectStage(select.getAttribute("data-pipeline-stage"), select.value, "Pipeline"));
  });
  elements.resultsContainer.querySelectorAll("[data-pipeline-filter]").forEach((field) => {
    field.addEventListener(field.tagName === "INPUT" ? "input" : "change", () => {
      state.pipelineFilters = {
        ...(state.pipelineFilters || {}),
        [field.getAttribute("data-pipeline-filter")]: field.value || "",
      };
      render();
    });
  });
}

function getDashboardMetrics() {
  const savedProspects = getSavedProspectCompanies();
  const paymentSummaries = state.clients.map((client) => {
    const summary = normalizePaymentSummary(client.paymentSummary, client);
    const totals = calculatePaymentTotals(summary, normalizePaymentRecords(client.paymentRecords));
    return { status: summary.paymentStatus || suggestPaymentStatus(summary, totals), balanceDue: totals.balanceDue };
  });
  return {
    totalSavedProspects: savedProspects.length,
    highPriorityProspects: savedProspects.filter((company) => isHighPriorityProspect(company)).length,
    followUpsDueToday: savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "due_today").length,
    overdueFollowUps: savedProspects.filter((company) => getFollowUpState(company.next_follow_up) === "overdue").length,
    quotesSent: savedProspects.filter((company) => ["Sent", "Under Review"].includes(company.quote_status) || company.prospect_stage === "Quote Sent").length,
    quotesAccepted: savedProspects.filter((company) => company.quote_status === "Accepted").length,
    activeClients: state.clients.filter((client) => !["Completed", "Cancelled", "Archived"].includes(client.currentClientStatus)).length,
    blockedClients: state.clients.filter((client) => client.projectStatus === "Blocked" || client.currentClientStatus === "Blocked").length,
    paymentsDue: paymentSummaries.filter((payment) => payment.balanceDue > 0 && payment.status !== "Paid").length,
    balanceDue: paymentSummaries.reduce((sum, payment) => sum + payment.balanceDue, 0),
    supportRequestsOpen: state.clients.reduce(
      (sum, client) => sum + normalizeSupportRequests(client.supportRequests).filter((request) => !["Completed", "Cancelled"].includes(request.status)).length,
      0
    ),
  };
}

function getTodaysActions() {
  return getActionCenterItems()
    .filter((item) => ["Overdue", "Due Today", "Quotes to Follow Up", "Client Blockers", "Open Support Requests", "Missing Client Info"].includes(item.category))
    .sort(compareActionItems);
}

function getActionCenterGroups() {
  const items = getActionCenterItems();
  return [
    "Overdue",
    "Due Today",
    "Upcoming This Week",
    "Quotes to Follow Up",
    "Client Blockers",
    "Missing Client Info",
    "Open Support Requests",
    "No Follow-Up Set",
  ].map((label) => ({ label, items: items.filter((item) => item.category === label).sort(compareActionItems) }));
}

function getActionCenterItems() {
  return [...getSavedProspectCompanies().flatMap(getProspectActionItems), ...state.clients.flatMap(getClientActionItems)];
}

function getProspectActionItems(company) {
  const items = [];
  const followUpState = getFollowUpState(company.next_follow_up);
  const latestActivity = getLatestProspectActivity(company);
  const base = {
    kind: "prospect",
    id: company.id,
    name: company.name || "Prospect",
    priority: company.follow_up_priority || company.opportunityPriority || company.lead_label || "Normal",
    lastActivity: latestActivity.message ? `Last: ${latestActivity.message}` : "No activity yet",
    allowFollowedUp: true,
  };
  if (followUpState === "overdue" || followUpState === "due_today" || isUpcomingThisWeek(company.next_follow_up)) {
    items.push({
      ...base,
      category: followUpState === "overdue" ? "Overdue" : followUpState === "due_today" ? "Due Today" : "Upcoming This Week",
      type: "Follow-Up",
      dueLabel: company.next_follow_up || "Not scheduled",
      actionNeeded: followUpState === "overdue" ? "Follow-up overdue" : followUpState === "due_today" ? "Follow-up due today" : "Follow-up this week",
      suggestedAction: company.next_action || getSuggestedPipelineAction(company),
      severity: followUpState === "overdue" ? "high" : "normal",
    });
  }
  if (["Sent", "Under Review"].includes(company.quote_status) || company.prospect_stage === "Quote Sent") {
    items.push({
      ...base,
      category: "Quotes to Follow Up",
      type: "Quote",
      dueLabel: company.quote_follow_up_date || company.next_follow_up || "No quote follow-up date",
      actionNeeded: "Quote needs follow-up",
      suggestedAction: "Ask about decision timing and any remaining scope questions.",
      severity: "normal",
    });
  }
  if (followUpState === "none" && !["Lost", "Archived", "Client Converted", "Client Onboarding"].includes(normalizeProspectStage(company.prospect_stage))) {
    items.push({
      ...base,
      category: "No Follow-Up Set",
      type: "Queue Cleanup",
      dueLabel: "No date",
      actionNeeded: "No follow-up set",
      suggestedAction: "Set a follow-up date or move the prospect to Lost / Not Interested.",
      allowFollowedUp: false,
      severity: "low",
    });
  }
  return items;
}

function getClientActionItems(client) {
  const items = [];
  const missingInfo = getMissingClientInfo(client);
  const base = {
    kind: "client",
    id: client.clientId,
    name: client.businessName || "Client",
    priority: client.projectStatus === "Blocked" ? "High" : "Normal",
    lastActivity: getLatestClientActivity(client).message || "No activity yet",
    allowFollowedUp: false,
  };
  if (client.projectStatus === "Blocked" || client.currentClientStatus === "Blocked") {
    items.push({
      ...base,
      category: "Client Blockers",
      type: "Client",
      dueLabel: client.nextProjectAction || client.projectStatus || "Blocked",
      actionNeeded: "Client blocker",
      suggestedAction: client.nextProjectAction || "Open the client profile and resolve the blocker.",
      severity: "high",
    });
  }
  if (missingInfo.length) {
    items.push({
      ...base,
      category: "Missing Client Info",
      type: "Client Info",
      dueLabel: `${missingInfo.length} missing`,
      actionNeeded: "Missing critical client info",
      suggestedAction: `Collect: ${missingInfo.slice(0, 3).join(", ")}${missingInfo.length > 3 ? "..." : ""}`,
      severity: "normal",
    });
  }
  normalizeSupportRequests(client.supportRequests)
    .filter((request) => !["Completed", "Cancelled"].includes(request.status) && ["High", "Urgent"].includes(request.priority))
    .forEach((request) => {
      items.push({
        ...base,
        category: "Open Support Requests",
        type: "Support",
        priority: request.priority,
        dueLabel: request.targetDate || request.status,
        actionNeeded: request.title || "Open support request",
        suggestedAction: request.notes || "Review and update the support request.",
        severity: request.priority === "Urgent" ? "high" : "normal",
      });
    });
  return items;
}

function compareActionItems(left, right) {
  return getActionPriorityRank(right) - getActionPriorityRank(left) || String(left.dueLabel || "").localeCompare(String(right.dueLabel || ""));
}

function getActionPriorityRank(item) {
  if (item.category === "Overdue" || item.severity === "high") return 4;
  if (item.category === "Due Today") return 3;
  if (["High Priority", "High", "Urgent"].includes(item.priority)) return 2;
  return 1;
}

function getPipelineSummary() {
  return groupProspectsByStage(getSavedProspectCompanies()).map((group) => ({ label: group.label, count: group.prospects.length }));
}

function getPipelineStages() {
  return PIPELINE_STAGE_GROUPS;
}

function groupProspectsByStage(prospects) {
  const assigned = new Set();
  return getPipelineStages().map((group) => {
    const groupProspects = prospects.filter((company) => {
      if (assigned.has(company.id) || !matchesPipelineStageGroup(company, group)) return false;
      assigned.add(company.id);
      return true;
    });
    return { label: group.label, prospects: groupProspects };
  });
}

function matchesPipelineStageGroup(company, group) {
  if (typeof group.matcher === "function" && group.matcher(company)) return true;
  return Array.isArray(group.stages) && group.stages.includes(normalizeProspectStage(company.prospect_stage || company.stage));
}

function getFilteredPipelineProspects() {
  const filters = state.pipelineFilters || {};
  let prospects = getSavedProspectCompanies();
  if (filters.listId) {
    const ids = new Set(state.savedLists.find((item) => item.listId === filters.listId)?.prospectIds || []);
    prospects = prospects.filter((company) => ids.has(company.id));
  }
  if (filters.searchMode) prospects = prospects.filter((company) => (company.searchMode || company.recordPurpose || "") === filters.searchMode);
  if (filters.businessType) prospects = prospects.filter((company) => [company.keyword, company.businessType, company.industry].includes(filters.businessType));
  if (filters.location) {
    const query = normalizeText(filters.location);
    prospects = prospects.filter((company) => normalizeText([company.city, company.state, company.address].filter(Boolean).join(" ")).includes(query));
  }
  if (filters.priority) prospects = prospects.filter((company) => (company.opportunityPriority || company.lead_label || "") === filters.priority);
  if (filters.followUp) prospects = prospects.filter((company) => matchesSavedFollowUpFilter(company.next_follow_up, filters.followUp));
  if (filters.quoteStatus) prospects = prospects.filter((company) => (company.quote_status || "Not Started") === filters.quoteStatus);
  return prospects;
}

function getClientDeliveryHealth() {
  return {
    activeClients: state.clients.filter((client) => !["Completed", "Cancelled", "Archived"].includes(client.currentClientStatus)).length,
    blockedClients: state.clients.filter((client) => client.projectStatus === "Blocked" || client.currentClientStatus === "Blocked").length,
    onboarding: state.clients.filter((client) => client.projectStatus === "Client Onboarding").length,
    development: state.clients.filter((client) => ["Design", "Development", "Content Collection", "Discovery"].includes(client.projectStatus)).length,
    awaitingApproval: state.clients.filter((client) => ["Review", "Awaiting Approval"].includes(client.projectStatus)).length,
    handover: state.clients.filter((client) => ["Handover", "Launch"].includes(client.projectStatus) || client.handoverStatus === "Preparing").length,
    supportActive: state.clients.filter((client) => normalizeSupportPlan(client.supportPlan, client).supportStatus === "Active").length,
  };
}

function getRecentActivity() {
  const prospectActivity = getSavedProspectCompanies().flatMap((company) =>
    (Array.isArray(company.activity_log) ? company.activity_log : []).map((entry) => ({
      name: company.name || "Prospect",
      message: entry.message || entry.activity_type || "Updated",
      source: entry.source || "Prospect",
      date: entry.created_at || entry.createdAt || "",
    }))
  );
  const clientActivity = state.clients.flatMap((client) =>
    (Array.isArray(client.activity) ? client.activity : []).map((entry) => ({
      name: client.businessName || "Client",
      message: entry.message || "Updated",
      source: entry.source || "Client",
      date: entry.createdAt || entry.created_at || "",
    }))
  );
  return [...prospectActivity, ...clientActivity].filter((entry) => entry.message).sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")));
}

function getLatestProspectActivity(company) {
  const latest = Array.isArray(company.activity_log) ? company.activity_log[0] || {} : {};
  return { message: latest.message || latest.activity_type || "", date: latest.created_at || latest.createdAt || "" };
}

function getLatestClientActivity(client) {
  const latest = Array.isArray(client.activity) ? client.activity[0] || {} : {};
  return { message: latest.message || "", date: latest.createdAt || latest.created_at || "" };
}

function getSavedBusinessTypes() {
  return [
    ...new Set(
      getSavedProspectCompanies()
        .flatMap((company) => [company.keyword, company.businessType, company.industry])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function isHighPriorityProspect(company) {
  return ["High Priority", "High", "Urgent"].includes(company.opportunityPriority || company.lead_label || company.follow_up_priority);
}

function getConvertReadiness(company) {
  if (!isProspectEligibleForClientConversion(company)) return { ready: false, reason: "" };
  if (String(company.quote_status || "") === "Accepted") return { ready: true, reason: "Ready to convert: quote accepted." };
  const stage = normalizeProspectStage(company.prospect_stage || company.stage);
  if (stage === "Contract Expected") return { ready: true, reason: "Ready to convert: contract expected." };
  if (stage === "Contract Received") return { ready: true, reason: "Ready to convert: contract received." };
  return { ready: true, reason: "Ready to convert: payment or contract milestone completed." };
}

function getSuggestedPipelineAction(company) {
  const stage = normalizeProspectStage(company?.prospect_stage || company?.stage);
  if (stage === "New Lead" || stage === "Saved") return "Review fit and send first outreach.";
  if (stage === "Outreach Started") return "Follow up or log the latest response.";
  if (stage === "Engaged") return "Confirm needs and schedule a meeting.";
  if (stage === "Meeting Done" || stage === "Requirements Discussed") return "Prepare scope and quote.";
  if (stage === "Quote Requested" || stage === "Negotiation") return "Finish quote details and send for review.";
  if (stage === "Quote Sent") return "Follow up on decision timing.";
  if (stage === "Contract Expected" || stage === "Contract Received") return "Review conversion readiness.";
  if (stage === "Client Converted" || stage === "Client Onboarding") return "Open the linked client profile.";
  return "Open the record and decide the next action.";
}

function updateProspectStage(companyId, nextStage, source = "Manual") {
  if (!companyId || !PROSPECT_STAGES.includes(nextStage)) return;
  const company = state.companies.find((item) => item.id === companyId) || getCompanyForSavedProspect(companyId);
  ensureProspectWorkflow(companyId, company);
  const workflow = getProspectWorkflow(companyId);
  const previousStage = normalizeProspectStage(workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage);
  if (previousStage === nextStage) return;
  const now = new Date().toISOString();
  state.prospectWorkflows[companyId] = {
    ...workflow,
    currentStage: nextStage,
    prospect_stage: nextStage,
    stage: nextStage,
    manual_stage_override: true,
    stageUpdateSource: source,
    stageUpdatedAt: now,
    updated_at: now,
  };
  persistProspectWorkflows();
  recordProspectActivity(companyId, `Stage changed to ${nextStage}`, source, "stage-change");
  if (nextStage === "Quote Sent" && !state.prospectWorkflows[companyId].next_follow_up) {
    state.prospectWorkflows[companyId].next_follow_up = getSuggestedFollowUpDate("Quote Sent", getTodayDateKey(), "");
    persistProspectWorkflows();
  }
  elements.statusMessage.textContent = `Current Stage updated to ${nextStage}.`;
  applyFilters();
}

function markActionFollowedUp(companyId) {
  const company = state.companies.find((item) => item.id === companyId) || getCompanyForSavedProspect(companyId);
  if (!company?.id) return;
  recordProspectActivity(company.id, "Follow-up completed", "Manual", "follow-up-completed");
  const nextDate = window.prompt("Set next follow-up date (YYYY-MM-DD), or leave blank to keep the current date:", "");
  if (nextDate !== null && String(nextDate || "").trim()) {
    setNextFollowUp(company.id, { nextFollowUp: String(nextDate).trim(), followUpPriority: company.follow_up_priority || "Normal" });
  } else {
    applyFilters();
  }
  elements.statusMessage.textContent = "Follow-up activity recorded.";
}

function promptForNewFollowUp(companyId) {
  const nextDate = window.prompt("Next follow-up date (YYYY-MM-DD):", getTodayDateKey());
  if (!nextDate) return;
  setNextFollowUp(companyId, { nextFollowUp: String(nextDate).trim(), followUpPriority: "Normal" });
}

function copyDefaultActionOutreach(companyId) {
  const company = state.companies.find((item) => item.id === companyId) || getCompanyForSavedProspect(companyId);
  const message = `Hi ${company?.name || "there"}, I wanted to follow up and see if improving your website, booking flow, or online presence is still worth discussing.`;
  copyToClipboard(message, "Outreach message copied.");
  if (company?.id) recordProspectActivity(company.id, "Copied outreach from Action Center", "Manual", "copy-action-outreach");
}

function getMissingClientInfo(client) {
  const missing = [];
  if (!client.ownerOrManagerName && !client.email) missing.push("owner/manager contact");
  const onboardingItems = normalizeOnboardingChecklist(client.onboardingChecklist).groups.flatMap((group) => group.items);
  ["serviceList", "pricingPackages", "logoBrandAssets", "domainAccess", "hostingAccess", "contractReceived", "advancePaymentConfirmed"].forEach((key) => {
    const item = onboardingItems.find((entry) => entry.key === key);
    if (item && !item.checked) missing.push(item.label);
  });
  normalizeDocumentChecklist(client.documentChecklist).items
    .filter((item) => item.critical && !item.checked)
    .forEach((item) => missing.push(item.label));
  const accessSummary = calculateAccessProgress(client.accessChecklist, client.accessRecords);
  if (accessSummary.blocked || accessSummary.missing) missing.push("access references");
  const paymentSummary = normalizePaymentSummary(client.paymentSummary, client);
  const totals = calculatePaymentTotals(paymentSummary, normalizePaymentRecords(client.paymentRecords));
  if (paymentSummary.advanceRequiredAmount > 0 && totals.advanceReceivedAmount <= 0) missing.push("advance payment");
  if (!isHandoverCompleted(client) && client.projectStatus === "Handover") missing.push("final approval");
  return [...new Set(missing)].slice(0, 8);
}

function renderSettingsView() {
  const status = storageService.getStatus();
  const modeLabel = status.activeMode === "localStorage" ? "LocalStorage" : titleCase(status.activeMode);
  const summary = getLocalDataSummary();
  const readiness = getMigrationReadinessStatus(summary, status);
  elements.resultsContainer.innerHTML = `
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">General Settings</p>
      <div class="overview-grid">
        <div class="overview-card"><span class="overview-label">Workspace</span><strong>Local</strong></div>
        <div class="overview-card"><span class="overview-label">User</span><strong>Local User</strong></div>
        <div class="overview-card"><span class="overview-label">Role</span><strong>Owner</strong></div>
        <div class="overview-card"><span class="overview-label">Authentication</span><strong>Local Access</strong></div>
      </div>
    </section>
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">Storage Status</p>
      <div class="overview-grid">
        <div class="overview-card"><span class="overview-label">Active Storage</span><strong>${escapeHtml(modeLabel)}</strong></div>
        <div class="overview-card"><span class="overview-label">Supabase</span><strong>${status.supabaseConfigured ? "Configured" : "Not Configured"}</strong></div>
        <div class="overview-card"><span class="overview-label">Saved Prospects Source</span><strong>${escapeHtml(status.savedProspectsSource || modeLabel)}</strong></div>
        <div class="overview-card"><span class="overview-label">Clients Source</span><strong>${escapeHtml(status.clientsSource || modeLabel)}</strong></div>
      </div>
      <p class="toolbar-subtle">Client Finder uses local storage by default. Supabase readiness is tracked below for future migration planning.</p>
    </section>
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">Supabase Readiness</p>
      <div class="overview-grid">
        <div class="overview-card"><span class="overview-label">Local Data Detected</span><strong>${summary.localDataDetected ? "Yes" : "No"}</strong></div>
        <div class="overview-card"><span class="overview-label">Saved Prospects</span><strong>${escapeHtml(String(summary.savedProspectsCount))}</strong></div>
        <div class="overview-card"><span class="overview-label">Clients</span><strong>${escapeHtml(String(summary.clientsCount))}</strong></div>
        <div class="overview-card"><span class="overview-label">Saved Lists</span><strong>${escapeHtml(String(summary.savedListsCount))}</strong></div>
        <div class="overview-card"><span class="overview-label">Supabase Configured</span><strong>${status.supabaseConfigured ? "Yes" : "No"}</strong></div>
        <div class="overview-card"><span class="overview-label">Migration Status</span><strong>${escapeHtml(readiness.migrationStatus)}</strong></div>
      </div>
      <p class="toolbar-subtle">${escapeHtml(readiness.note)}</p>
    </section>
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">Backup / Restore</p>
      <p class="toolbar-subtle">Backup files may contain business notes, client records, payment references, and access references. Store backup files securely.</p>
      <div class="workflow-actions">
        <button id="export-local-backup-button" class="secondary-btn" type="button">Export Local Backup</button>
        <label class="secondary-btn inline-link-btn" for="import-local-backup-input">Choose Backup File</label>
        <input id="import-local-backup-input" class="hidden" type="file" accept="application/json,.json" />
      </div>
      <div id="backup-restore-summary" class="toolbar-subtle">No backup selected.</div>
      <div class="quote-form-grid">
        <label class="inline-field">
          <span>Restore Mode</span>
          <select id="restore-mode-select">
            <option value="merge" selected>Merge with current data</option>
            <option value="replace">Replace current Client Finder data</option>
          </select>
        </label>
      </div>
      <div class="workflow-actions">
        <button id="restore-local-backup-button" class="secondary-btn" type="button">Import Local Backup</button>
      </div>
    </section>
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">Data Safety</p>
      <p class="toolbar-subtle">This cannot be undone unless you exported a backup first. Reset tools do not affect API keys, server env vars, or Vercel settings.</p>
      <div class="workflow-actions">
        <button class="secondary-btn" type="button" data-clear-local-data="search_cache">Clear Search Results Cache</button>
        <button class="secondary-btn" type="button" data-clear-local-data="saved_prospects">Clear Saved Prospects</button>
        <button class="secondary-btn" type="button" data-clear-local-data="clients">Clear Clients</button>
        <button class="secondary-btn" type="button" data-clear-local-data="saved_lists">Clear Saved Lists</button>
        <button class="secondary-btn" type="button" data-clear-local-data="all">Clear All Client Finder Local Data</button>
      </div>
    </section>
    <section class="workflow-card settings-panel">
      <p class="detail-section-title">System Information</p>
      <div class="overview-grid">
        <div class="overview-card"><span class="overview-label">Routing</span><strong>Vercel Ready</strong></div>
        <div class="overview-card"><span class="overview-label">Default Storage</span><strong>LocalStorage</strong></div>
        <div class="overview-card"><span class="overview-label">Product</span><strong>Client Finder</strong></div>
        <div class="overview-card"><span class="overview-label">Backup Schema</span><strong>${escapeHtml(BACKUP_SCHEMA_VERSION)}</strong></div>
      </div>
    </section>
  `;

  bindSettingsDataSafetyActions();
}

function bindSettingsDataSafetyActions() {
  elements.resultsContainer.querySelector("#export-local-backup-button")?.addEventListener("click", exportLocalBackup);
  elements.resultsContainer.querySelector("#import-local-backup-input")?.addEventListener("change", handleBackupFileSelected);
  elements.resultsContainer.querySelector("#restore-local-backup-button")?.addEventListener("click", importLocalBackup);
  elements.resultsContainer.querySelectorAll("[data-clear-local-data]").forEach((button) => {
    button.addEventListener("click", () => clearClientFinderData(button.getAttribute("data-clear-local-data") || ""));
  });
}

function getClientFinderLocalStorageKeys() {
  return CLIENT_FINDER_LOCAL_KEYS.filter((key) => typeof localStorage.getItem(key) === "string");
}

function getLocalDataSummary(data = null) {
  const backupData = data || readClientFinderLocalData();
  const savedProspects = readJsonFromBackupData(backupData, SAVED_COMPANIES_KEY, []);
  const clients = readJsonFromBackupData(backupData, CLIENTS_KEY, []);
  const savedLists = readJsonFromBackupData(backupData, SAVED_LISTS_KEY, []);
  const workflows = readJsonFromBackupData(backupData, PROSPECT_WORKFLOWS_KEY, {});
  const hidden = readJsonFromBackupData(backupData, HIDDEN_PROSPECTS_KEY, []);
  return {
    localDataDetected: Object.keys(backupData).some((key) => key !== STORAGE_MODE_KEY && hasBackupValue(backupData[key])),
    savedProspectsCount: Array.isArray(savedProspects) ? savedProspects.length : 0,
    clientsCount: Array.isArray(clients) ? clients.length : 0,
    savedListsCount: Array.isArray(savedLists) ? savedLists.length : 0,
    workflowCount: workflows && typeof workflows === "object" && !Array.isArray(workflows) ? Object.keys(workflows).length : 0,
    hiddenProspectsCount: Array.isArray(hidden) ? hidden.length : 0,
  };
}

function getMigrationReadinessStatus(summary = getLocalDataSummary(), status = storageService.getStatus()) {
  if (!summary.localDataDetected) {
    return { migrationStatus: "Not Started", note: "No local Client Finder data was detected." };
  }
  if (!status.supabaseConfigured) {
    return { migrationStatus: "Not Started", note: "Local data exists. Configure Supabase before attempting migration." };
  }
  if (status.activeMode === "supabase") {
    return { migrationStatus: "Partial", note: "Supabase mode is enabled for prepared domains. Full migration is not automatic." };
  }
  return { migrationStatus: "Ready", note: "Local data exists and Supabase is configured. Export a backup before any migration." };
}

function readClientFinderLocalData() {
  return CLIENT_FINDER_LOCAL_KEYS.reduce((data, key) => {
    const value = localStorage.getItem(key);
    if (typeof value === "string") {
      data[key] = value;
    }
    return data;
  }, {});
}

function exportLocalBackup() {
  const backup = {
    app: "Client Finder",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    storageMode: storageService.getStatus().activeMode,
    data: readClientFinderLocalData(),
    summary: getLocalDataSummary(),
  };
  downloadBlob(`client-finder-local-backup-${getTodayDateKey()}.json`, JSON.stringify(backup, null, 2), "application/json");
  elements.statusMessage.textContent = "Local backup exported.";
}

async function handleBackupFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const backup = validateBackupJson(text);
    state.pendingBackup = backup;
    const summary = getLocalDataSummary(backup.data);
    const summaryElement = elements.resultsContainer.querySelector("#backup-restore-summary");
    if (summaryElement) {
      summaryElement.textContent = `Selected backup from ${backup.exportedAt || "unknown date"}: ${summary.savedProspectsCount} saved prospects, ${summary.clientsCount} clients, ${summary.savedListsCount} lists.`;
    }
    elements.statusMessage.textContent = "Backup selected. Review the summary before importing.";
  } catch (error) {
    state.pendingBackup = null;
    elements.statusMessage.textContent = "Invalid backup file. Existing data was not changed.";
  }
}

function validateBackupJson(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || parsed.app !== "Client Finder" || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("Invalid Client Finder backup.");
  }
  const invalidKey = Object.keys(parsed.data).find((key) => !CLIENT_FINDER_LOCAL_KEYS.includes(key));
  if (invalidKey) {
    throw new Error(`Backup contains unsupported key: ${invalidKey}`);
  }
  return parsed;
}

function importLocalBackup() {
  if (!state.pendingBackup) {
    elements.statusMessage.textContent = "Choose a valid backup file first.";
    return;
  }
  const mode = elements.resultsContainer.querySelector("#restore-mode-select")?.value || "merge";
  const summary = getLocalDataSummary(state.pendingBackup.data);
  const confirmed = window.confirm(
    `${mode === "replace" ? "Replace" : "Merge"} local Client Finder data from this backup?\n\nSaved prospects: ${summary.savedProspectsCount}\nClients: ${summary.clientsCount}\nLists: ${summary.savedListsCount}`
  );
  if (!confirmed) {
    return;
  }

  if (mode === "replace") {
    replaceBackupData(state.pendingBackup.data);
  } else {
    mergeBackupData(state.pendingBackup.data);
  }
  reloadLocalStateFromStorage();
  state.pendingBackup = null;
  elements.statusMessage.textContent = "Backup imported successfully.";
  render();
}

function mergeBackupData(backupData) {
  CLIENT_FINDER_LOCAL_KEYS.forEach((key) => {
    if (typeof backupData[key] !== "string") {
      return;
    }
    const currentValue = localStorage.getItem(key);
    const merged = mergeLocalStorageValue(key, currentValue, backupData[key]);
    localStorage.setItem(key, merged);
  });
}

function replaceBackupData(backupData) {
  CLIENT_FINDER_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
  Object.entries(backupData).forEach(([key, value]) => {
    if (CLIENT_FINDER_LOCAL_KEYS.includes(key) && typeof value === "string") {
      localStorage.setItem(key, value);
    }
  });
}

function mergeLocalStorageValue(key, currentRaw, backupRaw) {
  if (key === STORAGE_MODE_KEY) {
    return currentRaw || backupRaw;
  }
  const current = parseJsonSafe(currentRaw, null);
  const backup = parseJsonSafe(backupRaw, null);
  if (Array.isArray(current) || Array.isArray(backup)) {
    return JSON.stringify(mergeArrayByIdentity(Array.isArray(current) ? current : [], Array.isArray(backup) ? backup : []));
  }
  if (current && typeof current === "object" && backup && typeof backup === "object") {
    return JSON.stringify({ ...backup, ...current });
  }
  return currentRaw || backupRaw;
}

function mergeArrayByIdentity(current, backup) {
  const map = new Map();
  [...backup, ...current].forEach((item) => {
    const key = typeof item === "object" && item
      ? item.id || item.clientId || item.listId || item.requestId || JSON.stringify(item)
      : String(item);
    map.set(key, item);
  });
  return [...map.values()];
}

function clearClientFinderData(scope) {
  const labels = {
    search_cache: "clear search results cache",
    saved_prospects: "clear saved prospects",
    clients: "clear clients",
    saved_lists: "clear saved lists",
    all: "clear all Client Finder local data",
  };
  if (scope === "all") {
    const typed = window.prompt("Type DELETE to clear all Client Finder local data. Export a backup first if needed.");
    if (typed !== "DELETE") {
      elements.statusMessage.textContent = "Clear all cancelled.";
      return;
    }
  } else if (!window.confirm(`Confirm ${labels[scope] || "clear data"}? This cannot be undone unless you exported a backup first.`)) {
    return;
  }

  const keysByScope = {
    search_cache: [MANUAL_PROSPECTS_KEY, SCAN_QUEUE_KEY],
    saved_prospects: [SAVED_COMPANIES_KEY, PROSPECT_WORKFLOWS_KEY, HIDDEN_PROSPECTS_KEY],
    clients: [CLIENTS_KEY],
    saved_lists: [SAVED_LISTS_KEY],
    all: CLIENT_FINDER_LOCAL_KEYS,
  };
  (keysByScope[scope] || []).forEach((key) => localStorage.removeItem(key));
  reloadLocalStateFromStorage();
  elements.statusMessage.textContent = `${titleCase(labels[scope] || "data cleared")}.`;
  render();
}

function reloadLocalStateFromStorage() {
  state.savedSearches = loadSavedSearches();
  state.savedLists = loadSavedLists();
  state.savedCompanies = loadSavedCompanies();
  state.clients = getClients();
  state.hiddenProspects = loadHiddenProspects();
  state.prospectWorkflows = loadProspectWorkflows();
  state.manualProspects = loadManualProspects();
  state.senderProfile = loadSenderProfile();
  state.companies = augmentCompaniesWithScannerData(mergeManualProspects(state.companies, state.manualProspects));
  state.currentPage = 1;
  resetClientSyncSnapshot();
  renderSavedSearches();
  applyFilters();
}

function readJsonFromBackupData(data, key, fallbackValue) {
  return parseJsonSafe(data?.[key], fallbackValue);
}

function parseJsonSafe(value, fallbackValue) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function hasBackupValue(rawValue) {
  const value = parseJsonSafe(rawValue, rawValue);
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(String(value || "").trim());
}

function renderEmptyState() {
  if (!elements.emptyState) {
    return;
  }

  const copy = {
    discovery: {
      title: "No results found.",
      body: "Try a broader business type, larger radius, or different website condition.",
      action: "Add Test Prospect",
      showAction: false,
    },
    saved: {
      title: "No saved prospects yet.",
      body: "Search businesses and save the best opportunities.",
      action: "Add Test Prospect",
      showAction: false,
    },
    clients: {
      title: "No clients yet.",
      body: "Convert a qualified prospect when the project is ready.",
      action: "",
      showAction: false,
    },
    followups: {
      title: "No follow-ups due.",
      body: "Set Next Follow-Up on saved prospects to build a daily work queue.",
      action: "",
      showAction: false,
    },
  }[state.activeView] || {
    title: "Nothing to show yet.",
    body: "Use Search or Saved Prospects to continue.",
    action: "",
    showAction: false,
  };

  elements.emptyState.innerHTML = `
    <h2>${escapeHtml(copy.title)}</h2>
    <p>${escapeHtml(copy.body)}</p>
    ${copy.showAction ? `<button id="empty-add-test-prospect-button" class="primary-btn" type="button">${escapeHtml(copy.action)}</button>` : ""}
  `;
  elements.emptyAddTestProspectButton = document.querySelector("#empty-add-test-prospect-button");
  elements.emptyAddTestProspectButton?.addEventListener("click", addTestProspect);
}

function renderSavedListsView() {
  const selectedList = getSelectedSavedList();
  const selectedProspects = selectedList ? getProspectsForList(selectedList.listId) : [];

  elements.resultsContainer.innerHTML = `
    <section class="workflow-card">
      <div class="workflow-header-row">
        <div>
          <p class="detail-section-title">Create Saved List</p>
          <p class="toolbar-subtle">Group saved prospects by campaign, city, vendor review, or follow-up use case.</p>
        </div>
      </div>
      <div class="quote-form-grid">
        <label class="inline-field"><span>List Name</span><input type="text" data-new-list-field="listName" placeholder="IT Staffing Maine" /></label>
        <label class="inline-field"><span>Description</span><input type="text" data-new-list-field="description" placeholder="Prospects to review this week" /></label>
        <label class="inline-field"><span>Tags</span><input type="text" data-new-list-field="tags" placeholder="priority, outreach" /></label>
      </div>
      <div class="workflow-actions">
        <button id="create-saved-list-button" class="secondary-btn" type="button">Create List</button>
      </div>
    </section>

    <div class="prospect-list-shell">
      <div class="prospect-list-head">
        <span>List</span>
        <span>Context</span>
        <span>Prospects</span>
        <span>Actions</span>
      </div>
      <div class="prospect-list">
        ${
          state.savedLists.length
            ? state.savedLists.map((list) => renderSavedListRow(list)).join("")
            : `<div class="na-panel">No saved lists yet.</div>`
        }
      </div>
    </div>

    ${
      selectedList
        ? `
      <section class="workflow-card">
        <div class="workflow-header-row">
          <div>
            <p class="detail-section-title">${escapeHtml(selectedList.listName)}</p>
            <p class="toolbar-subtle">${escapeHtml(selectedList.description || "No description")}</p>
          </div>
          <div class="workflow-actions">
            <button class="secondary-btn" type="button" data-export-list="${escapeAttribute(selectedList.listId)}">Export List</button>
          </div>
        </div>
        <div class="prospect-list">
          ${
            selectedProspects.length
              ? selectedProspects.map((company) => renderSavedListProspectRow(company, selectedList.listId)).join("")
              : `<div class="na-panel">No prospects in this list yet.</div>`
          }
        </div>
      </section>`
        : ""
    }
  `;

  elements.resultsContainer.querySelector("#create-saved-list-button")?.addEventListener("click", createSavedListFromCurrentFilters);
  elements.resultsContainer.querySelectorAll("[data-open-list]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedListId = button.getAttribute("data-open-list") || "";
      render();
    });
  });
  elements.resultsContainer.querySelectorAll("[data-export-list]").forEach((button) => {
    button.addEventListener("click", () => exportSavedListCsv(button.getAttribute("data-export-list") || ""));
  });
  elements.resultsContainer.querySelectorAll("[data-remove-from-list]").forEach((button) => {
    button.addEventListener("click", () =>
      removeProspectFromList(button.getAttribute("data-remove-from-list") || "", button.getAttribute("data-list-id") || "")
    );
  });
  elements.resultsContainer.querySelectorAll("[data-open-list-prospect]").forEach((button) => {
    button.addEventListener("click", () => openDetails(button.getAttribute("data-open-list-prospect")));
  });
}

function renderSavedListRow(list) {
  const count = getProspectsForList(list.listId).length;
  return `
    <article class="prospect-row ${list.listId === state.selectedListId ? "selected" : ""}">
      <button class="prospect-main" type="button" data-open-list="${escapeAttribute(list.listId)}">
        <span class="row-title">${escapeHtml(list.listName || "Untitled List")}</span>
        <span class="row-subtitle">${escapeHtml(list.description || "No description")}</span>
      </button>
      <div class="prospect-fit">
        <span class="stage-chip">${escapeHtml(list.searchMode || "Local")}</span>
        <span class="row-subtitle">${escapeHtml([list.businessType, list.city, list.state].filter(Boolean).join(" - ") || "Any context")}</span>
      </div>
      <div class="prospect-signals"><span>${escapeHtml(String(count))} prospects</span><span>${escapeHtml((list.tags || []).join(", ") || "No tags")}</span></div>
      <div class="prospect-actions">
        <button class="secondary-btn" type="button" data-open-list="${escapeAttribute(list.listId)}">Open</button>
        <button class="secondary-btn" type="button" data-export-list="${escapeAttribute(list.listId)}">Export</button>
      </div>
    </article>
  `;
}

function renderSavedListProspectRow(company, listId) {
  return `
    <article class="prospect-row">
      <button class="prospect-main" type="button" data-open-list-prospect="${escapeAttribute(company.id)}">
        <span class="row-title">${escapeHtml(company.name || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.industry || company.keyword || "Business")} - ${escapeHtml([company.city, company.state].filter(Boolean).join(", "))}</span>
      </button>
      <div class="prospect-fit"><span class="stage-chip">${escapeHtml(company.prospect_stage || "Saved")}</span><span class="row-subtitle">${escapeHtml(company.opportunityPriority || company.lead_label || "Needs Review")}</span></div>
      <div class="prospect-signals"><span>${escapeHtml(company.phone || "No phone")}</span><span>${escapeHtml(company.next_follow_up || "No follow-up")}</span></div>
      <div class="prospect-actions">
        <button class="secondary-btn" type="button" data-open-list-prospect="${escapeAttribute(company.id)}">Open</button>
        <button class="secondary-btn" type="button" data-remove-from-list="${escapeAttribute(company.id)}" data-list-id="${escapeAttribute(listId)}">Remove</button>
      </div>
    </article>
  `;
}

function renderClientRow(client) {
  const paymentSummary = normalizePaymentSummary(client.paymentSummary, client);
  const paymentTotals = calculatePaymentTotals(paymentSummary, normalizePaymentRecords(client.paymentRecords));
  const paymentStatus = paymentSummary.paymentStatus || suggestPaymentStatus(paymentSummary, paymentTotals);
  return `
    <article class="prospect-row ${client.clientId === state.selectedClientId ? "selected" : ""}">
      <button class="prospect-main" type="button" data-open-client="${escapeAttribute(client.clientId)}">
        <span class="row-title">${escapeHtml(client.businessName || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(client.businessType || "NA")} - ${escapeHtml(client.phone || "No phone")}</span>
        <span class="row-subtitle">Created ${escapeHtml(formatDateOnly(client.createdAt))}</span>
      </button>
      <div class="prospect-fit">
        <span class="stage-chip">${escapeHtml(client.projectStatus || "Client Onboarding")}</span>
        <span class="row-subtitle">${escapeHtml(client.currentClientStatus || "Active Client")}</span>
      </div>
      <div class="prospect-signals">
        <span>${escapeHtml(client.email || "No email")}</span>
        <span>${escapeHtml([client.city, client.state].filter(Boolean).join(", ") || "Location not set")}</span>
        <span>${escapeHtml(paymentStatus)} - Balance ${escapeHtml(formatMoneyValue(paymentTotals.balanceDue) || "$0")}</span>
      </div>
      <div class="prospect-actions">
        <button class="secondary-btn" type="button" data-open-client="${escapeAttribute(client.clientId)}">Open</button>
      </div>
    </article>
  `;
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
  const label = getSearchSummary(filters);
  const entry = {
    id: `search-${Date.now()}`,
    label,
    filters: {
      searchMode: filters.searchMode || DEFAULT_SEARCH_MODE,
      globalSearch: filters.keywordLabel || "",
      keyword: filters.customKeyword || "",
      industry: filters.industry || "",
      city: filters.cityLabel || "",
      state: filters.state || "",
      radius: filters.radius || "",
      source: filters.source || "",
      websiteCondition: filters.websiteCondition || "",
      mobileAppCondition: filters.mobileAppCondition || "",
      bookingSystemCondition: filters.bookingSystemCondition || "",
      onlinePaymentCondition: filters.onlinePaymentCondition || "",
      socialPresenceCondition: filters.socialPresenceCondition || "",
      phoneAvailable: filters.phoneAvailable || "",
      minimumRating: filters.minimumRating || "",
      minimumReviewCount: filters.minimumReviewCount || "",
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
  state.selectedClientId = null;
  elements.detailModal.classList.remove("hidden");
  elements.detailModal.setAttribute("aria-hidden", "false");
  renderDetail();
  render();
}

function closeDetails() {
  elements.detailModal.classList.add("hidden");
  elements.detailModal.setAttribute("aria-hidden", "true");
  state.selectedClientId = null;
}

function renderDetail() {
  if (state.selectedClientId) {
    renderClientDetail();
    return;
  }

  const company = state.companies.find((item) => item.id === state.selectedCompanyId) || null;
  if (company) {
    const linkedClient = getClientByProspect(company);
    if (linkedClient && !company.clientId) {
      company.clientId = linkedClient.clientId;
    }
  }

  renderDetailPanel({
    company,
    activeTab: state.activeDetailTab,
    savedCompanies: state.savedCompanies,
    savedLists: state.savedLists,
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
    onEnrichContactInfo: enrichProspectContactInfo,
    onSaveContactFields: updateProspectContactFields,
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
    onAddProspectToList: addProspectToList,
    onRemoveProspectFromList: removeProspectFromList,
    onConvertToClient: convertProspectToClient,
    onOpenClientProfile: openClientProfile,
  });
}

function renderClientDetail() {
  const client = state.clients.find((item) => item.clientId === state.selectedClientId) || null;
  if (!client) {
    elements.detailContent.innerHTML = `
      <div class="detail-empty">
        <p class="detail-empty-eyebrow">Client profile</p>
        <h2>Client not found</h2>
        <p>The linked client record could not be found in localStorage.</p>
      </div>
    `;
    return;
  }

  client.onboardingChecklist = normalizeOnboardingChecklist(client.onboardingChecklist);
  const onboardingProgress = calculateOnboardingProgress(client.onboardingChecklist);
  const missingCriticalItems = getMissingCriticalItems(client.onboardingChecklist);
  const selectedTab = CLIENT_TABS.includes(state.activeClientTab) ? state.activeClientTab : "overview";
  elements.detailContent.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">Client profile</p>
        <h2 id="detail-modal-title">${escapeHtml(client.businessName || "NA")}</h2>
        <p class="detail-location">${escapeHtml([client.city, client.state].filter(Boolean).join(", ") || client.address || "NA")}</p>
      </div>
      <span class="status-pill status-success"><span class="status-dot"></span>${escapeHtml(client.currentClientStatus || "Active Client")}</span>
    </div>
    <div class="detail-tag-row">
      <span class="detail-tag">${escapeHtml(client.businessType || "Business")}</span>
      <span class="detail-tag">${escapeHtml(client.projectStatus || "Client Onboarding")}</span>
      <span class="detail-tag">Onboarding ${escapeHtml(onboardingProgress.percentage)}%</span>
      <span class="detail-tag">Created ${escapeHtml(formatDateOnly(client.createdAt))}</span>
    </div>
    ${
      missingCriticalItems.length
        ? `<p class="workflow-note">Onboarding has missing critical items.</p>`
        : ""
    }
    <div class="detail-tabs">
      ${CLIENT_TABS.map(
        (tab) => `
          <button class="detail-tab ${selectedTab === tab ? "active" : ""}" type="button" data-client-tab="${escapeAttribute(tab)}">
            ${escapeHtml(titleCase(tab))}
          </button>
        `
      ).join("")}
    </div>
    <div class="detail-body">
      ${renderClientTabContent(client, selectedTab)}
    </div>
  `;

  elements.detailContent.querySelectorAll("[data-client-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeClientTab = button.getAttribute("data-client-tab") || "overview";
      renderDetail();
    });
  });

  const saveButton = elements.detailContent.querySelector("[data-save-client]");
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const clientId = saveButton.getAttribute("data-save-client");
      const payload = readClientFormPayload(elements.detailContent, selectedTab);
      if (selectedTab === "project") {
        updateClientProject(clientId, payload);
      } else if (selectedTab === "handover") {
        updateClientHandover(clientId, payload);
      } else if (selectedTab === "support") {
        updateClientSupport(clientId, payload);
      } else {
        updateClient(clientId, payload);
      }
    });
  }

  elements.detailContent.querySelectorAll("[data-onboarding-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-onboarding-row]");
      updateOnboardingItem(
        client.clientId,
        checkbox.getAttribute("data-onboarding-group"),
        checkbox.getAttribute("data-onboarding-item"),
        {
          checked: checkbox.checked,
          note: row?.querySelector("[data-onboarding-note]")?.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-onboarding-note]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest("[data-onboarding-row]");
      const checkbox = row?.querySelector("[data-onboarding-item]");
      updateOnboardingItem(
        client.clientId,
        input.getAttribute("data-onboarding-group"),
        input.getAttribute("data-onboarding-note"),
        {
          checked: Boolean(checkbox?.checked),
          note: input.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-project-task]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-project-task-row]");
      updateProjectTask(
        client.clientId,
        checkbox.getAttribute("data-project-phase"),
        checkbox.getAttribute("data-project-task"),
        {
          checked: checkbox.checked,
          note: row?.querySelector("[data-project-task-note]")?.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-project-task-note]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest("[data-project-task-row]");
      const checkbox = row?.querySelector("[data-project-task]");
      updateProjectTask(
        client.clientId,
        input.getAttribute("data-project-phase"),
        input.getAttribute("data-project-task-note"),
        {
          checked: Boolean(checkbox?.checked),
          note: input.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-handover-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-handover-row]");
      updateHandoverItem(
        client.clientId,
        checkbox.getAttribute("data-handover-group"),
        checkbox.getAttribute("data-handover-item"),
        {
          checked: checkbox.checked,
          note: row?.querySelector("[data-handover-note]")?.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-handover-note]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest("[data-handover-row]");
      const checkbox = row?.querySelector("[data-handover-item]");
      updateHandoverItem(
        client.clientId,
        input.getAttribute("data-handover-group"),
        input.getAttribute("data-handover-note"),
        {
          checked: Boolean(checkbox?.checked),
          note: input.value || "",
        }
      );
    });
  });

  const addDocumentButton = elements.detailContent.querySelector("[data-add-client-document]");
  if (addDocumentButton) {
    addDocumentButton.addEventListener("click", () => {
      addClientDocument(addDocumentButton.getAttribute("data-add-client-document"), readDocumentFormPayload(elements.detailContent));
    });
  }

  elements.detailContent.querySelectorAll("[data-document-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const row = field.closest("[data-document-row]");
      updateClientDocument(
        client.clientId,
        field.getAttribute("data-document-id"),
        readDocumentRowPayload(row)
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-document-checklist-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-document-checklist-row]");
      updateDocumentChecklistItem(
        client.clientId,
        checkbox.getAttribute("data-document-checklist-item"),
        {
          checked: checkbox.checked,
          note: row?.querySelector("[data-document-checklist-note]")?.value || "",
        }
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-document-checklist-note]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest("[data-document-checklist-row]");
      const checkbox = row?.querySelector("[data-document-checklist-item]");
      updateDocumentChecklistItem(client.clientId, input.getAttribute("data-document-checklist-note"), {
        checked: Boolean(checkbox?.checked),
        note: input.value || "",
      });
    });
  });

  const savePaymentButton = elements.detailContent.querySelector("[data-save-payment-summary]");
  if (savePaymentButton) {
    savePaymentButton.addEventListener("click", () => {
      updatePaymentSummary(
        savePaymentButton.getAttribute("data-save-payment-summary"),
        readPaymentSummaryPayload(elements.detailContent)
      );
    });
  }

  const addPaymentButton = elements.detailContent.querySelector("[data-add-payment-record]");
  if (addPaymentButton) {
    addPaymentButton.addEventListener("click", () => {
      addPaymentRecord(addPaymentButton.getAttribute("data-add-payment-record"), readPaymentRecordFormPayload(elements.detailContent));
    });
  }

  elements.detailContent.querySelectorAll("[data-payment-record-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const row = field.closest("[data-payment-record-row]");
      updatePaymentRecord(
        client.clientId,
        field.getAttribute("data-payment-record-id"),
        readPaymentRecordRowPayload(row)
      );
    });
  });

  const addAccessButton = elements.detailContent.querySelector("[data-add-access-record]");
  if (addAccessButton) {
    addAccessButton.addEventListener("click", () => {
      addClientAccessRecord(addAccessButton.getAttribute("data-add-access-record"), readAccessRecordFormPayload(elements.detailContent));
    });
  }

  elements.detailContent.querySelectorAll("[data-access-record-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const row = field.closest("[data-access-record-row]");
      updateClientAccessRecord(
        client.clientId,
        field.getAttribute("data-access-record-id"),
        readAccessRecordRowPayload(row)
      );
    });
  });

  const addSupportRequestButton = elements.detailContent.querySelector("[data-add-support-request]");
  if (addSupportRequestButton) {
    addSupportRequestButton.addEventListener("click", () => {
      addSupportRequest(
        addSupportRequestButton.getAttribute("data-add-support-request"),
        readSupportRequestFormPayload(elements.detailContent)
      );
    });
  }

  elements.detailContent.querySelectorAll("[data-support-request-field]").forEach((field) => {
    field.addEventListener("change", () => {
      const row = field.closest("[data-support-request-row]");
      updateSupportRequest(
        client.clientId,
        field.getAttribute("data-support-request-id"),
        readSupportRequestRowPayload(row)
      );
    });
  });

  elements.detailContent.querySelectorAll("[data-access-checklist-item]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const row = checkbox.closest("[data-access-checklist-row]");
      updateAccessChecklistItem(client.clientId, checkbox.getAttribute("data-access-checklist-item"), {
        checked: checkbox.checked,
        note: row?.querySelector("[data-access-checklist-note]")?.value || "",
      });
    });
  });

  elements.detailContent.querySelectorAll("[data-access-checklist-note]").forEach((input) => {
    input.addEventListener("change", () => {
      const row = input.closest("[data-access-checklist-row]");
      const checkbox = row?.querySelector("[data-access-checklist-item]");
      updateAccessChecklistItem(client.clientId, input.getAttribute("data-access-checklist-note"), {
        checked: Boolean(checkbox?.checked),
        note: input.value || "",
      });
    });
  });
}

function renderClientTabContent(client, activeTab) {
  if (activeTab === "overview") {
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Overview</p>
        <div class="workflow-form-grid">
          ${renderClientInput("Business name", "businessName", client.businessName)}
          ${renderClientInput("Owner/manager name", "ownerOrManagerName", client.ownerOrManagerName)}
          ${renderClientInput("Phone", "phone", client.phone)}
          ${renderClientInput("Email", "email", client.email, "email")}
          ${renderClientInput("Address", "address", client.address)}
          ${renderClientInput("Business type", "businessType", client.businessType)}
          ${renderClientInput("Website URL", "websiteUrl", client.websiteUrl, "url")}
        </div>
        <textarea class="workflow-textarea" rows="4" data-client-field="notes" placeholder="Client notes">${escapeHtml(client.notes || "")}</textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-save-client="${escapeAttribute(client.clientId)}">Save Overview</button></div>
      </section>
    `;
  }

  if (activeTab === "project") {
    const tracker = normalizeProjectTracker(client.projectTracker);
    const progress = calculateProjectProgress(tracker);
    const health = getProjectHealth(client, tracker);
    const currentPhase = getCurrentProjectPhase(tracker);
    const suggestedStatus = suggestProjectStatus(tracker);
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Project Delivery</p>
            <strong>${escapeHtml(progress.completed)} of ${escapeHtml(progress.total)} tasks complete (${escapeHtml(progress.percentage)}%)</strong>
            <p class="toolbar-subtle">Current phase: ${escapeHtml(currentPhase)}${suggestedStatus && suggestedStatus !== (client.projectStatus || "Client Onboarding") ? ` - Suggested status: ${escapeHtml(suggestedStatus)}` : ""}</p>
          </div>
          <span class="stage-chip">${escapeHtml(health)}</span>
        </div>
        <div class="onboarding-progress" aria-label="Project progress">
          <span style="width: ${escapeAttribute(progress.percentage)}%"></span>
        </div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Project Fields</p>
        <div class="workflow-form-grid">
          <label class="inline-field">
            <span>Project status</span>
            <select data-client-field="projectStatus">
              ${CLIENT_PROJECT_STATUSES.map(
                (status) => `<option value="${escapeAttribute(status)}" ${status === (client.projectStatus || "Client Onboarding") ? "selected" : ""}>${escapeHtml(status)}</option>`
              ).join("")}
            </select>
          </label>
          ${renderClientInput("Project type", "projectType", client.projectType)}
          ${renderClientInput("Package type", "packageType", client.packageType)}
          ${renderClientInput("Start date", "startDate", client.startDate, "date")}
          ${renderClientInput("Target launch date", "targetLaunchDate", client.targetLaunchDate, "date")}
          ${renderClientInput("Actual launch date", "actualLaunchDate", client.actualLaunchDate, "date")}
          ${renderClientInput("Next project action", "nextProjectAction", client.nextProjectAction)}
          <label class="inline-field">
            <span>Is blocked</span>
            <select data-client-field="isBlocked">
              <option value="no" ${!client.isBlocked ? "selected" : ""}>No</option>
              <option value="yes" ${client.isBlocked ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <label class="inline-field">
            <span>Blocked by</span>
            <select data-client-field="blockedBy">
              ${["", "Client", "Internal", "Vendor", "Access", "Payment", "Other"].map(
                (value) => `<option value="${escapeAttribute(value)}" ${value === (client.blockedBy || "") ? "selected" : ""}>${escapeHtml(value || "Not blocked")}</option>`
              ).join("")}
            </select>
          </label>
        </div>
        <textarea class="workflow-textarea" rows="3" data-client-field="currentBlocker" placeholder="Current blocker">${escapeHtml(client.currentBlocker || "")}</textarea>
        <textarea class="workflow-textarea" rows="4" data-client-field="internalNotes" placeholder="Internal project notes">${escapeHtml(client.internalNotes || "")}</textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-save-client="${escapeAttribute(client.clientId)}">Save Project</button></div>
      </section>
      ${tracker.phases.map((phase) => renderProjectPhase(phase)).join("")}
      ${renderClientActivity(client)}
    `;
  }

  if (activeTab === "onboarding") {
    const checklist = normalizeOnboardingChecklist(client.onboardingChecklist);
    const progress = calculateOnboardingProgress(checklist);
    const missingCriticalItems = getMissingCriticalItems(checklist);
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Onboarding</p>
            <strong>${escapeHtml(progress.completed)} of ${escapeHtml(progress.total)} complete (${escapeHtml(progress.percentage)}%)</strong>
            ${
              progress.percentage === 100
                ? `<p class="toolbar-subtle">Onboarding is complete. Consider moving project status to Discovery or Content Collection.</p>`
                : missingCriticalItems.length
                  ? `<p class="toolbar-subtle">Missing critical: ${escapeHtml(missingCriticalItems.slice(0, 4).join(", "))}${missingCriticalItems.length > 4 ? "..." : ""}</p>`
                  : `<p class="toolbar-subtle">Track client materials, access, approvals, and setup before build starts.</p>`
            }
          </div>
          <span class="stage-chip">${escapeHtml(getOnboardingStatus(progress, missingCriticalItems))}</span>
        </div>
        <div class="onboarding-progress" aria-label="Onboarding progress">
          <span style="width: ${escapeAttribute(progress.percentage)}%"></span>
        </div>
      </section>
      ${checklist.groups.map((group) => renderOnboardingGroup(group)).join("")}
    `;
  }

  if (activeTab === "handover") {
    const checklist = normalizeHandoverChecklist(client.handoverChecklist);
    const progress = calculateHandoverProgress(checklist);
    const missingCriticalItems = getMissingCriticalHandoverItems(checklist);
    const handoverStatus = getHandoverStatus(client, progress);
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Handover</p>
            <strong>${escapeHtml(progress.completed)} of ${escapeHtml(progress.total)} complete (${escapeHtml(progress.percentage)}%)</strong>
            ${
              missingCriticalItems.length
                ? `<p class="toolbar-subtle">Missing critical: ${escapeHtml(missingCriticalItems.slice(0, 4).join(", "))}${missingCriticalItems.length > 4 ? "..." : ""}</p>`
                : `<p class="toolbar-subtle">Confirm launch, access, training, deliverables, and support details before closing the project.</p>`
            }
          </div>
          <span class="stage-chip">${escapeHtml(handoverStatus)}</span>
        </div>
        <div class="onboarding-progress" aria-label="Handover progress">
          <span style="width: ${escapeAttribute(progress.percentage)}%"></span>
        </div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Handover Fields</p>
        <div class="workflow-form-grid">
          <label class="inline-field">
            <span>Handover status</span>
            <select data-client-field="handoverStatus">
              ${HANDOVER_STATUSES.map(
                (status) => `<option value="${escapeAttribute(status)}" ${status === (client.handoverStatus || handoverStatus) ? "selected" : ""}>${escapeHtml(status)}</option>`
              ).join("")}
            </select>
          </label>
          ${renderClientInput("Launch date", "handoverLaunchDate", client.handoverLaunchDate || client.actualLaunchDate, "date")}
          ${renderClientInput("Website/live URL", "liveUrl", client.liveUrl || client.websiteUrl, "url")}
          ${renderClientInput("Admin/login URL", "adminUrl", client.adminUrl, "url")}
          ${renderClientInput("Training date", "trainingDate", client.trainingDate, "date")}
          ${renderClientInput("Support start date", "supportStartDate", client.supportStartDate, "date")}
          ${renderClientInput("Support end date", "supportEndDate", client.supportEndDate, "date")}
          ${renderClientInput("Maintenance plan", "maintenancePlan", client.maintenancePlan)}
        </div>
        <textarea class="workflow-textarea" rows="4" data-client-field="handoverNotes" placeholder="Handover notes">${escapeHtml(client.handoverNotes || "")}</textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-save-client="${escapeAttribute(client.clientId)}">Save Handover</button></div>
      </section>
      ${checklist.groups.map((group) => renderHandoverGroup(group)).join("")}
      ${renderClientActivity(client)}
    `;
  }

  if (activeTab === "documents") {
    const checklist = normalizeDocumentChecklist(client.documentChecklist);
    const documents = normalizeClientDocuments(client.documents);
    const progress = calculateDocumentProgress(checklist, documents);
    const overdueDocuments = getOverdueDocuments(documents);
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Documents</p>
            <strong>${escapeHtml(progress.completed)} of ${escapeHtml(progress.totalRequired)} required complete</strong>
            <p class="toolbar-subtle">${escapeHtml(progress.missing)} missing - ${escapeHtml(progress.overdue)} overdue</p>
          </div>
          <span class="stage-chip">${escapeHtml(getDocumentStatus(progress))}</span>
        </div>
        <p class="toolbar-subtle">Do not store sensitive documents or passwords here yet. Use secure storage and record only references until database/file storage is added.</p>
      </section>
      <section class="workflow-card onboarding-group">
        <p class="detail-section-title">Required Documents</p>
        <div class="onboarding-list">
          ${checklist.items.map((item) => renderDocumentChecklistItem(item)).join("")}
        </div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Add Document Reference</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Category</span><select data-new-document-field="category">${DOCUMENT_CATEGORIES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderDocumentInput("Title", "title")}
          <label class="inline-field"><span>Status</span><select data-new-document-field="status">${DOCUMENT_STATUSES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Storage Location</span><select data-new-document-field="storageLocation">${DOCUMENT_STORAGE_LOCATIONS.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderDocumentInput("Link or Reference", "linkOrReference")}
          ${renderDocumentInput("Due Date", "dueDate", "date")}
          ${renderDocumentInput("Received Date", "receivedDate", "date")}
        </div>
        <textarea class="workflow-textarea" rows="3" data-new-document-field="notes" placeholder="Notes"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-client-document="${escapeAttribute(client.clientId)}">Add Document</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Document Records</p>
        ${
          documents.length
            ? `<div class="document-record-list">${documents.map((document) => renderDocumentRecord(document, overdueDocuments)).join("")}</div>`
            : `<p class="toolbar-subtle">No document references added yet.</p>`
        }
      </section>
    `;
  }

  if (activeTab === "payments") {
    const paymentSummary = normalizePaymentSummary(client.paymentSummary, client);
    const paymentRecords = normalizePaymentRecords(client.paymentRecords);
    const totals = calculatePaymentTotals(paymentSummary, paymentRecords);
    const suggestedStatus = suggestPaymentStatus(paymentSummary, totals);
    const quoteSuggestion = getSuggestedPaymentAmountFromQuote(client);
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Payments</p>
            <strong>${escapeHtml(formatMoneyValue(totals.totalReceived) || "$0")} received - ${escapeHtml(formatMoneyValue(totals.balanceDue) || "$0")} balance due</strong>
            <p class="toolbar-subtle">Advance received: ${escapeHtml(formatMoneyValue(totals.advanceReceivedAmount) || "$0")}${quoteSuggestion ? ` - Quote suggestion: ${escapeHtml(formatMoneyValue(quoteSuggestion))}` : ""}</p>
          </div>
          <span class="stage-chip">${escapeHtml(getPaymentStatusChip(paymentSummary.paymentStatus || suggestedStatus))}</span>
        </div>
        <p class="toolbar-subtle">Do not store sensitive bank/card details here. Track payment references only.</p>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Payment Summary</p>
        <div class="workflow-form-grid">
          ${renderPaymentInput("Project amount", "quotedAmount", paymentSummary.quotedAmount)}
          ${renderPaymentInput("Discount", "discountAmount", paymentSummary.discountAmount)}
          ${renderPaymentInput("Final agreed amount", "finalAgreedAmount", paymentSummary.finalAgreedAmount)}
          ${renderPaymentInput("Advance required", "advanceRequiredAmount", paymentSummary.advanceRequiredAmount)}
          <label class="inline-field"><span>Advance received</span><input type="text" value="${escapeAttribute(formatMoneyValue(totals.advanceReceivedAmount) || "0")}" readonly /></label>
          <label class="inline-field"><span>Balance due</span><input type="text" value="${escapeAttribute(formatMoneyValue(totals.balanceDue) || "0")}" readonly /></label>
          <label class="inline-field">
            <span>Payment status</span>
            <select data-payment-summary-field="paymentStatus">
              ${PAYMENT_STATUSES.map((status) => `<option value="${escapeAttribute(status)}" ${status === (paymentSummary.paymentStatus || suggestedStatus) ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
            </select>
          </label>
          ${renderPaymentInput("Payment terms", "paymentTerms", paymentSummary.paymentTerms, "text")}
        </div>
        <textarea class="workflow-textarea" rows="3" data-payment-summary-field="paymentNotes" placeholder="Maintenance/support payment notes">${escapeHtml(paymentSummary.paymentNotes || "")}</textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-save-payment-summary="${escapeAttribute(client.clientId)}">Save Payment Summary</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Add Payment Record</p>
        <div class="workflow-form-grid">
          ${renderPaymentRecordInput("Date", "paymentDate", "date")}
          ${renderPaymentRecordInput("Amount", "amount")}
          <label class="inline-field"><span>Method</span><select data-new-payment-field="paymentMethod">${PAYMENT_METHODS.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Type</span><select data-new-payment-field="paymentType">${PAYMENT_TYPES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Status</span><select data-new-payment-field="status">${PAYMENT_RECORD_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === "Received" ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderPaymentRecordInput("Receipt/reference", "receiptReference")}
          <label class="inline-field"><span>Storage Location</span><select data-new-payment-field="storageLocation">${PAYMENT_STORAGE_LOCATIONS.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
        </div>
        <textarea class="workflow-textarea" rows="3" data-new-payment-field="notes" placeholder="Notes"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-payment-record="${escapeAttribute(client.clientId)}">Add Payment</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Payment Records</p>
        ${
          paymentRecords.length
            ? `<div class="document-record-list">${paymentRecords.map((payment) => renderPaymentRecord(payment)).join("")}</div>`
            : `<p class="toolbar-subtle">No payment records added yet.</p>`
        }
      </section>
    `;
  }

  if (activeTab === "credentials") {
    const accessChecklist = normalizeAccessChecklist(client.accessChecklist);
    const accessRecords = normalizeAccessRecords(client.accessRecords);
    const progress = calculateAccessProgress(accessChecklist, accessRecords);
    const blockedRecords = accessRecords.filter((record) => record.accessStatus === "Blocked");
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Credentials & Access</p>
            <strong>${escapeHtml(progress.receivedVerified)} of ${escapeHtml(progress.totalRequired)} required access items ready</strong>
            <p class="toolbar-subtle">${escapeHtml(progress.missing)} missing - ${escapeHtml(progress.blocked)} blocked</p>
          </div>
          <span class="stage-chip">${escapeHtml(getAccessStatus(progress))}</span>
        </div>
        <p class="toolbar-subtle">Do not store raw passwords here. Store only access status, username/email, and secure storage reference such as 1Password, Google Password Manager, email, or client-provided secure link.</p>
      </section>
      <section class="workflow-card onboarding-group">
        <p class="detail-section-title">Required Access</p>
        <div class="onboarding-list">
          ${accessChecklist.items.map((item) => renderAccessChecklistItem(item)).join("")}
        </div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Add Access Reference</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Category</span><select data-new-access-field="category">${ACCESS_CATEGORIES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderAccessInput("Platform Name", "platformName")}
          ${renderAccessInput("Login URL", "loginUrl", "url")}
          ${renderAccessInput("Username/Email", "usernameOrEmail", "email")}
          <label class="inline-field"><span>Access Status</span><select data-new-access-field="accessStatus">${ACCESS_STATUSES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Permission Level</span><select data-new-access-field="permissionLevel">${ACCESS_PERMISSION_LEVELS.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Secure Storage Reference</span><select data-new-access-field="secureStorageReference">${ACCESS_STORAGE_REFERENCES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderAccessInput("Owner Contact", "ownerContact")}
          ${renderAccessInput("Requested Date", "requestedDate", "date")}
          ${renderAccessInput("Received Date", "receivedDate", "date")}
          ${renderAccessInput("Last Verified Date", "lastVerifiedDate", "date")}
        </div>
        <textarea class="workflow-textarea" rows="3" data-new-access-field="notes" placeholder="Notes, blocker reason, or secure handover context"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-access-record="${escapeAttribute(client.clientId)}">Add Access</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Access Records</p>
        ${
          blockedRecords.length
            ? `<p class="workflow-note">Blocked access needs attention.</p>`
            : ""
        }
        ${
          accessRecords.length
            ? `<div class="document-record-list">${accessRecords.map((record) => renderAccessRecord(record)).join("")}</div>`
            : `<p class="toolbar-subtle">No access references added yet.</p>`
        }
      </section>
    `;
  }

  if (activeTab === "support") {
    const supportPlan = normalizeSupportPlan(client.supportPlan, client);
    const supportRequests = normalizeSupportRequests(client.supportRequests);
    const summary = calculateSupportSummary({ ...client, supportPlan, supportRequests });
    return `
      <section class="workflow-card">
        <div class="onboarding-summary">
          <div>
            <p class="detail-section-title">Support</p>
            <strong>${escapeHtml(summary.openRequests)} open request${summary.openRequests === 1 ? "" : "s"} - ${escapeHtml(summary.urgentHighPriority)} high priority</strong>
            <p class="toolbar-subtle">${escapeHtml(summary.overdueRequests)} overdue - Renewal: ${escapeHtml(summary.renewalStatus)}</p>
          </div>
          <span class="stage-chip">${escapeHtml(supportPlan.supportStatus || "Not Started")}</span>
        </div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Support Plan</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Support status</span><select data-client-field="supportStatus">${SUPPORT_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === supportPlan.supportStatus ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Maintenance plan</span><select data-client-field="maintenancePlan">${MAINTENANCE_PLANS.map((value) => `<option value="${escapeAttribute(value)}" ${value === supportPlan.maintenancePlan ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderClientInput("Monthly support amount", "monthlySupportAmount", supportPlan.monthlySupportAmount)}
          ${renderClientInput("Support start date", "supportStartDate", supportPlan.supportStartDate, "date")}
          ${renderClientInput("Support end/renewal date", "supportEndDate", supportPlan.supportEndDate, "date")}
          ${renderClientInput("Renewal reminder date", "renewalReminderDate", supportPlan.renewalReminderDate, "date")}
        </div>
        <textarea class="workflow-textarea" rows="3" data-client-field="supportNotes" placeholder="Support notes">${escapeHtml(supportPlan.supportNotes || "")}</textarea>
        ${
          supportPlan.supportStatus === "Active" && summary.handoverCompleted && (client.projectStatus || "") !== "Maintenance"
            ? `<p class="workflow-note">Suggested project status: Maintenance</p>`
            : ""
        }
        <div class="workflow-actions"><button class="primary-btn" type="button" data-save-client="${escapeAttribute(client.clientId)}">Save Support Plan</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Add Support Request</p>
        <div class="workflow-form-grid">
          ${renderSupportRequestInput("Title", "title")}
          <label class="inline-field"><span>Request Type</span><select data-new-support-request-field="requestType">${SUPPORT_REQUEST_TYPES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Priority</span><select data-new-support-request-field="priority">${SUPPORT_PRIORITIES.map((value) => `<option value="${escapeAttribute(value)}" ${value === "Normal" ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Status</span><select data-new-support-request-field="status">${SUPPORT_REQUEST_STATUSES.map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>
          ${renderSupportRequestInput("Requested Date", "requestedDate", "date")}
          ${renderSupportRequestInput("Target Date", "targetDate", "date")}
          ${renderSupportRequestInput("Completed Date", "completedDate", "date")}
        </div>
        <textarea class="workflow-textarea" rows="3" data-new-support-request-field="notes" placeholder="Notes"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-support-request="${escapeAttribute(client.clientId)}">Add Support Request</button></div>
      </section>
      <section class="workflow-card">
        <p class="detail-section-title">Support Requests</p>
        ${
          supportRequests.length
            ? `<div class="document-record-list">${supportRequests.map((request) => renderSupportRequest(request)).join("")}</div>`
            : `<p class="toolbar-subtle">No support requests added yet.</p>`
        }
      </section>
      ${renderClientActivity(client)}
    `;
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">${escapeHtml(titleCase(activeTab))}</p>
      <p class="toolbar-subtle">No additional client fields are available for this section.</p>
    </section>
  `;
}

function renderOnboardingGroup(group) {
  return `
    <section class="workflow-card onboarding-group">
      <p class="detail-section-title">${escapeHtml(group.title)}</p>
      <div class="onboarding-list">
        ${group.items
          .map(
            (item) => `
              <div class="onboarding-item" data-onboarding-row>
                <label class="onboarding-check">
                  <input
                    type="checkbox"
                    ${item.checked ? "checked" : ""}
                    data-onboarding-group="${escapeAttribute(group.key)}"
                    data-onboarding-item="${escapeAttribute(item.key)}"
                  />
                  <span>
                    ${escapeHtml(item.label)}
                    ${item.critical ? `<em>Critical</em>` : ""}
                  </span>
                </label>
                <input
                  type="text"
                  value="${escapeAttribute(item.note || "")}"
                  placeholder="Note"
                  data-onboarding-group="${escapeAttribute(group.key)}"
                  data-onboarding-note="${escapeAttribute(item.key)}"
                />
                <small>${escapeHtml(item.updatedAt ? `Updated ${formatDateOnly(item.updatedAt)}` : "Not updated")}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderProjectPhase(phase) {
  return `
    <section class="workflow-card onboarding-group">
      <p class="detail-section-title">${escapeHtml(phase.title)}</p>
      <div class="onboarding-list">
        ${phase.items
          .map(
            (item) => `
              <div class="onboarding-item" data-project-task-row>
                <label class="onboarding-check">
                  <input
                    type="checkbox"
                    ${item.checked ? "checked" : ""}
                    data-project-phase="${escapeAttribute(phase.key)}"
                    data-project-task="${escapeAttribute(item.key)}"
                  />
                  <span>${escapeHtml(item.label)}</span>
                </label>
                <input
                  type="text"
                  value="${escapeAttribute(item.note || "")}"
                  placeholder="Note"
                  data-project-phase="${escapeAttribute(phase.key)}"
                  data-project-task-note="${escapeAttribute(item.key)}"
                />
                <small>${escapeHtml(item.updatedAt ? `Updated ${formatDateOnly(item.updatedAt)}` : "Not updated")}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderHandoverGroup(group) {
  const securityNote =
    group.key === "clientAccess"
      ? `<p class="toolbar-subtle">Do not store raw passwords here. Store password references or secure handover notes only.</p>`
      : "";

  return `
    <section class="workflow-card onboarding-group">
      <p class="detail-section-title">${escapeHtml(group.title)}</p>
      ${securityNote}
      <div class="onboarding-list">
        ${group.items
          .map(
            (item) => `
              <div class="onboarding-item" data-handover-row>
                <label class="onboarding-check">
                  <input
                    type="checkbox"
                    ${item.checked ? "checked" : ""}
                    data-handover-group="${escapeAttribute(group.key)}"
                    data-handover-item="${escapeAttribute(item.key)}"
                  />
                  <span>
                    ${escapeHtml(item.label)}
                    ${item.critical ? `<em>Critical</em>` : ""}
                  </span>
                </label>
                <input
                  type="text"
                  value="${escapeAttribute(item.note || "")}"
                  placeholder="Note"
                  data-handover-group="${escapeAttribute(group.key)}"
                  data-handover-note="${escapeAttribute(item.key)}"
                />
                <small>${escapeHtml(item.updatedAt ? `Updated ${formatDateOnly(item.updatedAt)}` : "Not updated")}</small>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderClientActivity(client) {
  const activity = Array.isArray(client.activity) ? client.activity.slice(0, 8) : [];
  if (!activity.length) {
    return "";
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Project Activity</p>
      <div class="activity-list">
        ${activity
          .map(
            (entry) => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <div>
                  <p>${escapeHtml(formatDateOnly(entry.createdAt))} - ${escapeHtml(entry.source || "Project")}</p>
                  <strong>${escapeHtml(entry.message || "Project updated")}</strong>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderDocumentChecklistItem(item) {
  return `
    <div class="onboarding-item" data-document-checklist-row>
      <label class="onboarding-check">
        <input
          type="checkbox"
          ${item.checked ? "checked" : ""}
          data-document-checklist-item="${escapeAttribute(item.key)}"
        />
        <span>${escapeHtml(item.label)}</span>
      </label>
      <input
        type="text"
        value="${escapeAttribute(item.note || "")}"
        placeholder="Note"
        data-document-checklist-note="${escapeAttribute(item.key)}"
      />
      <small>${escapeHtml(item.updatedAt ? `Updated ${formatDateOnly(item.updatedAt)}` : "Not updated")}</small>
    </div>
  `;
}

function renderDocumentInput(label, field, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" data-new-document-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function renderDocumentRecord(document, overdueDocuments = []) {
  const isOverdue = overdueDocuments.some((item) => item.documentId === document.documentId);
  return `
    <div class="document-record ${isOverdue ? "overdue" : ""}" data-document-row="${escapeAttribute(document.documentId)}">
      <div class="document-record-top">
        <div>
          <strong>${escapeHtml(document.title || "Untitled document")}</strong>
          <p class="toolbar-subtle">${escapeHtml(document.category || "Other")} ${isOverdue ? "- Overdue" : ""}</p>
        </div>
        <span class="stage-chip">${escapeHtml(document.status || "Needed")}</span>
      </div>
      <div class="workflow-form-grid">
        <label class="inline-field"><span>Status</span><select data-document-id="${escapeAttribute(document.documentId)}" data-document-field="status">${DOCUMENT_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === document.status ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Storage Location</span><select data-document-id="${escapeAttribute(document.documentId)}" data-document-field="storageLocation">${DOCUMENT_STORAGE_LOCATIONS.map((value) => `<option value="${escapeAttribute(value)}" ${value === document.storageLocation ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Link or Reference</span><input type="text" value="${escapeAttribute(document.linkOrReference || "")}" data-document-id="${escapeAttribute(document.documentId)}" data-document-field="linkOrReference" /></label>
        <label class="inline-field"><span>Due Date</span><input type="date" value="${escapeAttribute(document.dueDate || "")}" data-document-id="${escapeAttribute(document.documentId)}" data-document-field="dueDate" /></label>
        <label class="inline-field"><span>Received Date</span><input type="date" value="${escapeAttribute(document.receivedDate || "")}" data-document-id="${escapeAttribute(document.documentId)}" data-document-field="receivedDate" /></label>
      </div>
      <textarea class="workflow-textarea" rows="2" data-document-id="${escapeAttribute(document.documentId)}" data-document-field="notes" placeholder="Notes">${escapeHtml(document.notes || "")}</textarea>
    </div>
  `;
}

function renderPaymentInput(label, field, value, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" value="${escapeAttribute(value || "")}" data-payment-summary-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function renderPaymentRecordInput(label, field, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" data-new-payment-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function renderPaymentRecord(payment) {
  return `
    <div class="document-record" data-payment-record-row="${escapeAttribute(payment.paymentId)}">
      <div class="document-record-top">
        <div>
          <strong>${escapeHtml(formatMoneyValue(payment.amount) || "$0")} - ${escapeHtml(payment.paymentType || "Other")}</strong>
          <p class="toolbar-subtle">${escapeHtml(payment.paymentDate || "No date")} - ${escapeHtml(payment.paymentMethod || "Other")} - ${escapeHtml(payment.receiptReference || "No receipt reference")}</p>
        </div>
        <span class="stage-chip">${escapeHtml(payment.status || "Expected")}</span>
      </div>
      <div class="workflow-form-grid">
        <label class="inline-field"><span>Status</span><select data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="status">${PAYMENT_RECORD_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === payment.status ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Amount</span><input type="text" value="${escapeAttribute(payment.amount || "")}" data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="amount" /></label>
        <label class="inline-field"><span>Date</span><input type="date" value="${escapeAttribute(payment.paymentDate || "")}" data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="paymentDate" /></label>
        <label class="inline-field"><span>Method</span><select data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="paymentMethod">${PAYMENT_METHODS.map((value) => `<option value="${escapeAttribute(value)}" ${value === payment.paymentMethod ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Type</span><select data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="paymentType">${PAYMENT_TYPES.map((value) => `<option value="${escapeAttribute(value)}" ${value === payment.paymentType ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Receipt/reference</span><input type="text" value="${escapeAttribute(payment.receiptReference || "")}" data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="receiptReference" /></label>
        <label class="inline-field"><span>Storage Location</span><select data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="storageLocation">${PAYMENT_STORAGE_LOCATIONS.map((value) => `<option value="${escapeAttribute(value)}" ${value === payment.storageLocation ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
      </div>
      <textarea class="workflow-textarea" rows="2" data-payment-record-id="${escapeAttribute(payment.paymentId)}" data-payment-record-field="notes" placeholder="Notes">${escapeHtml(payment.notes || "")}</textarea>
    </div>
  `;
}

function renderAccessChecklistItem(item) {
  return `
    <div class="onboarding-item" data-access-checklist-row>
      <label class="onboarding-check">
        <input
          type="checkbox"
          ${item.checked ? "checked" : ""}
          data-access-checklist-item="${escapeAttribute(item.key)}"
        />
        <span>${escapeHtml(item.label)}</span>
      </label>
      <input
        type="text"
        value="${escapeAttribute(item.note || "")}"
        placeholder="Note"
        data-access-checklist-note="${escapeAttribute(item.key)}"
      />
      <small>${escapeHtml(item.updatedAt ? `Updated ${formatDateOnly(item.updatedAt)}` : "Not updated")}</small>
    </div>
  `;
}

function renderAccessInput(label, field, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" data-new-access-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function renderAccessRecord(record) {
  return `
    <div class="document-record ${record.accessStatus === "Blocked" ? "overdue" : ""}" data-access-record-row="${escapeAttribute(record.accessId)}">
      <div class="document-record-top">
        <div>
          <strong>${escapeHtml(record.platformName || record.category || "Access reference")}</strong>
          <p class="toolbar-subtle">${escapeHtml(record.category || "Other")} - ${escapeHtml(record.permissionLevel || "Unknown")} - ${escapeHtml(record.secureStorageReference || "Not stored")}</p>
        </div>
        <span class="stage-chip">${escapeHtml(record.accessStatus || "Needed")}</span>
      </div>
      <div class="workflow-form-grid">
        <label class="inline-field"><span>Status</span><select data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="accessStatus">${ACCESS_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === record.accessStatus ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Permission</span><select data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="permissionLevel">${ACCESS_PERMISSION_LEVELS.map((value) => `<option value="${escapeAttribute(value)}" ${value === record.permissionLevel ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Login URL</span><input type="url" value="${escapeAttribute(record.loginUrl || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="loginUrl" /></label>
        <label class="inline-field"><span>Username/Email</span><input type="text" value="${escapeAttribute(record.usernameOrEmail || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="usernameOrEmail" /></label>
        <label class="inline-field"><span>Storage Reference</span><select data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="secureStorageReference">${ACCESS_STORAGE_REFERENCES.map((value) => `<option value="${escapeAttribute(value)}" ${value === record.secureStorageReference ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Owner Contact</span><input type="text" value="${escapeAttribute(record.ownerContact || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="ownerContact" /></label>
        <label class="inline-field"><span>Requested Date</span><input type="date" value="${escapeAttribute(record.requestedDate || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="requestedDate" /></label>
        <label class="inline-field"><span>Received Date</span><input type="date" value="${escapeAttribute(record.receivedDate || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="receivedDate" /></label>
        <label class="inline-field"><span>Last Verified</span><input type="date" value="${escapeAttribute(record.lastVerifiedDate || "")}" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="lastVerifiedDate" /></label>
      </div>
      <textarea class="workflow-textarea" rows="2" data-access-record-id="${escapeAttribute(record.accessId)}" data-access-record-field="notes" placeholder="Notes">${escapeHtml(record.notes || "")}</textarea>
    </div>
  `;
}

function renderSupportRequestInput(label, field, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" data-new-support-request-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function renderSupportRequest(request) {
  const isOverdue = isSupportRequestOverdue(request);
  return `
    <div class="document-record ${isOverdue ? "overdue" : ""}" data-support-request-row="${escapeAttribute(request.requestId)}">
      <div class="document-record-top">
        <div>
          <strong>${escapeHtml(request.title || "Untitled support request")}</strong>
          <p class="toolbar-subtle">${escapeHtml(request.requestType || "Other")} - ${escapeHtml(request.priority || "Normal")}${isOverdue ? " - Overdue" : ""}</p>
        </div>
        <span class="stage-chip">${escapeHtml(request.status || "New")}</span>
      </div>
      <div class="workflow-form-grid">
        <label class="inline-field"><span>Request Type</span><select data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="requestType">${SUPPORT_REQUEST_TYPES.map((value) => `<option value="${escapeAttribute(value)}" ${value === request.requestType ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Priority</span><select data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="priority">${SUPPORT_PRIORITIES.map((value) => `<option value="${escapeAttribute(value)}" ${value === request.priority ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Status</span><select data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="status">${SUPPORT_REQUEST_STATUSES.map((value) => `<option value="${escapeAttribute(value)}" ${value === request.status ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
        <label class="inline-field"><span>Requested Date</span><input type="date" value="${escapeAttribute(request.requestedDate || "")}" data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="requestedDate" /></label>
        <label class="inline-field"><span>Target Date</span><input type="date" value="${escapeAttribute(request.targetDate || "")}" data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="targetDate" /></label>
        <label class="inline-field"><span>Completed Date</span><input type="date" value="${escapeAttribute(request.completedDate || "")}" data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="completedDate" /></label>
      </div>
      <textarea class="workflow-textarea" rows="2" data-support-request-id="${escapeAttribute(request.requestId)}" data-support-request-field="notes" placeholder="Notes">${escapeHtml(request.notes || "")}</textarea>
    </div>
  `;
}

function renderClientInput(label, field, value, type = "text") {
  return `
    <label class="inline-field">
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" value="${escapeAttribute(value || "")}" data-client-field="${escapeAttribute(field)}" />
    </label>
  `;
}

function readDocumentFormPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-new-document-field]").forEach((field) => {
    payload[field.getAttribute("data-new-document-field")] = field.value || "";
  });
  return payload;
}

function readDocumentRowPayload(row) {
  const payload = {};
  row?.querySelectorAll("[data-document-field]").forEach((field) => {
    payload[field.getAttribute("data-document-field")] = field.value || "";
  });
  return payload;
}

function readPaymentSummaryPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-payment-summary-field]").forEach((field) => {
    payload[field.getAttribute("data-payment-summary-field")] = field.value || "";
  });
  return payload;
}

function readPaymentRecordFormPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-new-payment-field]").forEach((field) => {
    payload[field.getAttribute("data-new-payment-field")] = field.value || "";
  });
  return payload;
}

function readPaymentRecordRowPayload(row) {
  const payload = {};
  row?.querySelectorAll("[data-payment-record-field]").forEach((field) => {
    payload[field.getAttribute("data-payment-record-field")] = field.value || "";
  });
  return payload;
}

function readAccessRecordFormPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-new-access-field]").forEach((field) => {
    payload[field.getAttribute("data-new-access-field")] = field.value || "";
  });
  return payload;
}

function readAccessRecordRowPayload(row) {
  const payload = {};
  row?.querySelectorAll("[data-access-record-field]").forEach((field) => {
    payload[field.getAttribute("data-access-record-field")] = field.value || "";
  });
  return payload;
}

function readSupportRequestFormPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-new-support-request-field]").forEach((field) => {
    payload[field.getAttribute("data-new-support-request-field")] = field.value || "";
  });
  return payload;
}

function readSupportRequestRowPayload(row) {
  const payload = {};
  row?.querySelectorAll("[data-support-request-field]").forEach((field) => {
    payload[field.getAttribute("data-support-request-field")] = field.value || "";
  });
  return payload;
}

function readClientFormPayload(container, activeTab) {
  const payload = {};
  container.querySelectorAll("[data-client-field]").forEach((field) => {
    payload[field.getAttribute("data-client-field")] = field.value || "";
  });

  if (activeTab === "project") {
    payload.projectStatus = CLIENT_PROJECT_STATUSES.includes(payload.projectStatus)
      ? payload.projectStatus
      : "Client Onboarding";
    payload.isBlocked = payload.isBlocked === "yes";
  }

  if (activeTab === "handover") {
    payload.handoverStatus = HANDOVER_STATUSES.includes(payload.handoverStatus)
      ? payload.handoverStatus
      : "Not Started";
  }

  if (activeTab === "support") {
    payload.supportStatus = SUPPORT_STATUSES.includes(payload.supportStatus) ? payload.supportStatus : "Not Started";
    payload.maintenancePlan = MAINTENANCE_PLANS.includes(payload.maintenancePlan) ? payload.maintenancePlan : "None";
  }

  return payload;
}

function handleDetailTabChange(tab) {
  state.activeDetailTab = tab;
  renderDetail();
}

async function toggleSavedCompany(companyId) {
  if (!companyId) {
    return;
  }

  const company = state.companies.find((item) => item.id === companyId) || state.manualProspects.find((item) => item.id === companyId);
  if (!company) {
    elements.statusMessage.textContent = "Prospect was not found.";
    return;
  }

  const existingSavedId = findSavedProspectId(company);
  const targetCompany =
    (existingSavedId && (state.companies.find((item) => item.id === existingSavedId) || state.manualProspects.find((item) => item.id === existingSavedId))) ||
    company;
  const snapshot = upsertSavedProspectSnapshot(targetCompany);
  const savedId = existingSavedId || snapshot.id || companyId;
  const wasAlreadySaved = Boolean(existingSavedId);

  state.savedCompanies = [...new Set([...state.savedCompanies.filter((id) => id !== companyId || id === savedId), savedId])];
  ensureProspectWorkflow(savedId, snapshot);
  ensureSavedProspect(snapshot);
  state.selectedCompanyId = savedId;

  if (!wasAlreadySaved) {
    recordProspectActivity(savedId, "Saved to prospects", "User", "save");
  }

  await persistSavedProspectRecord(savedId);
  elements.statusMessage.textContent = wasAlreadySaved
    ? `${snapshot.name || "Prospect"} is already saved. Open the saved prospect to continue tracking.`
    : `Saved ${snapshot.name || "prospect"}. Set a follow-up to add it to today's action workflow.`;

  persistSavedCompanies();
  state.companies = augmentCompaniesWithScannerData(mergeManualProspects(state.companies, state.manualProspects));
  updateSummary();
  applyFilters();
  renderDetail();
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
      persistSavedProspectArchiveState(company, true);
      elements.statusMessage.textContent = "Prospect archived.";
    } else {
      state.hiddenProspects = state.hiddenProspects.filter(
        (entry) => !normalizedHiddenKeys.has(normalizeText(entry)) && normalizeText(entry) !== normalizeText(company.id)
      );
      persistHiddenProspects();
      persistSavedProspectArchiveState(company, false);
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
    nextAction: getSuggestedPipelineAction(company),
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

function convertProspectToClient(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  const existingClient = getClientByProspect(company);
  if (existingClient) {
    linkProspectToClient(company, existingClient.clientId);
    elements.statusMessage.textContent = "This prospect is already linked to a client profile.";
    openClientProfile(existingClient.clientId);
    return;
  }

  if (!isProspectEligibleForClientConversion(company)) {
    elements.statusMessage.textContent = "Client conversion is available after quote acceptance or contract progress.";
    return;
  }

  const client = createClientFromProspect(company);
  state.clients = [client, ...state.clients];
  saveClients();
  linkProspectToClient(company, client.clientId);
  recordProspectActivity(company.id, "Converted to client", "Manual", "converted-to-client");
  elements.statusMessage.textContent = `Created client profile for ${client.businessName || "client"}.`;
  openClientProfile(client.clientId);
}

function linkProspectToClient(company, clientId) {
  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(company.id);
  const currentStage = normalizeProspectStage(
    workflow.currentStage || workflow.prospect_stage || company.prospect_stage || company.stage || "New Lead"
  );
  const nextStage = applyStageUpdate(currentStage, "Client Converted");
  const now = new Date().toISOString();
  state.prospectWorkflows[company.id] = {
    ...workflow,
    clientId,
    currentStage: nextStage,
    prospect_stage: nextStage,
    stageUpdateSource: nextStage !== currentStage ? "client-conversion" : workflow.stageUpdateSource || "",
    stageUpdatedAt: nextStage !== currentStage ? now : workflow.stageUpdatedAt || "",
    updated_at: now,
    lastUpdatedAt: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
}

function openClientProfile(clientId) {
  const client = state.clients.find((item) => item.clientId === clientId);
  if (!client) {
    elements.statusMessage.textContent = "Client profile was not found.";
    return;
  }

  state.selectedClientId = client.clientId;
  state.selectedCompanyId = null;
  state.activeClientTab = "overview";
  elements.detailModal.classList.remove("hidden");
  elements.detailModal.setAttribute("aria-hidden", "false");
  render();
}

function updateClient(clientId, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) =>
    client.clientId === clientId
      ? {
          ...client,
          ...updates,
          currentClientStatus: updates.currentClientStatus || client.currentClientStatus || "Active Client",
          projectStatus: updates.projectStatus || client.projectStatus || "Client Onboarding",
          updatedAt: now,
        }
      : client
  );
  saveClients();
  elements.statusMessage.textContent = "Client profile saved.";
  render();
}

function updateClientProject(clientId, updates = {}) {
  const existing = state.clients.find((client) => client.clientId === clientId);
  if (!existing) {
    return;
  }

  const nextUpdates = { ...updates };
  if (nextUpdates.isBlocked && nextUpdates.projectStatus !== "Blocked") {
    const confirmed = window.confirm("Mark this project status as Blocked?");
    if (confirmed) {
      nextUpdates.projectStatus = "Blocked";
      nextUpdates.activity = addClientActivity(existing, "Project moved to Blocked");
    }
  }

  updateClient(clientId, nextUpdates);
}

function updateClientHandover(clientId, updates = {}) {
  const existing = state.clients.find((client) => client.clientId === clientId);
  if (!existing) {
    return;
  }

  const nextUpdates = { ...updates };
  if (nextUpdates.handoverStatus === "Support Started") {
    nextUpdates.projectStatus = "Maintenance";
    nextUpdates.activity = addClientActivity(existing, "Support period started", "Handover");
  }

  updateClient(clientId, nextUpdates);
}

function updateClientSupport(clientId, updates = {}) {
  const now = new Date().toISOString();
  const existing = state.clients.find((client) => client.clientId === clientId);
  if (!existing) {
    return;
  }

  const previousPlan = normalizeSupportPlan(existing.supportPlan, existing);
  const nextPlan = normalizeSupportPlan({ ...previousPlan, ...updates }, existing);
  const previousRenewalStatus = getSupportRenewalStatus(previousPlan);
  const renewalStatus = getSupportRenewalStatus(nextPlan);
  let activity = existing.activity || [];

  if (previousPlan.supportStatus !== "Active" && nextPlan.supportStatus === "Active") {
    activity = addClientActivity({ ...existing, activity }, "Support plan started", "Support");
  } else if (previousPlan.supportStatus !== "Cancelled" && nextPlan.supportStatus === "Cancelled") {
    activity = addClientActivity({ ...existing, activity }, "Support cancelled", "Support");
  } else if (
    previousRenewalStatus !== "Renewal Due" &&
    previousRenewalStatus !== "Renewal Overdue" &&
    (nextPlan.supportStatus === "Renewal Due" || renewalStatus === "Renewal Due" || renewalStatus === "Renewal Overdue")
  ) {
    activity = addClientActivity({ ...existing, activity }, "Renewal due", "Support");
  }

  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    return {
      ...client,
      supportPlan: nextPlan,
      supportStatus: nextPlan.supportStatus,
      maintenancePlan: nextPlan.maintenancePlan,
      monthlySupportAmount: nextPlan.monthlySupportAmount,
      supportStartDate: nextPlan.supportStartDate,
      supportEndDate: nextPlan.supportEndDate,
      renewalReminderDate: nextPlan.renewalReminderDate,
      supportNotes: nextPlan.supportNotes,
      projectStatus: client.projectStatus || "Client Onboarding",
      activity,
      updatedAt: now,
    };
  });
  saveClients();
  elements.statusMessage.textContent = "Support plan saved.";
  render();
}

function addSupportRequest(clientId, payload = {}) {
  const now = new Date().toISOString();
  const request = getDefaultSupportRequest(payload);
  if (!request.title) {
    elements.statusMessage.textContent = "Enter a support request title before adding.";
    return;
  }

  state.clients = state.clients.map((client) =>
    client.clientId === clientId
      ? {
          ...client,
          supportRequests: [request, ...normalizeSupportRequests(client.supportRequests)],
          activity: addClientActivity(client, `Support request added: ${request.title}`, "Support"),
          updatedAt: now,
        }
      : client
  );
  saveClients();
  elements.statusMessage.textContent = "Support request added.";
  renderDetail();
}

function updateSupportRequest(clientId, requestId, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const requests = normalizeSupportRequests(client.supportRequests);
    const existingRequest = requests.find((request) => request.requestId === requestId);
    const nextRequests = requests.map((request) =>
      request.requestId === requestId
        ? {
            ...request,
            ...updates,
            requestType: SUPPORT_REQUEST_TYPES.includes(updates.requestType) ? updates.requestType : request.requestType,
            priority: SUPPORT_PRIORITIES.includes(updates.priority) ? updates.priority : request.priority,
            status: SUPPORT_REQUEST_STATUSES.includes(updates.status) ? updates.status : request.status,
            completedDate:
              updates.status === "Completed" && !updates.completedDate && !request.completedDate
                ? getTodayDateKey()
                : updates.completedDate || request.completedDate,
            updatedAt: now,
          }
        : request
    );
    const nextRequest = nextRequests.find((request) => request.requestId === requestId);
    const completedNow =
      existingRequest &&
      nextRequest &&
      existingRequest.status !== "Completed" &&
      nextRequest.status === "Completed";
    const activity = completedNow
      ? addClientActivity(client, `Support request completed: ${nextRequest.title}`, "Support")
      : client.activity || [];

    return {
      ...client,
      supportRequests: nextRequests,
      activity,
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function updateOnboardingItem(clientId, groupKey, itemKey, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const checklist = normalizeOnboardingChecklist(client.onboardingChecklist);
    const nextChecklist = {
      ...checklist,
      groups: checklist.groups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              items: group.items.map((item) =>
                item.key === itemKey
                  ? {
                      ...item,
                      checked: Boolean(updates.checked),
                      note: String(updates.note || "").trim(),
                      updatedAt: now,
                    }
                  : item
              ),
            }
          : group
      ),
    };

    return {
      ...client,
      onboardingChecklist: nextChecklist,
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function updateProjectTask(clientId, phaseKey, taskKey, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const tracker = normalizeProjectTracker(client.projectTracker);
    let checkedTask = null;
    const nextTracker = {
      ...tracker,
      phases: tracker.phases.map((phase) =>
        phase.key === phaseKey
          ? {
              ...phase,
              items: phase.items.map((item) => {
                if (item.key !== taskKey) {
                  return item;
                }

                checkedTask = { ...item, checked: Boolean(updates.checked) };
                return {
                  ...item,
                  checked: Boolean(updates.checked),
                  note: String(updates.note || "").trim(),
                  updatedAt: now,
                };
              }),
            }
          : phase
      ),
    };
    const suggestedStatus = updates.checked ? suggestProjectStatus(nextTracker) : "";
    const shouldMoveStatus =
      suggestedStatus &&
      compareProjectStatusPriority(suggestedStatus, client.projectStatus || "Client Onboarding") > 0;
    const statusActivityMessage =
      checkedTask?.label === "Website deployed" || checkedTask?.label === "Handover completed"
        ? checkedTask.label
        : `Project moved to ${suggestedStatus}`;
    const activity = shouldMoveStatus
      ? addClientActivity(client, statusActivityMessage)
      : shouldRecordProjectActivity(checkedTask)
        ? addClientActivity(client, checkedTask.label)
        : client.activity || [];

    return {
      ...client,
      projectTracker: nextTracker,
      projectStatus: shouldMoveStatus ? suggestedStatus : client.projectStatus || "Client Onboarding",
      activity,
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function updateHandoverItem(clientId, groupKey, itemKey, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const checklist = normalizeHandoverChecklist(client.handoverChecklist);
    let checkedItem = null;
    const nextChecklist = {
      ...checklist,
      groups: checklist.groups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              items: group.items.map((item) => {
                if (item.key !== itemKey) {
                  return item;
                }

                checkedItem = { ...item, checked: Boolean(updates.checked) };
                return {
                  ...item,
                  checked: Boolean(updates.checked),
                  note: String(updates.note || "").trim(),
                  updatedAt: now,
                };
              }),
            }
          : group
      ),
    };
    const progress = calculateHandoverProgress(nextChecklist);
    const inferredStatus = getHandoverStatus({ ...client, handoverChecklist: nextChecklist }, progress);
    const completedHandover = Boolean(updates.checked) && checkedItem?.key === "handoverCompleted";
    const supportStarted = Boolean(updates.checked) && checkedItem?.key === "supportPeriodStarted";
    const nextProjectStatus = completedHandover
      ? "Completed"
      : supportStarted
        ? "Maintenance"
        : client.projectStatus || "Client Onboarding";
    const activity = completedHandover
      ? addClientActivity(client, "Handover completed", "Handover")
      : supportStarted
        ? addClientActivity(client, "Support period started", "Handover")
        : client.activity || [];

    return {
      ...client,
      handoverChecklist: nextChecklist,
      handoverStatus: completedHandover ? "Completed" : supportStarted ? "Support Started" : inferredStatus,
      projectStatus: nextProjectStatus,
      activity,
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function addClientDocument(clientId, payload = {}) {
  const now = new Date().toISOString();
  const documentRecord = getDefaultDocumentRecord(payload);
  if (!documentRecord.title) {
    elements.statusMessage.textContent = "Enter a document title before adding.";
    return;
  }

  state.clients = state.clients.map((client) =>
    client.clientId === clientId
      ? {
          ...client,
          documents: [documentRecord, ...normalizeClientDocuments(client.documents)],
          activity: addClientActivity(client, `Document added: ${documentRecord.title}`, "Documents"),
          updatedAt: now,
        }
      : client
  );
  saveClients();
  elements.statusMessage.textContent = "Document reference added.";
  renderDetail();
}

function updateClientDocument(clientId, documentId, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const documents = normalizeClientDocuments(client.documents);
    const existingDocument = documents.find((document) => document.documentId === documentId);
    const nextDocuments = documents.map((document) =>
      document.documentId === documentId
        ? {
            ...document,
            ...updates,
            status: DOCUMENT_STATUSES.includes(updates.status) ? updates.status : document.status,
            updatedAt: now,
          }
        : document
    );
    const nextDocument = nextDocuments.find((document) => document.documentId === documentId);
    const statusChanged = existingDocument && nextDocument && existingDocument.status !== nextDocument.status;
    const activity = statusChanged
      ? addClientActivity(
          client,
          nextDocument.status === "Approved"
            ? `Document marked approved: ${nextDocument.title}`
            : `Document status updated: ${nextDocument.title} ${String(nextDocument.status || "").toLowerCase()}`,
          "Documents"
        )
      : client.activity || [];

    return {
      ...client,
      documents: nextDocuments,
      activity,
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function updateDocumentChecklistItem(clientId, itemKey, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const checklist = normalizeDocumentChecklist(client.documentChecklist);
    return {
      ...client,
      documentChecklist: {
        items: checklist.items.map((item) =>
          item.key === itemKey
            ? {
                ...item,
                checked: Boolean(updates.checked),
                note: String(updates.note || "").trim(),
                updatedAt: now,
              }
            : item
        ),
      },
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
}

function updatePaymentSummary(clientId, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const paymentRecords = normalizePaymentRecords(client.paymentRecords);
    const paymentSummary = normalizePaymentSummary({ ...client.paymentSummary, ...updates }, client);
    const totals = calculatePaymentTotals(paymentSummary, paymentRecords);
    return {
      ...client,
      paymentSummary: {
        ...paymentSummary,
        advanceReceivedAmount: totals.advanceReceivedAmount,
        balanceDue: totals.balanceDue,
        paymentStatus: suggestPaymentStatus(paymentSummary, totals),
      },
      updatedAt: now,
    };
  });
  saveClients();
  elements.statusMessage.textContent = "Payment summary saved.";
  render();
}

function addPaymentRecord(clientId, payload = {}) {
  const paymentRecord = getDefaultPaymentRecord(payload);
  if (!paymentRecord.amount) {
    elements.statusMessage.textContent = "Enter a payment amount before adding.";
    return;
  }

  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const paymentRecords = [paymentRecord, ...normalizePaymentRecords(client.paymentRecords)];
    return syncPaymentWithClientActivity(
      {
        ...client,
        paymentRecords,
        updatedAt: new Date().toISOString(),
      },
      paymentRecord,
      null
    );
  });
  saveClients();
  elements.statusMessage.textContent = "Payment record added.";
  renderDetail();
}

function updatePaymentRecord(clientId, paymentId, updates = {}) {
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const existingRecords = normalizePaymentRecords(client.paymentRecords);
    const previousRecord = existingRecords.find((record) => record.paymentId === paymentId) || null;
    const paymentRecords = existingRecords.map((record) =>
      record.paymentId === paymentId
        ? getDefaultPaymentRecord({
            ...record,
            ...updates,
            paymentId: record.paymentId,
            createdAt: record.createdAt,
            updatedAt: new Date().toISOString(),
          })
        : record
    );
    const nextRecord = paymentRecords.find((record) => record.paymentId === paymentId) || null;
    return syncPaymentWithClientActivity(
      {
        ...client,
        paymentRecords,
        updatedAt: new Date().toISOString(),
      },
      nextRecord,
      previousRecord
    );
  });
  saveClients();
  renderDetail();
}

function addClientAccessRecord(clientId, payload = {}) {
  const accessRecord = getDefaultAccessRecord(payload);
  if (!accessRecord.platformName && !accessRecord.loginUrl) {
    elements.statusMessage.textContent = "Enter a platform name or login URL before adding access.";
    return;
  }

  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    return syncAccessWithOnboarding(
      {
        ...client,
        accessRecords: [accessRecord, ...normalizeAccessRecords(client.accessRecords)],
        activity: addAccessActivity(client, accessRecord, null),
        updatedAt: new Date().toISOString(),
      },
      accessRecord
    );
  });
  saveClients();
  elements.statusMessage.textContent = "Access reference added.";
  renderDetail();
}

function updateClientAccessRecord(clientId, accessId, updates = {}) {
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const existingRecords = normalizeAccessRecords(client.accessRecords);
    const previousRecord = existingRecords.find((record) => record.accessId === accessId) || null;
    const accessRecords = existingRecords.map((record) =>
      record.accessId === accessId
        ? getDefaultAccessRecord({
            ...record,
            ...updates,
            accessId: record.accessId,
            createdAt: record.createdAt,
            updatedAt: new Date().toISOString(),
          })
        : record
    );
    const nextRecord = accessRecords.find((record) => record.accessId === accessId) || null;
    return syncAccessWithOnboarding(
      {
        ...client,
        accessRecords,
        activity: addAccessActivity(client, nextRecord, previousRecord),
        updatedAt: new Date().toISOString(),
      },
      nextRecord
    );
  });
  saveClients();
  renderDetail();
}

function updateAccessChecklistItem(clientId, itemKey, updates = {}) {
  const now = new Date().toISOString();
  state.clients = state.clients.map((client) => {
    if (client.clientId !== clientId) {
      return client;
    }

    const checklist = normalizeAccessChecklist(client.accessChecklist);
    return {
      ...client,
      accessChecklist: {
        items: checklist.items.map((item) =>
          item.key === itemKey
            ? {
                ...item,
                checked: Boolean(updates.checked),
                note: String(updates.note || "").trim(),
                updatedAt: now,
              }
            : item
        ),
      },
      updatedAt: now,
    };
  });
  saveClients();
  renderDetail();
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
    return "Client Converted";
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
      if (elements.searchModeFilter) {
        elements.searchModeFilter.value = saved.filters.searchMode || DEFAULT_SEARCH_MODE;
      }
      if (elements.keywordFilter) {
        elements.keywordFilter.value = saved.filters.keyword || "";
      }
      elements.cityFilter.value = saved.filters.city;
      elements.stateFilter.value = saved.filters.state;
      if (elements.radiusFilter) {
        elements.radiusFilter.value = saved.filters.radius || "";
      }
      elements.sourceFilter.value = saved.filters.source;
      elements.websiteConditionFilter.value = saved.filters.websiteCondition || "";
      elements.mobileAppConditionFilter.value = saved.filters.mobileAppCondition || "";
      if (elements.bookingSystemConditionFilter) {
        elements.bookingSystemConditionFilter.value = saved.filters.bookingSystemCondition || "";
      }
      if (elements.onlinePaymentConditionFilter) {
        elements.onlinePaymentConditionFilter.value = saved.filters.onlinePaymentCondition || "";
      }
      if (elements.socialPresenceConditionFilter) {
        elements.socialPresenceConditionFilter.value = saved.filters.socialPresenceCondition || "";
      }
      if (elements.phoneAvailableFilter) {
        elements.phoneAvailableFilter.value = saved.filters.phoneAvailable || "";
      }
      if (elements.minimumRatingFilter) {
        elements.minimumRatingFilter.value = saved.filters.minimumRating || "";
      }
      if (elements.minimumReviewCountFilter) {
        elements.minimumReviewCountFilter.value = saved.filters.minimumReviewCount || "";
      }
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

function exportProspectsToCsv(prospects, filename) {
  const columns = [
    ["Business Name", (company) => company.name || company.businessName],
    ["Business Type", (company) => company.keyword || company.industry || company.businessType],
    ["Search Mode", (company) => company.searchMode],
    ["Address", (company) => company.address],
    ["City", (company) => company.city],
    ["State", (company) => company.state],
    ["Phone", (company) => company.phone],
    ["Email", (company) => company.primaryEmail || company.primary_contact?.email],
    ["Contact Person", (company) => company.contactPersonName || company.primary_contact?.name],
    ["Website URL", (company) => company.website || company.websiteUrl],
    ["Website Status", (company) => company.websiteStatus],
    ["Website Quality Status", (company) => company.websiteQualityStatus],
    ["Mobile App Status", (company) => company.mobileAppStatus],
    ["Booking Platform", (company) => company.bookingPlatform],
    ["Booking URL", (company) => company.bookingUrl || company.booking_url],
    ["Facebook URL", (company) => company.facebookUrl || company.facebook_url],
    ["Instagram URL", (company) => company.instagramUrl || company.instagram_url],
    ["LinkedIn URL", (company) => company.linkedinUrl || company.linkedin_url || company.primary_contact?.linkedin_url],
    ["Rating", (company) => company.rating],
    ["Review Count", (company) => company.reviewCount || company.reviews],
    ["Opportunity Score", (company) => company.opportunityScore || company.lead_score],
    ["Opportunity Priority", (company) => company.opportunityPriority || company.lead_label],
    ["Current Stage", (company) => company.prospect_stage || company.stage],
    ["Last Contacted", (company) => company.last_contacted_at],
    ["Next Follow-Up", (company) => company.next_follow_up],
    ["Quote Status", (company) => company.quote_status],
    ["Notes", (company) => getLatestProspectNote(company)],
    ["Source", (company) => company.source],
    ["Google Maps/Profile URL", (company) => company.source_url || company.googleProfileUrl || company.mapsUrl],
  ];
  downloadCsv(filename, columns, prospects || []);
}

function exportClientsToCsv(clients, filename) {
  const columns = [
    ["Client Name", (client) => client.businessName],
    ["Business Type", (client) => client.businessType],
    ["Owner/Manager", (client) => client.ownerOrManagerName],
    ["Phone", (client) => client.phone],
    ["Email", (client) => client.email],
    ["Address", (client) => client.address],
    ["Project Status", (client) => client.projectStatus],
    ["Client Status", (client) => client.currentClientStatus],
    ["Payment Status", (client) => normalizePaymentSummary(client.paymentSummary, client).paymentStatus],
    ["Balance Due", (client) => calculatePaymentTotals(normalizePaymentSummary(client.paymentSummary, client), normalizePaymentRecords(client.paymentRecords)).balanceDue],
    ["Support Status", (client) => normalizeSupportPlan(client.supportPlan, client).supportStatus],
    ["Maintenance Plan", (client) => normalizeSupportPlan(client.supportPlan, client).maintenancePlan],
    ["Created Date", (client) => client.createdAt],
  ];
  downloadCsv(filename, columns, clients || []);
}

function downloadCsv(filename, columns, records) {
  const headers = columns.map(([label]) => escapeCsvValue(label)).join(",");
  const rows = records.map((record) => columns.map(([, getter]) => escapeCsvValue(getter(record) ?? "")).join(","));
  downloadBlob(filename, [headers, ...rows].join("\n"));
}

function getLatestProspectNote(company) {
  const notes = Array.isArray(company.notes) ? company.notes : [];
  if (notes[0]?.text) return notes[0].text;
  if (Array.isArray(company.communication_notes) && company.communication_notes[0]?.text) return company.communication_notes[0].text;
  return company.latest_communication_note || "";
}

function getFollowUpDueProspects() {
  return getSavedProspectCompanies().filter((company) => ["due_today", "overdue"].includes(getFollowUpState(company.next_follow_up)));
}

function exportSelectedListCsv() {
  const list = getSelectedSavedList();
  if (!list) {
    elements.statusMessage.textContent = "No saved list selected.";
    return;
  }
  exportSavedListCsv(list.listId);
}

function exportSavedListCsv(listId) {
  const list = state.savedLists.find((item) => item.listId === listId);
  if (!list) {
    elements.statusMessage.textContent = "Saved list not found.";
    return;
  }
  exportProspectsToCsv(getProspectsForList(list.listId), `client-finder-list-${slugifyFilename(list.listName)}-${getTodayDateKey()}.csv`);
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
  const keywordLabel = String(elements.globalSearch?.value || DEFAULT_SEARCH_KEYWORD).trim();
  const customKeyword = String(elements.keywordFilter?.value || "").trim();
  const stateCode = String(elements.stateFilter?.value || "").trim().toUpperCase();
  const cityValue = String(elements.cityFilter?.value || "").trim();
  const cityLabel = isSearchLocationValid(cityValue) ? cityValue : "";

  return {
    searchMode: elements.searchModeFilter?.value || DEFAULT_SEARCH_MODE,
    state: stateCode,
    city: cityLabel.toLowerCase(),
    cityLabel,
    keyword: (customKeyword || keywordLabel).toLowerCase(),
    keywordLabel,
    customKeyword,
    industry: elements.industryFilter?.value || DEFAULT_INDUSTRY,
    radius: elements.radiusFilter?.value || "",
    source: elements.sourceFilter?.value || "",
    websiteCondition: elements.websiteConditionFilter?.value || "",
    mobileAppCondition: elements.mobileAppConditionFilter?.value || "",
    bookingSystemCondition: elements.bookingSystemConditionFilter?.value || "",
    onlinePaymentCondition: elements.onlinePaymentConditionFilter?.value || "",
    socialPresenceCondition: elements.socialPresenceConditionFilter?.value || "",
    phoneAvailable: elements.phoneAvailableFilter?.value || "",
    minimumRating: Number(elements.minimumRatingFilter?.value || 0),
    minimumReviewCount: Number(elements.minimumReviewCountFilter?.value || 0),
    leadScore: elements.leadScoreFilter?.value || "",
    reviewStatus: elements.reviewStatusFilter?.value || "",
    contactType: elements.contactTypeFilter?.value || "",
    hasPrimary: elements.hasPrimaryFilter?.checked || false,
    hasWebsite: elements.hasWebsiteFilter?.checked || false,
    hasEmail: elements.hasEmailFilter?.checked || false,
    hasPhone: elements.hasPhoneFilter?.checked || false,
    highConfidence: elements.highConfidenceFilter?.checked || false,
    needsReview: elements.needsReviewFilter?.checked || false,
    failedScans: elements.failedScansFilter?.checked || false,
    showHidden: elements.showHiddenFilter?.checked || false,
    verifiedOnly: elements.verifiedOnlyFilter?.checked || false,
    guessedEmails: elements.guessedEmailFilter?.checked || false,
    linkedInFound: elements.linkedInFoundFilter?.checked || false,
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

function formatBookingSystemCondition(value) {
  if (value === "has_booking") return "Has Booking System";
  if (value === "no_booking") return "No Booking System";
  if (value === "booking_platform_only") return "Booking Platform Only";
  if (value === "unknown") return "Unknown";
  return "Any";
}

function matchesBookingSystemCondition(company, condition) {
  if (!condition) {
    return true;
  }

  const platform = String(company.bookingPlatform || company.booking_platform || "").trim();
  const hasPlatform = Boolean(platform && platform !== "Unknown");
  const websiteStatus = normalizeWebsiteStatus(company.websiteStatus) || deriveWebsiteStatus(company);
  const explicitHasBooking = readBooleanish(company.hasBookingSystem ?? company.has_booking_system);

  if (condition === "has_booking") {
    return explicitHasBooking === true || hasPlatform || websiteStatus === "Booking Link Only";
  }
  if (condition === "no_booking") {
    return explicitHasBooking === false || (!hasPlatform && websiteStatus !== "Booking Link Only");
  }
  if (condition === "booking_platform_only") {
    return hasPlatform || websiteStatus === "Booking Link Only";
  }
  if (condition === "unknown") {
    return explicitHasBooking === null && !hasPlatform && websiteStatus === "Unknown";
  }
  return true;
}

function formatOnlinePaymentCondition(value) {
  if (value === "has_online_payment") return "Has Online Payment";
  if (value === "no_online_payment") return "No Online Payment";
  if (value === "unknown") return "Unknown";
  return "Any";
}

function matchesOnlinePaymentCondition(company, condition) {
  if (!condition) {
    return true;
  }

  const value = readBooleanish(company.hasOnlinePayment ?? company.onlinePaymentAvailable ?? company.has_online_payment);
  if (condition === "has_online_payment") {
    return value === true;
  }
  if (condition === "no_online_payment") {
    return value === false;
  }
  if (condition === "unknown") {
    return value === null;
  }
  return true;
}

function formatSocialPresenceCondition(value) {
  if (value === "has_social") return "Has Social Presence";
  if (value === "no_social") return "No Social Presence";
  if (value === "social_only") return "Social Only";
  if (value === "unknown") return "Unknown";
  return "Any";
}

function matchesSocialPresenceCondition(company, condition) {
  if (!condition) {
    return true;
  }

  const socialPlatform = String(company.socialPlatform || company.social_platform || "").trim();
  const hasSocial = Boolean(socialPlatform && socialPlatform !== "Unknown") || looksLikeSocialOrBookingUrl(company.website || "");
  const websiteStatus = normalizeWebsiteStatus(company.websiteStatus) || deriveWebsiteStatus(company);

  if (condition === "has_social") {
    return hasSocial || websiteStatus === "Social Only";
  }
  if (condition === "no_social") {
    return !hasSocial && websiteStatus !== "Social Only";
  }
  if (condition === "social_only") {
    return websiteStatus === "Social Only";
  }
  if (condition === "unknown") {
    return !hasSocial && websiteStatus === "Unknown";
  }
  return true;
}

function matchesPhoneAvailable(company, condition) {
  if (!condition) {
    return true;
  }

  const hasPhone = Boolean(String(company.phone || "").trim()) || Boolean(company.has_phone);
  if (condition === "yes") {
    return hasPhone;
  }
  if (condition === "no") {
    return !hasPhone;
  }
  return true;
}

function matchesSource(company, source) {
  if (!source) {
    return true;
  }

  const normalizedSource = String(company.source || "").trim().toLowerCase();
  if (source === "google_places") {
    return ["google_places", "google", "places"].includes(normalizedSource);
  }
  if (source === "saved") {
    return Boolean(findSavedProspectId(company)) || Boolean(company.is_saved_prospect);
  }
  return normalizedSource === source;
}

function populateSearchModes() {
  if (!elements.searchModeFilter) {
    return;
  }

  elements.searchModeFilter.innerHTML = Object.entries(SEARCH_MODES)
    .map(([value, mode]) => `<option value="${escapeAttribute(value)}">${escapeHtml(mode.label)}</option>`)
    .join("");
  elements.searchModeFilter.value = DEFAULT_SEARCH_MODE;
}

function renderPresetChips() {
  if (!elements.presetRow) {
    return;
  }

  elements.presetRow.innerHTML = QUICK_PRESETS.map(([group, type]) => {
    const preset = getBusinessTypePreset(group, type);
    const label = preset?.label || type;
    return `<button class="preset-chip" type="button" data-search-preset="${escapeAttribute(type)}" data-business-group="${escapeAttribute(group)}" data-business-type="${escapeAttribute(type)}">${escapeHtml(label)}</button>`;
  }).join("");
  elements.presetButtons = [...document.querySelectorAll("[data-search-preset]")];
  syncPresetChips();
}

function populateBusinessTypeGroups() {
  elements.industryFilter.innerHTML = Object.keys(BUSINESS_TYPE_GROUPS)
    .map((group) => `<option value="${escapeAttribute(group)}">${escapeHtml(group)}</option>`)
    .join("");
  setBusinessTypeSelection(DEFAULT_INDUSTRY, DEFAULT_SEARCH_KEYWORD, { applyDefaults: true });
}

function applySafeSearchDefaults() {
  if (elements.searchModeFilter) {
    elements.searchModeFilter.value = DEFAULT_SEARCH_MODE;
  }
  if (elements.industryFilter && elements.globalSearch) {
    setBusinessTypeSelection(DEFAULT_INDUSTRY, DEFAULT_SEARCH_KEYWORD, { applyDefaults: true });
  }
  if (elements.cityFilter) {
    elements.cityFilter.value = isSearchLocationValid(elements.cityFilter.value) ? elements.cityFilter.value : DEFAULT_CITY;
  }
  if (elements.stateFilter) {
    elements.stateFilter.value = elements.stateFilter.value || DEFAULT_STATE;
  }
  if (elements.websiteConditionFilter) {
    elements.websiteConditionFilter.value = DEFAULT_WEBSITE_CONDITION;
  }
  if (elements.statusMessage) {
    elements.statusMessage.textContent = DEFAULT_DISCOVERY_PROMPT;
  }
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

function setBusinessTypeSelection(group, type, options = {}) {
  const nextGroup = BUSINESS_TYPE_GROUPS[group] ? group : DEFAULT_INDUSTRY;
  const nextType = normalizeBusinessTypeForGroup(nextGroup, type);
  elements.industryFilter.value = nextGroup;
  populateBusinessTypes(nextGroup, nextType);
  if (options.applyDefaults) {
    applyBusinessTypeDefaults(nextGroup, nextType);
  }
  syncPresetChips();
}

function applyBusinessTypeDefaults(group, type) {
  const defaults = getDefaultFiltersForBusinessType(group, type);
  if (elements.searchModeFilter && defaults.searchMode) {
    elements.searchModeFilter.value = defaults.searchMode;
  }
  if (elements.websiteConditionFilter) {
    elements.websiteConditionFilter.value = defaults.websiteCondition || "";
  }
  if (elements.mobileAppConditionFilter) {
    elements.mobileAppConditionFilter.value = defaults.mobileAppCondition || "";
  }
  if (elements.bookingSystemConditionFilter) {
    elements.bookingSystemConditionFilter.value = defaults.bookingSystemCondition || "";
  }
}

function getDefaultBusinessType(group) {
  const groupConfig = BUSINESS_TYPE_GROUPS[group] || BUSINESS_TYPE_GROUPS[DEFAULT_INDUSTRY];
  if ((group || DEFAULT_INDUSTRY) === DEFAULT_INDUSTRY && groupConfig.types[DEFAULT_SEARCH_KEYWORD]) {
    return DEFAULT_SEARCH_KEYWORD;
  }
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

  if (elements.stateOptions) {
    elements.stateOptions.innerHTML = states
      .filter(Boolean)
      .map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value)}</option>`)
      .join("");
  } else if (elements.stateFilter?.tagName === "SELECT") {
    elements.stateFilter.innerHTML = states
    .map((value) => `<option value="${escapeAttribute(value)}">${escapeHtml(value || "All states")}</option>`)
    .join("");
  }
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
  const mode = getSearchMode(filters.searchMode);

  return {
    id: "manual-luxe-beauty-studio-farmers-branch-tx",
    name: "Luxe Beauty Studio",
    keyword: businessType,
    industry: DEFAULT_INDUSTRY,
    industry_tags: ["Beauty & Wellness", "Local Beauty", "Website Prospect"],
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
    searchMode: filters.searchMode || DEFAULT_SEARCH_MODE,
    recordPurpose: mode.recordPurpose,
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

function upsertSavedProspectSnapshot(company) {
  const snapshot = normalizeSavedProspectSnapshot(company);
  const nextManualProspects = Array.isArray(state.manualProspects) ? [...state.manualProspects] : [];
  const existingIndex = nextManualProspects.findIndex((prospect) => isDuplicateProspect(prospect, snapshot));

  if (existingIndex >= 0) {
    nextManualProspects[existingIndex] = mergeProspectData(nextManualProspects[existingIndex], snapshot);
  } else {
    nextManualProspects.unshift(snapshot);
  }

  state.manualProspects = dedupeProspectList(nextManualProspects).slice(0, 250);
  persistManualProspects();
  state.companies = mergeManualProspects(state.companies, state.manualProspects);
  return state.manualProspects.find((prospect) => isDuplicateProspect(prospect, snapshot)) || snapshot;
}

function normalizeSavedProspectSnapshot(company = {}) {
  const filters = getActiveFilters();
  const id = company.id || company.placeId || company.place_id || makeStableManualId(company.name || company.businessName, company.address);
  return {
    ...company,
    id,
    placeId: company.placeId || company.place_id || "",
    place_id: company.place_id || company.placeId || "",
    name: company.name || company.businessName || "Saved prospect",
    businessName: company.businessName || company.name || "Saved prospect",
    keyword: company.keyword || company.businessType || filters.keywordLabel || DEFAULT_SEARCH_KEYWORD,
    businessType: company.businessType || company.keyword || filters.keywordLabel || DEFAULT_SEARCH_KEYWORD,
    industry: company.industry || filters.industry || inferCompanyIndustry(company),
    address: company.address || "",
    city: company.city || filters.cityLabel || "",
    state: company.state || filters.state || "",
    phone: company.phone || "",
    website: company.website || company.websiteUrl || company.website_url || "",
    websiteUrl: company.websiteUrl || company.website || company.website_url || "",
    websiteStatus: company.websiteStatus || company.website_status || "Unknown",
    rating: Number(company.rating || 0),
    reviews: Number(company.reviews || company.reviewCount || 0),
    reviewCount: Number(company.reviewCount || company.reviews || 0),
    opportunityScore: Number(company.opportunityScore || company.lead_score || 0),
    opportunityPriority: company.opportunityPriority || company.lead_label || getOpportunityPriority(company.opportunityScore || company.lead_score || 0),
    lead_score: Number(company.lead_score || company.opportunityScore || 0),
    lead_label: company.lead_label || company.opportunityPriority || getOpportunityPriority(company.opportunityScore || company.lead_score || 0),
    searchMode: company.searchMode || filters.searchMode || DEFAULT_SEARCH_MODE,
    recordPurpose: company.recordPurpose || getSearchMode(company.searchMode || filters.searchMode || DEFAULT_SEARCH_MODE).recordPurpose,
    source: company.source || "google_places",
    source_url: company.source_url || company.googleProfileUrl || company.mapsUrl || "",
    googleProfileUrl: company.googleProfileUrl || company.source_url || "",
    mapsUrl: company.mapsUrl || company.google_maps_url || company.googleMapsUrl || company.source_url || "",
    contacts: Array.isArray(company.contacts) ? company.contacts : [],
    primary_contact: company.primary_contact || null,
    prospect_stage: company.prospect_stage || company.stage || "New Lead",
    stage: company.stage || company.prospect_stage || "New Lead",
    quote_status: company.quote_status || "Not Started",
    saved_snapshot: true,
    manual_prospect: Boolean(company.manual_prospect),
    updated_at: new Date().toISOString(),
    collected_at: company.collected_at || new Date().toISOString(),
  };
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

function mapLiveProspectToCompany(prospect, filters = getActiveFilters()) {
  const score = Number(prospect.opportunityScore || 0);
  const websiteStatus = normalizeWebsiteStatus(prospect.websiteStatus) || "Unknown";
  const mode = getSearchMode(filters.searchMode);

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
    searchMode: filters.searchMode || DEFAULT_SEARCH_MODE,
    recordPurpose: mode.recordPurpose,
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
  return (Array.isArray(companies) ? companies : []).filter(Boolean).map((company) => {
    const scanState = scanner.getState(company.id);
    const scannerContacts = Array.isArray(scanState.contacts) ? scanState.contacts : [];
    const existingContacts = Array.isArray(company.contacts) ? company.contacts : [];
    const mergedContacts =
      scannerContacts.length > existingContacts.length ? scannerContacts : existingContacts;
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
    primaryEmail: workflow.primaryEmail || company.primaryEmail || company.primary_contact?.email || "",
    additionalEmails: Array.isArray(workflow.additionalEmails)
      ? workflow.additionalEmails
      : Array.isArray(company.additionalEmails)
        ? company.additionalEmails
        : [],
    contactPersonName: workflow.contactPersonName || company.contactPersonName || company.primary_contact?.name || "",
    contactPersonTitle: workflow.contactPersonTitle || company.contactPersonTitle || company.primary_contact?.title || "",
    facebookUrl: workflow.facebookUrl || company.facebookUrl || company.facebook_url || "",
    instagramUrl: workflow.instagramUrl || company.instagramUrl || company.instagram_url || "",
    linkedinUrl: workflow.linkedinUrl || company.linkedinUrl || company.linkedin_url || company.primary_contact?.linkedin_url || "",
    websiteContactPageUrl: workflow.websiteContactPageUrl || company.websiteContactPageUrl || "",
    bookingUrl: workflow.bookingUrl || company.bookingUrl || company.booking_url || "",
    sourceLinks: Array.isArray(workflow.sourceLinks)
      ? workflow.sourceLinks
      : Array.isArray(company.sourceLinks)
        ? company.sourceLinks
        : [],
    enrichmentStatus: workflow.enrichmentStatus || company.enrichmentStatus || "Not Checked",
    enrichmentCheckedAt: workflow.enrichmentCheckedAt || company.enrichmentCheckedAt || "",
    enrichmentNotes: workflow.enrichmentNotes || company.enrichmentNotes || "",
    outreach_templates:
      workflow.outreach_templates && typeof workflow.outreach_templates === "object"
        ? workflow.outreach_templates
        : company.outreach_templates && typeof company.outreach_templates === "object"
          ? company.outreach_templates
          : {},
    outreach_tone: workflow.outreach_tone || company.outreach_tone || "Professional",
    searchMode: workflow.searchMode || company.searchMode || DEFAULT_SEARCH_MODE,
    recordPurpose: workflow.recordPurpose || company.recordPurpose || getSearchMode(workflow.searchMode || company.searchMode).recordPurpose,
    communication_logs: allCommunicationLogs,
    activity_log: activityLog.length ? activityLog : Array.isArray(company.activity_log) ? company.activity_log : [],
    notes,
    milestones: workflow.milestones || {},
    latest_communication_note: lastCommunication?.notes || "",
    is_saved_prospect: Boolean(findSavedProspectId(company)),
    archived: Boolean(workflow.archived || company.archived),
    archived_at: workflow.archived_at || company.archived_at || "",
    clientId: workflow.clientId || company.clientId || "",
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

function getClients() {
  const parsed = readLocalJson(CLIENTS_KEY, []);
  return Array.isArray(parsed) ? parsed.map((client) => normalizeClientRecord(client)) : [];
}

function normalizeClientRecord(client = {}) {
  return {
    ...client,
    onboardingChecklist: normalizeOnboardingChecklist(client.onboardingChecklist),
    projectTracker: normalizeProjectTracker(client.projectTracker),
    handoverChecklist: normalizeHandoverChecklist(client.handoverChecklist),
    documentChecklist: normalizeDocumentChecklist(client.documentChecklist),
    documents: normalizeClientDocuments(client.documents),
    paymentSummary: normalizePaymentSummary(client.paymentSummary, client),
    paymentRecords: normalizePaymentRecords(client.paymentRecords),
    accessChecklist: normalizeAccessChecklist(client.accessChecklist),
    accessRecords: normalizeAccessRecords(client.accessRecords),
    supportPlan: normalizeSupportPlan(client.supportPlan, client),
    supportRequests: normalizeSupportRequests(client.supportRequests),
    activity: Array.isArray(client.activity) ? client.activity : [],
  };
}

function saveClients() {
  writeLocalJson(CLIENTS_KEY, state.clients);
  persistChangedClientsToSupabase();
}

function resetClientSyncSnapshot() {
  clientSyncSnapshot = new Map(
    state.clients.map((client) => [client.clientId, JSON.stringify({ updatedAt: client.updatedAt || "", client })])
  );
}

function isSupabaseClientsActive() {
  const status = storageService.getStatus();
  return status.activeMode === "supabase" && status.supabaseConfigured;
}

function persistChangedClientsToSupabase() {
  if (!isSupabaseClientsActive()) {
    return;
  }

  state.clients.forEach((client) => {
    const snapshot = JSON.stringify({ updatedAt: client.updatedAt || "", client });
    if (clientSyncSnapshot.get(client.clientId) === snapshot) {
      return;
    }

    storageService
      .saveClient(client)
      .then(() => {
        clientSyncSnapshot.set(client.clientId, snapshot);
      })
      .catch(() => {
        elements.statusMessage.textContent = "Client saved locally. Supabase client sync failed.";
      });
  });
}

function createClientFromProspect(company) {
  const now = new Date().toISOString();
  const primaryContact = company.primary_contact || {};
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dedupeKey = getProspectDedupeKey(company);

  return {
    clientId,
    prospectId: company.id || "",
    dedupeKey,
    businessName: company.name || company.businessName || "",
    businessType: company.industry || company.keyword || company.businessType || "",
    ownerOrManagerName: primaryContact.name || company.ownerOrManagerName || "",
    phone: company.phone || primaryContact.phone || "",
    email: company.email || primaryContact.email || "",
    address: company.address || "",
    city: company.city || "",
    state: company.state || "",
    websiteUrl: company.website || company.websiteUrl || "",
    googleProfileUrl: company.source_url || company.googleProfileUrl || "",
    mapsUrl: company.mapsUrl || company.google_maps_url || company.googleMapsUrl || company.source_url || "",
    sourceProspectData: { ...company },
    currentClientStatus: "Active Client",
    projectStatus: "Client Onboarding",
    projectType: company.quote_project_type || "",
    packageType: company.quote_package_type || "",
    startDate: "",
    targetLaunchDate: "",
    notes: "",
    internalNotes: company.quote_internal_notes || "",
    onboardingChecklist: getDefaultOnboardingChecklist(),
    projectTracker: getDefaultProjectTracker(),
    handoverChecklist: getDefaultHandoverChecklist(),
    documentChecklist: getDefaultDocumentChecklist(),
    documents: [],
    paymentSummary: getDefaultPaymentSummary(company),
    paymentRecords: [],
    accessChecklist: getDefaultAccessChecklist(),
    accessRecords: [],
    supportPlan: getDefaultSupportPlan(),
    supportRequests: [],
    handoverStatus: "Not Started",
    handoverLaunchDate: "",
    liveUrl: "",
    adminUrl: "",
    trainingDate: "",
    supportStartDate: "",
    supportEndDate: "",
    renewalReminderDate: "",
    supportStatus: "Not Started",
    maintenancePlan: "None",
    monthlySupportAmount: "",
    supportNotes: "",
    handoverNotes: "",
    currentBlocker: "",
    nextProjectAction: "",
    actualLaunchDate: "",
    isBlocked: false,
    blockedBy: "",
    activity: [],
    createdAt: now,
    updatedAt: now,
  };
}

function getDefaultProjectTracker() {
  return {
    phases: PROJECT_PHASES.map((phase) => ({
      key: phase.key,
      title: phase.title,
      status: phase.status,
      items: phase.items.map(([key, label, major = false, suggestedStatus = phase.status]) => ({
        key,
        label,
        major: Boolean(major),
        suggestedStatus,
        checked: false,
        note: "",
        updatedAt: "",
      })),
    })),
  };
}

function normalizeProjectTracker(tracker) {
  const defaults = getDefaultProjectTracker();
  const existingPhases = Array.isArray(tracker?.phases) ? tracker.phases : [];

  return {
    phases: defaults.phases.map((defaultPhase) => {
      const existingPhase = existingPhases.find((phase) => phase?.key === defaultPhase.key) || {};
      const existingItems = Array.isArray(existingPhase.items) ? existingPhase.items : [];

      return {
        ...defaultPhase,
        items: defaultPhase.items.map((defaultItem) => {
          const existingItem = existingItems.find((item) => item?.key === defaultItem.key) || {};
          return {
            ...defaultItem,
            checked: Boolean(existingItem.checked),
            note: String(existingItem.note || "").trim(),
            updatedAt: existingItem.updatedAt || "",
          };
        }),
      };
    }),
  };
}

function calculateProjectProgress(tracker) {
  const items = normalizeProjectTracker(tracker).phases.flatMap((phase) => phase.items);
  const total = items.length;
  const completed = items.filter((item) => item.checked).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

function getProjectHealth(client, tracker) {
  if ((client.projectStatus || "") === "Completed") {
    return "Completed";
  }

  if ((client.projectStatus || "") === "Blocked" || client.isBlocked || String(client.currentBlocker || "").trim()) {
    return "Blocked";
  }

  const targetDate = String(client.targetLaunchDate || "").slice(0, 10);
  if (targetDate && targetDate < getTodayDateKey() && (client.projectStatus || "") !== "Completed") {
    return "Needs Attention";
  }

  const progress = calculateProjectProgress(tracker);
  return progress.percentage === 100 ? "Completed" : "On Track";
}

function getCurrentProjectPhase(tracker) {
  const phases = normalizeProjectTracker(tracker).phases;
  const activePhase = [...phases].reverse().find((phase) => phase.items.some((item) => item.checked));
  return activePhase?.title || "Not Started";
}

function suggestProjectStatus(tracker) {
  const phases = normalizeProjectTracker(tracker).phases;
  const completedMajor = phases.flatMap((phase) => phase.items.filter((item) => item.checked && item.major));
  const lastMajor = completedMajor.at(-1);
  if (lastMajor?.suggestedStatus) {
    return lastMajor.suggestedStatus;
  }

  const activePhase = [...phases].reverse().find((phase) => phase.items.some((item) => item.checked));
  return activePhase?.status || "";
}

function compareProjectStatusPriority(left, right) {
  const leftIndex = CLIENT_PROJECT_STATUSES.indexOf(left);
  const rightIndex = CLIENT_PROJECT_STATUSES.indexOf(right);
  return (leftIndex === -1 ? 0 : leftIndex) - (rightIndex === -1 ? 0 : rightIndex);
}

function shouldRecordProjectActivity(task) {
  return Boolean(task?.major && task.checked);
}

function addClientActivity(client, message, source = "Project") {
  return [
    {
      id: `client-activity-${Date.now()}`,
      createdAt: new Date().toISOString(),
      message,
      source,
    },
    ...(Array.isArray(client.activity) ? client.activity : []),
  ].slice(0, 50);
}

function getDefaultSupportPlan(source = {}) {
  return {
    supportStatus: SUPPORT_STATUSES.includes(source.supportStatus) ? source.supportStatus : "Not Started",
    maintenancePlan: MAINTENANCE_PLANS.includes(source.maintenancePlan) ? source.maintenancePlan : "None",
    monthlySupportAmount: String(source.monthlySupportAmount || "").trim(),
    supportStartDate: String(source.supportStartDate || "").slice(0, 10),
    supportEndDate: String(source.supportEndDate || "").slice(0, 10),
    renewalReminderDate: String(source.renewalReminderDate || "").slice(0, 10),
    supportNotes: String(source.supportNotes || "").trim(),
  };
}

function normalizeSupportPlan(plan = {}, client = {}) {
  const safePlan = plan && typeof plan === "object" ? plan : {};
  return getDefaultSupportPlan({
    ...safePlan,
    supportStatus: safePlan.supportStatus || client.supportStatus,
    maintenancePlan: safePlan.maintenancePlan || client.maintenancePlan,
    monthlySupportAmount: safePlan.monthlySupportAmount || client.monthlySupportAmount,
    supportStartDate: safePlan.supportStartDate || client.supportStartDate,
    supportEndDate: safePlan.supportEndDate || client.supportEndDate,
    renewalReminderDate: safePlan.renewalReminderDate || client.renewalReminderDate,
    supportNotes: safePlan.supportNotes || client.supportNotes,
  });
}

function getDefaultSupportRequest(payload = {}) {
  const now = new Date().toISOString();
  return {
    requestId: payload.requestId || `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(payload.title || "").trim(),
    requestType: SUPPORT_REQUEST_TYPES.includes(payload.requestType) ? payload.requestType : "Other",
    priority: SUPPORT_PRIORITIES.includes(payload.priority) ? payload.priority : "Normal",
    status: SUPPORT_REQUEST_STATUSES.includes(payload.status) ? payload.status : "New",
    requestedDate: String(payload.requestedDate || getTodayDateKey()).slice(0, 10),
    targetDate: String(payload.targetDate || "").slice(0, 10),
    completedDate: String(payload.completedDate || "").slice(0, 10),
    notes: String(payload.notes || "").trim(),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
}

function normalizeSupportRequests(requests) {
  return Array.isArray(requests) ? requests.map((request) => getDefaultSupportRequest(request)) : [];
}

function isSupportRequestOverdue(request) {
  const targetDate = String(request?.targetDate || "").slice(0, 10);
  return Boolean(targetDate && targetDate < getTodayDateKey() && !["Completed", "Cancelled"].includes(request?.status));
}

function getOverdueSupportRequests(requests = []) {
  return normalizeSupportRequests(requests).filter((request) => isSupportRequestOverdue(request));
}

function getSupportRenewalStatus(plan = {}) {
  const supportPlan = normalizeSupportPlan(plan);
  const renewalDate = String(supportPlan.supportEndDate || "").slice(0, 10);
  if (!renewalDate || ["Cancelled", "Completed", "No Support Plan"].includes(supportPlan.supportStatus)) {
    return "No renewal date";
  }

  const today = getTodayDateKey();
  if (renewalDate < today && supportPlan.supportStatus === "Active") {
    return "Renewal Overdue";
  }

  const renewalTime = new Date(`${renewalDate}T00:00:00`).getTime();
  const todayTime = new Date(`${today}T00:00:00`).getTime();
  const daysUntilRenewal = Math.round((renewalTime - todayTime) / (1000 * 60 * 60 * 24));
  if (daysUntilRenewal >= 0 && daysUntilRenewal <= 14) {
    return "Renewal Due";
  }

  return "Current";
}

function calculateSupportSummary(client) {
  const supportPlan = normalizeSupportPlan(client?.supportPlan, client);
  const supportRequests = normalizeSupportRequests(client?.supportRequests);
  const openRequests = supportRequests.filter((request) => !["Completed", "Cancelled"].includes(request.status)).length;
  const urgentHighPriority = supportRequests.filter(
    (request) => ["High", "Urgent"].includes(request.priority) && !["Completed", "Cancelled"].includes(request.status)
  ).length;
  const overdueRequests = getOverdueSupportRequests(supportRequests).length;
  return {
    openRequests,
    urgentHighPriority,
    overdueRequests,
    renewalStatus: getSupportRenewalStatus(supportPlan),
    handoverCompleted: isHandoverCompleted(client),
  };
}

function isHandoverCompleted(client = {}) {
  if ((client.handoverStatus || "") === "Completed") {
    return true;
  }

  return normalizeHandoverChecklist(client.handoverChecklist)
    .groups.flatMap((group) => group.items)
    .some((item) => item.key === "handoverCompleted" && item.checked);
}

function getDefaultDocumentChecklist() {
  return {
    items: REQUIRED_DOCUMENT_ITEMS.map(([key, label]) => ({
      key,
      label,
      checked: false,
      note: "",
      updatedAt: "",
    })),
  };
}

function getDefaultPaymentSummary(source = {}) {
  const quoteAmount = getSuggestedPaymentAmountFromQuote(source);
  return {
    quotedAmount: quoteAmount || "",
    discountAmount: source.quote_discount || "",
    finalAgreedAmount: quoteAmount || "",
    advanceRequiredAmount: "",
    advanceReceivedAmount: 0,
    balanceDue: quoteAmount || 0,
    paymentStatus: "Not Started",
    paymentTerms: source.quote_payment_terms || source.sourceProspectData?.quote_payment_terms || "",
    paymentNotes: "",
  };
}

function getDefaultAccessChecklist() {
  return {
    items: REQUIRED_ACCESS_ITEMS.map(([key, label]) => ({
      key,
      label,
      checked: false,
      note: "",
      updatedAt: "",
    })),
  };
}

function normalizeAccessChecklist(checklist) {
  const defaults = getDefaultAccessChecklist();
  const existingItems = Array.isArray(checklist?.items) ? checklist.items : [];
  return {
    items: defaults.items.map((defaultItem) => {
      const existingItem = existingItems.find((item) => item?.key === defaultItem.key) || {};
      return {
        ...defaultItem,
        checked: Boolean(existingItem.checked),
        note: String(existingItem.note || "").trim(),
        updatedAt: existingItem.updatedAt || "",
      };
    }),
  };
}

function getDefaultAccessRecord(payload = {}) {
  const now = new Date().toISOString();
  return {
    accessId: payload.accessId || `access-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: ACCESS_CATEGORIES.includes(payload.category) ? payload.category : "Other",
    platformName: String(payload.platformName || "").trim(),
    loginUrl: String(payload.loginUrl || "").trim(),
    usernameOrEmail: String(payload.usernameOrEmail || "").trim(),
    accessStatus: ACCESS_STATUSES.includes(payload.accessStatus) ? payload.accessStatus : "Needed",
    permissionLevel: ACCESS_PERMISSION_LEVELS.includes(payload.permissionLevel) ? payload.permissionLevel : "Unknown",
    secureStorageReference: ACCESS_STORAGE_REFERENCES.includes(payload.secureStorageReference)
      ? payload.secureStorageReference
      : "Not stored",
    ownerContact: String(payload.ownerContact || "").trim(),
    notes: String(payload.notes || "").trim(),
    requestedDate: String(payload.requestedDate || "").slice(0, 10),
    receivedDate: String(payload.receivedDate || "").slice(0, 10),
    lastVerifiedDate: String(payload.lastVerifiedDate || "").slice(0, 10),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
}

function normalizeAccessRecords(records) {
  return Array.isArray(records) ? records.map((record) => getDefaultAccessRecord(record)) : [];
}

function calculateAccessProgress(checklist, records = []) {
  const normalizedChecklist = normalizeAccessChecklist(checklist);
  const totalRequired = normalizedChecklist.items.length;
  const checklistReady = normalizedChecklist.items.filter((item) => item.checked).length;
  const readyRecords = normalizeAccessRecords(records).filter((record) =>
    ["Received", "Verified", "Not Required"].includes(record.accessStatus)
  ).length;
  const blocked = normalizeAccessRecords(records).filter((record) => record.accessStatus === "Blocked").length;
  const receivedVerified = Math.min(totalRequired, Math.max(checklistReady, readyRecords));
  const missing = Math.max(0, totalRequired - receivedVerified);
  return { totalRequired, receivedVerified, missing, blocked };
}

function getAccessStatus(progress) {
  if (progress.blocked) {
    return "Blocked";
  }

  if (!progress.receivedVerified) {
    return "Not Started";
  }

  if (!progress.missing) {
    return "Access Ready";
  }

  return progress.receivedVerified < progress.totalRequired ? "Waiting on Client" : "In Progress";
}

function addAccessActivity(client, nextRecord, previousRecord = null) {
  if (!nextRecord) {
    return client.activity || [];
  }

  if (!previousRecord && nextRecord.accessStatus === "Requested") {
    return addClientActivity(client, `Access requested: ${nextRecord.category}`, "Credentials");
  }

  if (previousRecord?.accessStatus === nextRecord.accessStatus) {
    return client.activity || [];
  }

  if (nextRecord.accessStatus === "Requested") {
    return addClientActivity(client, `Access requested: ${nextRecord.category}`, "Credentials");
  }

  if (nextRecord.accessStatus === "Received") {
    return addClientActivity(client, `Access received: ${nextRecord.category}`, "Credentials");
  }

  if (nextRecord.accessStatus === "Verified") {
    return addClientActivity(client, `Access verified: ${nextRecord.category}`, "Credentials");
  }

  if (nextRecord.accessStatus === "Blocked") {
    return addClientActivity(client, `Access blocked: ${nextRecord.category}`, "Credentials");
  }

  return client.activity || [];
}

function syncAccessWithOnboarding(client, accessRecord) {
  if (!accessRecord || !["Received", "Verified"].includes(accessRecord.accessStatus)) {
    return client;
  }

  const accessChecklistKey = getAccessChecklistKeyForCategory(accessRecord.category);
  const accessChecklist = normalizeAccessChecklist(client.accessChecklist);
  const onboardingKey =
    accessRecord.category === "Domain Registrar"
      ? "domainAccess"
      : accessRecord.category === "Hosting"
        ? "hostingAccess"
        : "";
  if (!onboardingKey) {
    return accessChecklistKey
      ? {
          ...client,
          accessChecklist: markAccessChecklistItemReady(accessChecklist, accessChecklistKey, accessRecord),
        }
      : client;
  }

  const checklist = normalizeOnboardingChecklist(client.onboardingChecklist);
  const now = new Date().toISOString();
  return {
    ...client,
    accessChecklist: accessChecklistKey
      ? markAccessChecklistItemReady(accessChecklist, accessChecklistKey, accessRecord)
      : client.accessChecklist,
    onboardingChecklist: {
      groups: checklist.groups.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.key === onboardingKey
            ? {
                ...item,
                checked: true,
                note: item.note || `${accessRecord.category} ${accessRecord.accessStatus.toLowerCase()}`,
                updatedAt: now,
              }
            : item
        ),
      })),
    },
  };
}

function markAccessChecklistItemReady(checklist, itemKey, accessRecord) {
  const now = new Date().toISOString();
  return {
    items: normalizeAccessChecklist(checklist).items.map((item) =>
      item.key === itemKey
        ? {
            ...item,
            checked: true,
            note: item.note || `${accessRecord.category} ${accessRecord.accessStatus.toLowerCase()}`,
            updatedAt: now,
          }
        : item
    ),
  };
}

function getAccessChecklistKeyForCategory(category) {
  const map = {
    "Domain Registrar": "domainAccess",
    Hosting: "hostingAccess",
    "Existing Website / CMS": "websiteAdminAccess",
    "Website Admin": "websiteAdminAccess",
    "Google Business Profile": "googleBusinessProfileAccess",
    "Google Analytics": "analyticsSearchConsoleAccess",
    "Google Search Console": "analyticsSearchConsoleAccess",
    "Social Media": "socialMediaAccess",
    "Booking Platform": "bookingPlatformAccess",
    "Vercel / Hosting Deployment": "deploymentAccess",
  };
  return map[category] || "";
}

function normalizePaymentSummary(summary, client = {}) {
  const defaults = getDefaultPaymentSummary(client);
  const normalized = {
    ...defaults,
    ...(summary && typeof summary === "object" ? summary : {}),
  };
  normalized.quotedAmount = parseMoneyValue(normalized.quotedAmount);
  normalized.discountAmount = parseMoneyValue(normalized.discountAmount);
  normalized.finalAgreedAmount = parseMoneyValue(normalized.finalAgreedAmount);
  normalized.advanceRequiredAmount = parseMoneyValue(normalized.advanceRequiredAmount);
  normalized.advanceReceivedAmount = parseMoneyValue(normalized.advanceReceivedAmount);
  normalized.balanceDue = parseMoneyValue(normalized.balanceDue);
  normalized.paymentStatus = PAYMENT_STATUSES.includes(normalized.paymentStatus) ? normalized.paymentStatus : "Not Started";
  normalized.paymentTerms = String(normalized.paymentTerms || "").trim();
  normalized.paymentNotes = String(normalized.paymentNotes || "").trim();
  return normalized;
}

function getDefaultPaymentRecord(payload = {}) {
  const now = new Date().toISOString();
  return {
    paymentId: payload.paymentId || `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    paymentDate: String(payload.paymentDate || getTodayDateKey()).slice(0, 10),
    amount: parseMoneyValue(payload.amount),
    paymentMethod: PAYMENT_METHODS.includes(payload.paymentMethod) ? payload.paymentMethod : "Other",
    paymentType: PAYMENT_TYPES.includes(payload.paymentType) ? payload.paymentType : "Other",
    status: PAYMENT_RECORD_STATUSES.includes(payload.status) ? payload.status : "Expected",
    receiptReference: String(payload.receiptReference || "").trim(),
    storageLocation: PAYMENT_STORAGE_LOCATIONS.includes(payload.storageLocation) ? payload.storageLocation : "Other",
    notes: String(payload.notes || "").trim(),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
}

function normalizePaymentRecords(records) {
  return Array.isArray(records) ? records.map((record) => getDefaultPaymentRecord(record)) : [];
}

function calculatePaymentTotals(summary, records = []) {
  const normalizedSummary = normalizePaymentSummary(summary);
  const receivedRecords = normalizePaymentRecords(records).filter((record) => record.status === "Received");
  const totalReceived = receivedRecords.reduce((sum, record) => sum + parseMoneyValue(record.amount), 0);
  const advanceReceivedAmount = receivedRecords
    .filter((record) => record.paymentType === "Advance")
    .reduce((sum, record) => sum + parseMoneyValue(record.amount), 0);
  const finalAgreedAmount = parseMoneyValue(normalizedSummary.finalAgreedAmount);
  const balanceDue = Math.max(0, finalAgreedAmount - totalReceived);
  return { totalReceived, advanceReceivedAmount, balanceDue };
}

function suggestPaymentStatus(summary, totals) {
  if (["Refunded", "Cancelled"].includes(summary.paymentStatus)) {
    return summary.paymentStatus;
  }

  if (summary.paymentStatus === "Overdue" && totals.totalReceived < parseMoneyValue(summary.finalAgreedAmount)) {
    return "Overdue";
  }

  if (parseMoneyValue(summary.finalAgreedAmount) && totals.totalReceived >= parseMoneyValue(summary.finalAgreedAmount)) {
    return "Paid in Full";
  }

  if (totals.totalReceived > 0) {
    return "Partially Paid";
  }

  if ((summary.paymentStatus || "Not Started") === "Not Started" && parseMoneyValue(summary.advanceRequiredAmount) > 0) {
    return "Advance Pending";
  }

  return summary.paymentStatus || "Not Started";
}

function getPaymentStatusChip(status) {
  return PAYMENT_STATUSES.includes(status) ? status : "Not Started";
}

function getSuggestedPaymentAmountFromQuote(source = {}) {
  return parseMoneyValue(
    source.quote_final_quote_amount ||
      source.quoteFinalQuoteAmount ||
      source.sourceProspectData?.quote_final_quote_amount ||
      source.sourceProspectData?.quoteFinalQuoteAmount ||
      0
  );
}

function syncPaymentWithClientActivity(client, nextRecord, previousRecord = null) {
  const paymentSummary = normalizePaymentSummary(client.paymentSummary, client);
  const paymentRecords = normalizePaymentRecords(client.paymentRecords);
  const totals = calculatePaymentTotals(paymentSummary, paymentRecords);
  let activity = client.activity || [];

  if (nextRecord?.status === "Received" && previousRecord?.status !== "Received") {
    if (nextRecord.paymentType === "Advance") {
      activity = addClientActivity({ ...client, activity }, "Advance payment received", "Payments");
      syncProspectAdvancePaymentMilestone(client);
    } else if (nextRecord.paymentType === "Final Balance") {
      activity = addClientActivity({ ...client, activity }, "Final payment received", "Payments");
    }
  }

  return {
    ...client,
    paymentSummary: {
      ...paymentSummary,
      advanceReceivedAmount: totals.advanceReceivedAmount,
      balanceDue: totals.balanceDue,
      paymentStatus: suggestPaymentStatus(paymentSummary, totals),
    },
    activity,
  };
}

function syncProspectAdvancePaymentMilestone(client) {
  if (!client?.prospectId) {
    return;
  }

  const workflow = getProspectWorkflow(client.prospectId);
  state.prospectWorkflows[client.prospectId] = {
    ...workflow,
    milestones: {
      ...(workflow.milestones || {}),
      "Advance payment received": true,
    },
    updated_at: new Date().toISOString(),
  };
  persistProspectWorkflows();
  recordProspectActivity(client.prospectId, "Advance payment received", "Payments", "advance-payment-received");
}

function normalizeDocumentChecklist(checklist) {
  const defaults = getDefaultDocumentChecklist();
  const existingItems = Array.isArray(checklist?.items) ? checklist.items : [];
  return {
    items: defaults.items.map((defaultItem) => {
      const existingItem = existingItems.find((item) => item?.key === defaultItem.key) || {};
      return {
        ...defaultItem,
        checked: Boolean(existingItem.checked),
        note: String(existingItem.note || "").trim(),
        updatedAt: existingItem.updatedAt || "",
      };
    }),
  };
}

function getDefaultDocumentRecord(payload = {}) {
  const now = new Date().toISOString();
  return {
    documentId: payload.documentId || `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    category: DOCUMENT_CATEGORIES.includes(payload.category) ? payload.category : "Other",
    title: String(payload.title || "").trim(),
    status: DOCUMENT_STATUSES.includes(payload.status) ? payload.status : "Needed",
    storageLocation: DOCUMENT_STORAGE_LOCATIONS.includes(payload.storageLocation) ? payload.storageLocation : "Other",
    linkOrReference: String(payload.linkOrReference || "").trim(),
    dueDate: String(payload.dueDate || "").trim(),
    receivedDate: String(payload.receivedDate || "").trim(),
    notes: String(payload.notes || "").trim(),
    createdAt: payload.createdAt || now,
    updatedAt: payload.updatedAt || now,
  };
}

function normalizeClientDocuments(documents) {
  return Array.isArray(documents) ? documents.map((document) => getDefaultDocumentRecord(document)) : [];
}

function calculateDocumentProgress(checklist, documents = []) {
  const normalizedChecklist = normalizeDocumentChecklist(checklist);
  const totalRequired = normalizedChecklist.items.length;
  const completed = normalizedChecklist.items.filter((item) => item.checked).length;
  const missing = totalRequired - completed;
  const overdue = getOverdueDocuments(documents).length;
  return { totalRequired, completed, missing, overdue };
}

function getDocumentStatus(progress) {
  if (!progress.completed && !progress.overdue) {
    return "Not Started";
  }

  if (progress.overdue || progress.missing > 0) {
    return progress.completed ? "Waiting on Client" : "In Progress";
  }

  if (progress.completed === progress.totalRequired) {
    return "Complete";
  }

  return "Ready";
}

function getOverdueDocuments(documents = []) {
  const today = getTodayDateKey();
  return normalizeClientDocuments(documents).filter((document) => {
    const dueDate = String(document.dueDate || "").slice(0, 10);
    return dueDate && dueDate < today && !["Received", "Approved", "Not Required"].includes(document.status);
  });
}

function getDefaultHandoverChecklist() {
  return {
    groups: HANDOVER_CHECKLIST_GROUPS.map((group) => ({
      key: group.key,
      title: group.title,
      items: group.items.map(([key, label, critical = false]) => ({
        key,
        label,
        critical: Boolean(critical),
        checked: false,
        note: "",
        updatedAt: "",
      })),
    })),
  };
}

function normalizeHandoverChecklist(checklist) {
  const defaults = getDefaultHandoverChecklist();
  const existingGroups = Array.isArray(checklist?.groups) ? checklist.groups : [];

  return {
    groups: defaults.groups.map((defaultGroup) => {
      const existingGroup = existingGroups.find((group) => group?.key === defaultGroup.key) || {};
      const existingItems = Array.isArray(existingGroup.items) ? existingGroup.items : [];

      return {
        ...defaultGroup,
        items: defaultGroup.items.map((defaultItem) => {
          const existingItem = existingItems.find((item) => item?.key === defaultItem.key) || {};
          return {
            ...defaultItem,
            checked: Boolean(existingItem.checked),
            note: String(existingItem.note || "").trim(),
            updatedAt: existingItem.updatedAt || "",
          };
        }),
      };
    }),
  };
}

function calculateHandoverProgress(checklist) {
  const items = normalizeHandoverChecklist(checklist).groups.flatMap((group) => group.items);
  const total = items.length;
  const completed = items.filter((item) => item.checked).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

function getHandoverStatus(client, progress = calculateHandoverProgress(client?.handoverChecklist)) {
  if ((client?.handoverStatus || "") === "Blocked" || String(client?.handoverBlocker || "").trim()) {
    return "Blocked";
  }

  if ((client?.handoverStatus || "") === "Support Started") {
    return client.handoverStatus;
  }

  if (!progress.percentage) {
    return "Not Started";
  }

  if (progress.percentage === 100) {
    return "Completed";
  }

  if (HANDOVER_STATUSES.includes(client?.handoverStatus) && client.handoverStatus !== "Not Started") {
    return client.handoverStatus;
  }

  if (progress.percentage >= 61) {
    return "Ready for Client";
  }

  return "Preparing";
}

function getMissingCriticalHandoverItems(checklist) {
  return normalizeHandoverChecklist(checklist)
    .groups.flatMap((group) => group.items)
    .filter((item) => item.critical && !item.checked)
    .map((item) => item.label);
}

function getDefaultOnboardingChecklist() {
  return {
    groups: ONBOARDING_CHECKLIST_GROUPS.map((group) => ({
      key: group.key,
      title: group.title,
      items: group.items.map(([key, label, critical = false]) => ({
        key,
        label,
        critical: Boolean(critical),
        checked: false,
        note: "",
        updatedAt: "",
      })),
    })),
  };
}

function normalizeOnboardingChecklist(checklist) {
  const defaults = getDefaultOnboardingChecklist();
  const existingGroups = Array.isArray(checklist?.groups) ? checklist.groups : [];

  return {
    groups: defaults.groups.map((defaultGroup) => {
      const existingGroup = existingGroups.find((group) => group?.key === defaultGroup.key) || {};
      const existingItems = Array.isArray(existingGroup.items) ? existingGroup.items : [];

      return {
        ...defaultGroup,
        items: defaultGroup.items.map((defaultItem) => {
          const existingItem = existingItems.find((item) => item?.key === defaultItem.key) || {};
          return {
            ...defaultItem,
            checked: Boolean(existingItem.checked),
            note: String(existingItem.note || "").trim(),
            updatedAt: existingItem.updatedAt || "",
          };
        }),
      };
    }),
  };
}

function calculateOnboardingProgress(checklist) {
  const normalized = normalizeOnboardingChecklist(checklist);
  const items = normalized.groups.flatMap((group) => group.items);
  const total = items.length;
  const completed = items.filter((item) => item.checked).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}

function getOnboardingStatus(progress, missingCriticalItems = []) {
  if (!progress.percentage) {
    return "Not Started";
  }

  if (progress.percentage === 100) {
    return "Complete";
  }

  if (missingCriticalItems.length && progress.percentage >= 25) {
    return "Blocked";
  }

  if (progress.percentage >= 70) {
    return "Ready for Build";
  }

  return "In Progress";
}

function getMissingCriticalItems(checklist) {
  return normalizeOnboardingChecklist(checklist)
    .groups.flatMap((group) => group.items)
    .filter((item) => item.critical && !item.checked)
    .map((item) => item.label.replace(/^Confirm |^Collect /, ""));
}

function getClientByProspect(company) {
  if (!company) {
    return null;
  }

  const prospectId = String(company.id || "").trim();
  const dedupeKey = getProspectDedupeKey(company);
  const linkedClientId = String(company.clientId || getProspectWorkflow(company.id)?.clientId || "").trim();
  return (
    state.clients.find((client) => linkedClientId && client.clientId === linkedClientId) ||
    state.clients.find((client) => prospectId && client.prospectId === prospectId) ||
    state.clients.find((client) => dedupeKey && client.dedupeKey === dedupeKey) ||
    null
  );
}

function isProspectEligibleForClientConversion(company) {
  const milestones = company?.milestones && typeof company.milestones === "object" ? company.milestones : {};
  const stage = normalizeProspectStage(company?.currentStage || company?.prospect_stage || company?.stage || "New Lead");
  return (
    ["Contract Expected", "Contract Received", "Client Converted", "Client Onboarding"].includes(stage) ||
    String(company?.quote_status || "").trim() === "Accepted" ||
    Boolean(milestones["Contract received"]) ||
    Boolean(milestones["Advance payment received"])
  );
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

function isSupabaseSavedProspectsActive() {
  const status = storageService.getStatus();
  return status.activeMode === "supabase" && status.supabaseConfigured;
}

function getCompanyForSavedProspect(companyId) {
  return (
    state.companies.find((item) => item.id === companyId) ||
    state.manualProspects.find((item) => item.id === companyId) ||
    { id: companyId }
  );
}

async function persistSavedProspectRecord(companyId) {
  if (!isSupabaseSavedProspectsActive() || !companyId || !state.savedCompanies.includes(companyId)) {
    return;
  }

  try {
    await storageService.saveProspect(getCompanyForSavedProspect(companyId), getProspectWorkflow(companyId));
  } catch (error) {
    elements.statusMessage.textContent = "Saved locally. Supabase saved prospect sync failed.";
  }
}

async function persistSavedProspectRemoval(company) {
  if (!isSupabaseSavedProspectsActive()) {
    return;
  }

  try {
    await storageService.removeSavedProspect(company);
  } catch (error) {
    elements.statusMessage.textContent = "Removed locally. Supabase saved prospect removal failed.";
  }
}

function persistSavedProspectArchiveState(company, archived) {
  if (!isSupabaseSavedProspectsActive()) {
    return;
  }

  const action = archived ? storageService.archiveSavedProspect : storageService.unarchiveSavedProspect;
  action.call(storageService, company).catch(() => {
    elements.statusMessage.textContent = "Archive updated locally. Supabase saved prospect update failed.";
  });
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
    primaryEmail: company?.primaryEmail || company?.primary_contact?.email || "",
    additionalEmails: Array.isArray(company?.additionalEmails) ? company.additionalEmails : [],
    contactPersonName: company?.contactPersonName || company?.primary_contact?.name || "",
    contactPersonTitle: company?.contactPersonTitle || company?.primary_contact?.title || "",
    facebookUrl: company?.facebookUrl || company?.facebook_url || "",
    instagramUrl: company?.instagramUrl || company?.instagram_url || "",
    linkedinUrl: company?.linkedinUrl || company?.linkedin_url || company?.primary_contact?.linkedin_url || "",
    websiteContactPageUrl: company?.websiteContactPageUrl || "",
    bookingUrl: company?.bookingUrl || company?.booking_url || "",
    sourceLinks: Array.isArray(company?.sourceLinks) ? company.sourceLinks : [],
    enrichmentStatus: company?.enrichmentStatus || "Not Checked",
    enrichmentCheckedAt: company?.enrichmentCheckedAt || "",
    enrichmentNotes: company?.enrichmentNotes || "",
    outreach_templates: company?.outreach_templates && typeof company.outreach_templates === "object" ? company.outreach_templates : {},
    outreach_tone: company?.outreach_tone || "Professional",
    searchMode: company?.searchMode || DEFAULT_SEARCH_MODE,
    recordPurpose: company?.recordPurpose || getSearchMode(company?.searchMode).recordPurpose,
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
  const filters = getActiveFilters();
  const searchMode = company.searchMode || filters.searchMode || DEFAULT_SEARCH_MODE;
  state.prospectWorkflows[company.id] = {
    ...workflow,
    milestones: {
      ...(workflow.milestones || {}),
      "Saved to prospects": true,
    },
    currentStage: nextStage,
    prospect_stage: nextStage,
    quote_status: workflow.quote_status || "Not Started",
    searchMode: workflow.searchMode || searchMode,
    recordPurpose: workflow.recordPurpose || company.recordPurpose || getSearchMode(searchMode).recordPurpose,
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
  if (state.activeView === "discovery" && !state.searchStarted) {
    return DEFAULT_DISCOVERY_PROMPT;
  }

  if (state.activeView === "dashboard") {
    const metrics = getDashboardMetrics();
    return `${metrics.followUpsDueToday} follow-up${metrics.followUpsDueToday === 1 ? "" : "s"} due today, ${metrics.blockedClients} blocked client${metrics.blockedClients === 1 ? "" : "s"}.`;
  }

  if (state.activeView === "pipeline") {
    const savedCount = getFilteredPipelineProspects().length;
    return `${savedCount} saved prospect${savedCount === 1 ? "" : "s"} grouped by Current Stage.`;
  }

  if (state.activeView === "clients") {
    return `${state.clients.length} active client record${state.clients.length === 1 ? "" : "s"}.`;
  }

  if (state.activeView === "lists") {
    const selectedList = getSelectedSavedList();
    return selectedList
      ? `${state.savedLists.length} saved list${state.savedLists.length === 1 ? "" : "s"}. Open list: ${selectedList.listName}.`
      : "Create a saved list to organize prospects by use case.";
  }

  if (state.activeView === "followups") {
    const actionCount = getActionCenterItems().length;
    return `${actionCount} action${actionCount === 1 ? "" : "s"} across follow-ups, quotes, clients, support, and cleanup.`;
  }

  if (state.activeView === "settings") {
    return "Workspace, storage, and migration readiness.";
  }

  if (state.activeView === "saved") {
    return `${state.filteredCompanies.length} saved prospect${state.filteredCompanies.length === 1 ? "" : "s"} sorted by current stage, quote status, and next follow-up.`;
  }

  return `${state.filteredCompanies.length} matches - ${getSearchSummary(filters)}`;
}

function getSearchSummary(filters = getActiveFilters()) {
  const location = [filters.cityLabel, filters.state].filter(Boolean).join(", ") || filters.state || "All locations";
  const conditions = [
    formatWebsiteCondition(filters.websiteCondition),
    formatMobileAppCondition(filters.mobileAppCondition),
    formatBookingSystemCondition(filters.bookingSystemCondition),
    formatOnlinePaymentCondition(filters.onlinePaymentCondition),
    formatSocialPresenceCondition(filters.socialPresenceCondition),
  ].filter((item) => item && item !== "Any");
  const mode = getSearchMode(filters.searchMode).label;
  const parts = [
    filters.customKeyword || filters.keywordLabel || "Any business type",
    location,
    ...conditions.slice(0, 3),
  ];

  if (filters.phoneAvailable) {
    parts.push(`Phone: ${filters.phoneAvailable === "yes" ? "Yes" : "No"}`);
  }
  if (filters.minimumRating > 0) {
    parts.push(`Rating ${filters.minimumRating}+`);
  }
  if (filters.minimumReviewCount > 0) {
    parts.push(`${filters.minimumReviewCount}+ reviews`);
  }
  if (filters.searchMode && filters.searchMode !== DEFAULT_SEARCH_MODE) {
    parts.push(mode);
  }

  return parts.join(" • ");
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
    ...(Array.isArray(company.contacts) ? company.contacts : []).map((contact) => contact.source_url),
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
  const preset = groupConfig.types[businessType];
  const typeQuery = Array.isArray(preset?.searchKeywords)
    ? preset.searchKeywords.join(" ")
    : typeof preset === "string"
      ? preset
      : businessType;
  return [businessType, typeQuery, groupConfig.query].filter(Boolean).join(" ").trim();
}

function buildSearchKeyword(filters) {
  if (filters.customKeyword) {
    return filters.customKeyword.trim();
  }

  return normalizeBusinessTypeForGroup(filters.industry || DEFAULT_INDUSTRY, filters.keywordLabel || DEFAULT_SEARCH_KEYWORD);
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
}

function flattenContacts(companies) {
  return (Array.isArray(companies) ? companies : []).flatMap((company) =>
    Array.isArray(company?.contacts) ? company.contacts : []
  );
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

function downloadBlob(filename, content, contentType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugifyFilename(value) {
  return String(value || "saved-list")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "saved-list";
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

function loadSavedLists() {
  const parsed = readLocalJson(SAVED_LISTS_KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizeSavedList).filter((list) => list.listId) : [];
}

function persistSavedLists() {
  writeLocalJson(SAVED_LISTS_KEY, state.savedLists.map(normalizeSavedList));
}

function normalizeSavedList(list) {
  return {
    listId: String(list?.listId || `list-${Date.now()}`).trim(),
    listName: String(list?.listName || "Untitled List").trim(),
    description: String(list?.description || "").trim(),
    searchMode: String(list?.searchMode || "").trim(),
    businessTypeGroup: String(list?.businessTypeGroup || "").trim(),
    businessType: String(list?.businessType || "").trim(),
    city: String(list?.city || "").trim(),
    state: String(list?.state || "").trim(),
    tags: Array.isArray(list?.tags)
      ? list.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
      : String(list?.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    prospectIds: Array.isArray(list?.prospectIds) ? [...new Set(list.prospectIds.map((id) => String(id || "").trim()).filter(Boolean))] : [],
    createdAt: list?.createdAt || new Date().toISOString(),
    updatedAt: list?.updatedAt || new Date().toISOString(),
  };
}

function createSavedListFromCurrentFilters() {
  const filters = getActiveFilters();
  const payload = {};
  elements.resultsContainer.querySelectorAll("[data-new-list-field]").forEach((field) => {
    payload[field.getAttribute("data-new-list-field")] = field.value || "";
  });
  const listName = String(payload.listName || "").trim();
  if (!listName) {
    elements.statusMessage.textContent = "Enter a list name first.";
    return;
  }

  const list = normalizeSavedList({
    listId: `list-${Date.now()}`,
    listName,
    description: payload.description || "",
    tags: payload.tags || "",
    searchMode: filters.searchMode || "",
    businessTypeGroup: filters.industry || "",
    businessType: filters.keywordLabel || "",
    city: filters.cityLabel || "",
    state: filters.state || "",
    prospectIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  state.savedLists = [list, ...state.savedLists];
  state.selectedListId = list.listId;
  persistSavedLists();
  elements.statusMessage.textContent = `Created saved list ${list.listName}.`;
  render();
}

async function enrichProspectContactInfo(companyId) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  elements.statusMessage.textContent = `Checking contact enrichment for ${company.name || "prospect"}...`;
  updateProspectContactFields(companyId, {
    enrichmentStatus: "Not Checked",
    enrichmentCheckedAt: new Date().toISOString(),
  }, { skipActivity: true, skipRender: true });

  try {
    const response = await fetch("/api/prospects/enrich-contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        websiteUrl: company.website || company.websiteUrl || "",
        businessName: company.name || company.businessName || "",
        phone: company.phone || "",
        address: company.address || "",
        sourceUrl: company.source_url || "",
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Unable to enrich contact info.");
    }

    const before = getContactCompleteness(company);
    updateProspectContactFields(companyId, payload.enrichment || {}, { skipActivity: true, skipRender: true, fillEmptyOnly: true });
    const updated = state.companies.find((item) => item.id === companyId) || company;
    const after = getContactCompleteness(updated);
    recordProspectActivity(companyId, "Contact enrichment checked", "System", "contact-enrichment-checked");
    if (after > before) {
      recordProspectActivity(companyId, "Contact enrichment found new info", "System", "contact-enrichment-found");
    }
    elements.statusMessage.textContent = payload.enrichment?.enrichmentStatus === "Failed"
      ? "Contact enrichment needs review."
      : "Contact enrichment checked.";
  } catch (error) {
    updateProspectContactFields(companyId, {
      enrichmentStatus: "Failed",
      enrichmentCheckedAt: new Date().toISOString(),
      enrichmentNotes: "Unable to enrich contact info.",
    }, { skipActivity: true, skipRender: true });
    recordProspectActivity(companyId, "Contact enrichment checked", "System", "contact-enrichment-checked");
    elements.statusMessage.textContent = "Unable to enrich contact info.";
  }

  applyFilters();
  renderDetail();
}

function updateProspectContactFields(companyId, fields = {}, options = {}) {
  const company = state.companies.find((item) => item.id === companyId);
  if (!company) {
    return;
  }

  ensureSavedProspect(company);
  const workflow = getProspectWorkflow(companyId);
  const now = new Date().toISOString();
  const nextFields = buildContactFieldUpdates({ ...company, ...workflow }, fields, Boolean(options.fillEmptyOnly));
  state.prospectWorkflows[companyId] = {
    ...workflow,
    ...nextFields,
    updated_at: now,
    lastUpdatedAt: now,
  };
  persistProspectWorkflows();
  applyProspectWorkflow(company);
  if (!options.skipActivity) {
    recordProspectActivity(companyId, "Updated contact enrichment fields", "Manual", "contact-fields-update");
  }
  if (!options.skipRender) {
    elements.statusMessage.textContent = "Contact fields saved.";
    renderDetail();
    applyFilters();
  }
}

function buildContactFieldUpdates(existing, incoming, fillEmptyOnly = false) {
  const fields = [
    "primaryEmail",
    "additionalEmails",
    "contactPersonName",
    "contactPersonTitle",
    "facebookUrl",
    "instagramUrl",
    "linkedinUrl",
    "websiteContactPageUrl",
    "bookingUrl",
    "sourceLinks",
    "enrichmentStatus",
    "enrichmentCheckedAt",
    "enrichmentNotes",
    "bookingPlatform",
    "socialPlatform",
  ];
  return fields.reduce((updates, field) => {
    const value = incoming[field];
    const hasIncoming = Array.isArray(value) ? value.length > 0 : String(value ?? "").trim() !== "";
    const hasExisting = Array.isArray(existing[field]) ? existing[field].length > 0 : String(existing[field] ?? "").trim() !== "";
    if (!hasIncoming || (fillEmptyOnly && hasExisting)) {
      return updates;
    }
    updates[field] = value;
    return updates;
  }, {});
}

function getContactCompleteness(company) {
  return [
    company.primaryEmail || company.primary_contact?.email,
    company.contactPersonName || company.primary_contact?.name,
    company.facebookUrl,
    company.instagramUrl,
    company.linkedinUrl || company.primary_contact?.linkedin_url,
    company.bookingUrl,
    company.websiteContactPageUrl,
  ].filter(Boolean).length;
}

function getSelectedSavedList() {
  return state.savedLists.find((list) => list.listId === state.selectedListId) || state.savedLists[0] || null;
}

function getProspectsForList(listId) {
  const list = state.savedLists.find((item) => item.listId === listId);
  if (!list) {
    return [];
  }
  return list.prospectIds
    .map((id) => state.companies.find((company) => company.id === id) || state.manualProspects.find((company) => company.id === id))
    .filter(Boolean)
    .map((company) => applyProspectWorkflow(company));
}

function addProspectToList(companyId, listId) {
  if (!companyId || !listId) {
    return;
  }
  state.savedLists = state.savedLists.map((list) =>
    list.listId === listId
      ? normalizeSavedList({ ...list, prospectIds: [...new Set([...(list.prospectIds || []), companyId])], updatedAt: new Date().toISOString() })
      : list
  );
  persistSavedLists();
  elements.statusMessage.textContent = "Prospect added to list.";
  renderDetail();
  if (state.activeView === "lists") render();
}

function removeProspectFromList(companyId, listId) {
  state.savedLists = state.savedLists.map((list) =>
    list.listId === listId
      ? normalizeSavedList({ ...list, prospectIds: (list.prospectIds || []).filter((id) => id !== companyId), updatedAt: new Date().toISOString() })
      : list
  );
  persistSavedLists();
  elements.statusMessage.textContent = "Prospect removed from list.";
  render();
}

function persistSavedCompanies() {
  state.savedCompanies = dedupeSavedCompanyIds(state.savedCompanies);
  writeLocalJson(SAVED_COMPANIES_KEY, state.savedCompanies);
}

function dedupeSavedCompanyIds(savedIds = []) {
  const canonicalIds = [];
  const seenKeys = new Set();

  [...new Set((Array.isArray(savedIds) ? savedIds : []).map((id) => String(id || "").trim()).filter(Boolean))].forEach((id) => {
    const company = state.companies.find((item) => item.id === id) || state.manualProspects.find((item) => item.id === id) || { id };
    const keys = getProspectDedupeKeys(company);
    const hasDuplicate = keys.some((key) => seenKeys.has(key));
    if (hasDuplicate) {
      return;
    }

    canonicalIds.push(id);
    keys.forEach((key) => seenKeys.add(key));
  });

  return canonicalIds;
}

function loadProspectWorkflows() {
  const parsed = readLocalJson(PROSPECT_WORKFLOWS_KEY, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function persistProspectWorkflows() {
  writeLocalJson(PROSPECT_WORKFLOWS_KEY, state.prospectWorkflows);
  if (isSupabaseSavedProspectsActive()) {
    state.savedCompanies.forEach((companyId) => {
      storageService
        .updateSavedProspect(companyId, {
          prospect: getCompanyForSavedProspect(companyId),
          workflow: getProspectWorkflow(companyId),
        })
        .catch(() => {});
    });
  }
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
  return storageService.readJson(key, fallbackValue);
}

function writeLocalJson(key, value) {
  storageService.writeJson(key, value);
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

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateOnly(value) {
  if (!value) {
    return "NA";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "NA" : date.toLocaleDateString();
}
