import { getScanStatusMeta, SCAN_STATUS } from "./scanner.js";
import { DEFAULT_SEARCH_MODE, getModeSpecificResultLabel } from "./searchConfig.js";

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
const QUOTE_PROJECT_TYPES = [
  "Website",
  "Website Redesign",
  "Website + Booking",
  "Website + Basic SEO",
  "Mobile App",
  "Website + Mobile App",
  "Maintenance / Support",
  "Other",
];
const QUOTE_PACKAGE_TYPES = ["Starter", "Professional", "Premium", "Custom"];
const FOLLOW_UP_PRIORITIES = ["Low", "Normal", "High"];
const CONVERTIBLE_STAGES = new Set(["Contract Expected", "Contract Received", "Client Onboarding"]);
const COMMUNICATION_METHODS = ["Call", "Email", "SMS", "WhatsApp", "Onsite Visit", "LinkedIn", "Other"];
const ACTIVITY_TYPES = [
  "Intro Email Sent",
  "SMS/WhatsApp Copied",
  "SMS/WhatsApp Sent",
  "Message Sent",
  "Call Attempted",
  "Onsite Visit Done",
  "Virtual Meeting Done",
  "Client Responded",
  "Requirements Discussed",
  "Quote Requested",
  "Quote Sent",
  "Follow-Up Sent",
  "Contract Sent",
  "Contract Received",
  "Advance Payment Received",
  "Note Added",
  "Status Changed",
];
const PROCESS_MILESTONES = [
  "Saved to prospects",
  "Initial intro email sent",
  "Call attempted",
  "WhatsApp/message sent",
  "Onsite visit done",
  "Virtual meeting done",
  "Client responded",
  "Requirements discussed",
  "Quote requested",
  "Quote sent",
  "Follow-up sent",
  "Contract sent",
  "Contract received",
  "Advance payment received",
];

export function renderResultsView({
  companies,
  container,
  viewMode,
  scanner,
  selectedCompanyId,
  savedCompanies,
  onOpenDetails,
  onScanCompany,
  onRetryScan,
  onToggleSavedCompany,
  onHideCompany,
  mode = "discovery",
  searchMode = DEFAULT_SEARCH_MODE,
}) {
  if (!companies.length) {
    container.innerHTML = "";
    return;
  }

  container.className = "results-container list-view";
  container.innerHTML = renderCompanyTable(companies, scanner, selectedCompanyId, savedCompanies, mode, searchMode);

  container.querySelectorAll("[data-open-details]").forEach((button) => {
    button.addEventListener("click", () => onOpenDetails(button.getAttribute("data-open-details")));
  });

  container.querySelectorAll("[data-scan-company]").forEach((button) => {
    button.addEventListener("click", () => onScanCompany(button.getAttribute("data-scan-company")));
  });

  container.querySelectorAll("[data-retry-scan]").forEach((button) => {
    button.addEventListener("click", () => onRetryScan(button.getAttribute("data-retry-scan")));
  });

  container.querySelectorAll("[data-save-company]").forEach((button) => {
    button.addEventListener("click", () => onToggleSavedCompany(button.getAttribute("data-save-company")));
  });

  container.querySelectorAll("[data-hide-company]").forEach((button) => {
    button.addEventListener("click", () => onHideCompany(button.getAttribute("data-hide-company")));
  });
}

export function renderDetailPanel({
  company,
  activeTab,
  savedCompanies,
  savedLists = [],
  container,
  onChangeTab,
  onScanCompany,
  onRetryScan,
  onToggleSavedCompany,
  onUpdateProspectStatus,
  onAddCommunicationEntry,
  onAddProspectNote,
  onSetNextFollowUp,
  onToggleMilestone,
  onCheckWebsiteQuality,
  onEnrichContactInfo,
  onSaveContactFields,
  onCopyOutreachTemplate,
  onMarkOutreachMilestone,
  senderProfile,
  outreachDrafts,
  onSaveSenderProfile,
  onSetOutreachTone,
  onEditOutreachTemplate,
  onUpdateOutreachTemplateDraft,
  onSaveOutreachTemplate,
  onResetOutreachTemplate,
  onApproveContact,
  onMarkBadContact,
  onCopyContactEmail,
  onCopyContactPhone,
  onAddProspectToList,
  onRemoveProspectFromList,
  onConvertToClient,
  onOpenClientProfile,
}) {
  if (!company) {
    container.innerHTML = `
      <div class="detail-empty">
        <p class="detail-empty-eyebrow">Prospect details</p>
        <h2>Select a prospect</h2>
        <p>Choose a prospect card to review business information, communication, notes, quote status, and next actions.</p>
      </div>
    `;
    return;
  }

  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const primaryContact = company.primary_contact || null;
  const otherContacts = contacts.filter((contact) => !isSameContact(contact, primaryContact));
  const isSaved = Array.isArray(savedCompanies) && savedCompanies.includes(company.id);
  const availableTabs = ["overview", "contact", "outreach", "activity", "process", "notes", "quote"];
  const selectedTab = availableTabs.includes(activeTab) ? activeTab : "overview";
  const statusMeta = getScanStatusMeta(company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = company.scan_failure_reason || "";
  const prospectStage = getProspectStage(company);
  const existingClientId = String(company.clientId || "").trim();
  const canConvertToClient = isProspectEligibleForClientConversion(company);

  container.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">Prospect profile</p>
        <h2 id="detail-modal-title">${escapeHtml(company.name || "NA")}</h2>
        <p class="detail-location">${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</p>
      </div>
      <span class="status-pill ${statusMeta.cssClass}">
        <span class="status-dot"></span>
        ${escapeHtml(statusMeta.label)}
      </span>
    </div>

    <div class="detail-tag-row">
      <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.opportunityPriority || company.lead_label))}">${escapeHtml(company.opportunityPriority || company.lead_label || "Needs Review")}</span>
      <span class="detail-tag">${escapeHtml(String(company.lead_score || 0))}/100 opportunity score</span>
      <span class="detail-tag">${escapeHtml(prospectStage)}</span>
      ${company.archived ? `<span class="detail-tag">Archived</span>` : ""}
      ${company.is_hidden && !company.archived ? `<span class="detail-tag">Hidden</span>` : ""}
      ${company.outreach_ready ? `<span class="detail-tag">Outreach ready</span>` : ""}
      ${(company.industry_tags || [company.industry || "NA"])
        .map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`)
        .join("")}
    </div>

    <div class="detail-actions">
      <a class="primary-btn inline-link-btn" href="${escapeAttribute(company.website || "#")}" target="_blank" rel="noreferrer">Website</a>
      <button class="secondary-btn" type="button" data-detail-scan="${escapeAttribute(company.id)}">Deep Scan</button>
      <button class="secondary-btn" type="button" data-check-website-quality="${escapeAttribute(company.id)}">
        ${company.websiteCheckStatus === "Checking" ? "Checking..." : "Check Website Quality"}
      </button>
      ${
        failureReason
          ? `<button class="secondary-btn" type="button" data-detail-retry="${escapeAttribute(company.id)}">Retry</button>`
          : ""
      }
      <button class="secondary-btn" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved Prospect" : "Save Prospect"}</button>
      ${renderListSelector(company, savedLists)}
      ${
        existingClientId
          ? `<button class="primary-btn" type="button" data-open-client-profile="${escapeAttribute(existingClientId)}">Open Client Profile</button>`
          : canConvertToClient
            ? `<button class="primary-btn" type="button" data-convert-to-client="${escapeAttribute(company.id)}">Convert to Client</button>`
            : `<span class="toolbar-subtle">Available after quote acceptance or contract progress.</span>`
      }
    </div>

    <div class="detail-tabs">
      ${availableTabs
        .map(
          (tab) => `
            <button class="detail-tab ${selectedTab === tab ? "active" : ""}" type="button" data-detail-tab="${tab}">
              ${escapeHtml(formatDetailTab(tab))}
            </button>
          `
        )
        .join("")}
    </div>

    <div class="detail-body">
      ${renderTabContent({
        company,
        primaryContact,
        otherContacts,
        activeTab: selectedTab,
        isSaved,
        senderProfile,
        outreachDrafts,
        onSaveSenderProfile,
        onSetOutreachTone,
        onEditOutreachTemplate,
        onUpdateOutreachTemplateDraft,
        onSaveOutreachTemplate,
        onResetOutreachTemplate,
        onSaveQuoteDetails,
        onCopyQuoteSummary,
        onMarkQuoteSent,
        onMarkQuoteAccepted,
        onMarkQuoteRejected,
      })}
    </div>
  `;

  container.querySelectorAll("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => onChangeTab(button.getAttribute("data-detail-tab")));
  });

  const scanButton = container.querySelector("[data-detail-scan]");
  if (scanButton) {
    scanButton.addEventListener("click", () => onScanCompany(scanButton.getAttribute("data-detail-scan")));
  }

  const retryButton = container.querySelector("[data-detail-retry]");
  if (retryButton) {
    retryButton.addEventListener("click", () => onRetryScan(retryButton.getAttribute("data-detail-retry")));
  }

  const qualityButton = container.querySelector("[data-check-website-quality]");
  if (qualityButton) {
    qualityButton.addEventListener("click", () =>
      onCheckWebsiteQuality(qualityButton.getAttribute("data-check-website-quality"))
    );
  }

  const enrichButton = container.querySelector("[data-enrich-contact]");
  if (enrichButton) {
    enrichButton.addEventListener("click", () => onEnrichContactInfo?.(enrichButton.getAttribute("data-enrich-contact")));
  }

  const saveContactFieldsButton = container.querySelector("[data-save-contact-fields]");
  if (saveContactFieldsButton) {
    saveContactFieldsButton.addEventListener("click", () =>
      onSaveContactFields?.(
        saveContactFieldsButton.getAttribute("data-save-contact-fields"),
        readContactFieldsPayload(container)
      )
    );
  }

  container.querySelectorAll("[data-outreach-copy]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-outreach-card]");
      const templateBody = card?.querySelector("[data-outreach-body]");
      const templateLabel = button.getAttribute("data-outreach-label") || "Template";
      const templateKey = button.getAttribute("data-outreach-copy") || templateLabel;
      onCopyOutreachTemplate(
        button.getAttribute("data-company-id"),
        templateKey,
        templateLabel,
        templateBody?.value || templateBody?.textContent || ""
      );
    });
  });

  container.querySelectorAll("[data-outreach-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-outreach-card]");
      const templateBody = card?.querySelector("[data-outreach-body]");
      const templateKey = button.getAttribute("data-outreach-edit") || "";
      const companyId = button.getAttribute("data-company-id");
      if (!templateBody || !companyId) {
        return;
      }

      if (templateBody.hasAttribute("readonly")) {
        onEditOutreachTemplate(companyId, templateKey);
      } else {
        onSaveOutreachTemplate(companyId, templateKey, templateBody.value || templateBody.textContent || "");
      }
    });
  });

  container.querySelectorAll("[data-outreach-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      onResetOutreachTemplate(button.getAttribute("data-company-id"), button.getAttribute("data-outreach-reset") || "");
    });
  });

  container.querySelectorAll("[data-outreach-body]").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const card = textarea.closest("[data-outreach-card]");
      const templateKey = card?.getAttribute("data-outreach-card") || "";
      const companyId = card?.querySelector("[data-outreach-copy]")?.getAttribute("data-company-id") || "";
      if (templateKey && companyId && onUpdateOutreachTemplateDraft) {
        onUpdateOutreachTemplateDraft(companyId, templateKey, textarea.value || "");
      }
    });
  });

  container.querySelectorAll("[data-outreach-mark]").forEach((button) => {
    button.addEventListener("click", () => {
      onMarkOutreachMilestone(
        button.getAttribute("data-company-id"),
        button.getAttribute("data-outreach-mark"),
        button.getAttribute("data-outreach-message") || ""
      );
    });
  });

  const quoteFields = container.querySelectorAll("[data-quote-field]");
  quoteFields.forEach((field) => {
    const refresh = () => updateQuotePreview(container, company, senderProfile);
    field.addEventListener("input", refresh);
    field.addEventListener("change", refresh);
  });

  const saveQuoteButton = container.querySelector("[data-save-quote-details]");
  if (saveQuoteButton) {
    saveQuoteButton.addEventListener("click", () => onSaveQuoteDetails(saveQuoteButton.getAttribute("data-company-id"), readQuotePayload(container)));
  }

  const copyQuoteButton = container.querySelector("[data-copy-quote-summary]");
  if (copyQuoteButton) {
    copyQuoteButton.addEventListener("click", () => {
      const companyId = copyQuoteButton.getAttribute("data-company-id");
      onCopyQuoteSummary(companyId, readQuotePayload(container));
      showTransientButtonState(copyQuoteButton, "Copied");
    });
  }

  const sentQuoteButton = container.querySelector("[data-mark-quote-sent]");
  if (sentQuoteButton) {
    sentQuoteButton.addEventListener("click", () => onMarkQuoteSent(sentQuoteButton.getAttribute("data-company-id"), readQuotePayload(container)));
  }

  const acceptedQuoteButton = container.querySelector("[data-mark-quote-accepted]");
  if (acceptedQuoteButton) {
    acceptedQuoteButton.addEventListener("click", () =>
      onMarkQuoteAccepted(acceptedQuoteButton.getAttribute("data-company-id"), readQuotePayload(container))
    );
  }

  const rejectedQuoteButton = container.querySelector("[data-mark-quote-rejected]");
  if (rejectedQuoteButton) {
    rejectedQuoteButton.addEventListener("click", () =>
      onMarkQuoteRejected(rejectedQuoteButton.getAttribute("data-company-id"), readQuotePayload(container))
    );
  }

  const convertButton = container.querySelector("[data-convert-to-client]");
  if (convertButton) {
    convertButton.addEventListener("click", () => onConvertToClient(convertButton.getAttribute("data-convert-to-client")));
  }

  const openClientButton = container.querySelector("[data-open-client-profile]");
  if (openClientButton) {
    openClientButton.addEventListener("click", () => onOpenClientProfile(openClientButton.getAttribute("data-open-client-profile")));
  }

  const toneSelect = container.querySelector("[data-outreach-tone]");
  if (toneSelect) {
    toneSelect.addEventListener("change", () =>
      onSetOutreachTone(toneSelect.getAttribute("data-company-id") || company.id, toneSelect.value)
    );
  }

  const saveSenderButton = container.querySelector("[data-save-sender-profile]");
  if (saveSenderButton) {
    saveSenderButton.addEventListener("click", () => onSaveSenderProfile(readSenderProfilePayload(container)));
  }

  updateQuotePreview(container, company, senderProfile);

  const saveButton = container.querySelector("[data-save-company]");
  if (saveButton) {
    saveButton.addEventListener("click", () => onToggleSavedCompany(saveButton.getAttribute("data-save-company")));
  }

  const statusSelect = container.querySelector("[data-prospect-status]");
  if (statusSelect) {
    statusSelect.addEventListener("change", () =>
      onUpdateProspectStatus(statusSelect.getAttribute("data-company-id"), statusSelect.value)
    );
  }

  const noteButton = container.querySelector("[data-add-communication-note]");
  if (noteButton) {
    noteButton.addEventListener("click", () => {
      const textarea = container.querySelector("[data-communication-note-input]");
      onAddCommunicationEntry(readCommunicationPayload(container, noteButton.getAttribute("data-add-communication-note")));
    });
  }

  const prospectNoteButton = container.querySelector("[data-add-prospect-note]");
  if (prospectNoteButton) {
    prospectNoteButton.addEventListener("click", () => {
      const textarea = container.querySelector("[data-prospect-note-input]");
      onAddProspectNote(prospectNoteButton.getAttribute("data-add-prospect-note"), textarea?.value || "");
    });
  }

  const followUpButton = container.querySelector("[data-set-follow-up]");
  if (followUpButton) {
    followUpButton.addEventListener("click", () => {
      onSetNextFollowUp(followUpButton.getAttribute("data-set-follow-up"), {
        nextFollowUp: container.querySelector("[data-follow-up-input]")?.value || "",
        nextAction: container.querySelector("[data-follow-up-action]")?.value || "",
        followUpPriority: container.querySelector("[data-follow-up-priority]")?.value || "Normal",
        lastContacted: container.querySelector("[data-last-contacted-input]")?.value || "",
        quoteStatus: container.querySelector("[data-quote-status-input]")?.value || "",
      });
    });
  }

  container.querySelectorAll("[data-process-milestone]").forEach((checkbox) => {
    checkbox.addEventListener("change", () =>
      onToggleMilestone(
        checkbox.getAttribute("data-company-id"),
        checkbox.getAttribute("data-process-milestone"),
        checkbox.checked
      )
    );
  });

  bindContactActions(container, {
    onApproveContact,
    onMarkBadContact,
    onCopyContactEmail,
    onCopyContactPhone,
  });

  const addToListButton = container.querySelector("[data-add-to-list]");
  if (addToListButton) {
    addToListButton.addEventListener("click", () => {
      const select = container.querySelector("[data-list-select]");
      onAddProspectToList?.(addToListButton.getAttribute("data-add-to-list"), select?.value || "");
    });
  }

  container.querySelectorAll("[data-remove-detail-list]").forEach((button) => {
    button.addEventListener("click", () =>
      onRemoveProspectFromList?.(
        button.getAttribute("data-remove-detail-list") || "",
        button.getAttribute("data-list-id") || ""
      )
    );
  });
}

function renderCompanyTable(companies, scanner, selectedCompanyId, savedCompanies, mode, searchMode) {
  return `
    <div class="prospect-list-shell">
      <div class="prospect-list-head">
        <span>${mode === "saved" ? "Saved prospect" : "Business"}</span>
        <span>${mode === "saved" ? "Stage" : "Fit"}</span>
        <span>${mode === "saved" ? "Work queue" : "Signals"}</span>
        <span>Actions</span>
      </div>
      <div class="prospect-list">
        ${companies
          .map((company) => renderCompanyRow(company, scanner.getState(company.id), selectedCompanyId, savedCompanies, mode, searchMode))
          .join("")}
      </div>
    </div>
  `;
}

function renderCompanyRow(company, scanState, selectedCompanyId, savedCompanies, mode, searchMode = DEFAULT_SEARCH_MODE) {
  const bestContact = company.primary_contact || null;
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";
  const confidence = Number(bestContact?.confidence_score || company.confidence_score || 0);
  const leadScore = Number(company.lead_score || 0);
  const isSaved = isSavedProspect(company, savedCompanies);
  const reasonChips = renderReasonChips(company.reasonChips);
  const isSavedMode = mode === "saved";
  const isHidden = Boolean(company.is_hidden || company.archived);
  const contextLabel = getModeSpecificResultLabel(company.searchMode || searchMode);

  return `
    <article class="prospect-row ${company.id === selectedCompanyId ? "selected" : ""} ${isSaved ? "saved" : ""}">
      <button class="prospect-main" type="button" data-open-details="${escapeAttribute(company.id)}">
        <span class="row-title">${escapeHtml(company.name || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.industry || company.keyword || "NA")} · ${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.phone || "No phone")} · ${escapeHtml(formatRating(company))}</span>
      </button>
      <div class="prospect-fit">
        ${
          isSavedMode
            ? `<span class="stage-chip">${escapeHtml(getProspectStage(company))}</span><span class="row-subtitle">${escapeHtml(company.quote_status || "Not Started")}</span>`
            : `<span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.opportunityPriority || company.lead_label))}">${escapeHtml(contextLabel)}</span><span class="row-subtitle">${escapeHtml(String(leadScore))}/100</span>`
        }
        ${isHidden && !isSavedMode ? `<span class="stage-chip">Hidden</span>` : ""}
        ${company.archived && isSavedMode ? `<span class="stage-chip">Archived</span>` : ""}
      </div>
      <div class="prospect-signals">
        ${
          isSavedMode
            ? `
              <span>Last contacted: ${escapeHtml(company.last_contacted_at || "NA")}</span>
              <span>Next follow-up: ${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
              <span>Follow-up status: ${escapeHtml(getFollowUpStatus(company.next_follow_up))}</span>
              <span>Next action: ${escapeHtml(company.next_action || "NA")}</span>
              <span>Website: ${escapeHtml(company.websiteStatus || "Unknown")}</span>
              <span>Quality: ${escapeHtml(company.websiteQualityStatus || "Not Checked")}${
                Number(company.websiteQualityScore || 0) > 0 ? ` (${escapeHtml(String(company.websiteQualityScore || 0))}/100)` : ""
              }</span>
              ${company.bookingPlatform && company.bookingPlatform !== "Unknown" ? `<span>Booking: ${escapeHtml(company.bookingPlatform)}</span>` : ""}
              ${company.socialPlatform && company.socialPlatform !== "Unknown" ? `<span>Social: ${escapeHtml(company.socialPlatform)}</span>` : ""}
            `
            : `
              <span>${escapeHtml(company.websiteStatus || "Unknown")}</span>
              <span>${escapeHtml(company.websiteQualityStatus || "Not Checked")}${
                Number(company.websiteQualityScore || 0) > 0 ? ` (${escapeHtml(String(company.websiteQualityScore || 0))}/100)` : ""
              }</span>
              <span>${escapeHtml(company.mobileAppStatus || "Unknown")}</span>
              ${company.bookingPlatform && company.bookingPlatform !== "Unknown" ? `<span>${escapeHtml(company.bookingPlatform)}</span>` : ""}
              ${company.socialPlatform && company.socialPlatform !== "Unknown" ? `<span>${escapeHtml(company.socialPlatform)}</span>` : ""}
              ${reasonChips}
            `
        }
      </div>
      <div class="table-actions">
        ${
          isSavedMode
            ? `
              <button class="secondary-btn" type="button" data-open-details="${escapeAttribute(company.id)}">Open</button>
              ${company.phone ? `<a class="secondary-btn call-link" href="tel:${escapeAttribute(company.phone)}">Call</a>` : ""}
              <button class="secondary-btn" type="button" data-hide-company="${escapeAttribute(company.id)}">${company.archived ? "Unarchive" : "Archive"}</button>
            `
            : `
              <button class="${isSaved ? "primary-btn" : "secondary-btn"}" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved" : "Save"}</button>
              <button class="secondary-btn" type="button" data-hide-company="${escapeAttribute(company.id)}">${isHidden ? "Restore" : "Hide"}</button>
              <button class="secondary-btn" type="button" data-open-details="${escapeAttribute(company.id)}">View Details</button>
            `
        }
      </div>
    </article>
  `;
}

function renderReasonChips(reasonChips) {
  if (!Array.isArray(reasonChips) || !reasonChips.length) {
    return "";
  }

  return `
    <div class="reason-chip-row">
      ${reasonChips
        .slice(0, 4)
        .map((reason) => `<span class="reason-chip">${escapeHtml(reason)}</span>`)
        .join("")}
    </div>
  `;
}

function renderListSelector(company, savedLists = []) {
  if (!Array.isArray(savedLists) || !savedLists.length) {
    return `<span class="toolbar-subtle">Create lists from Saved Lists.</span>`;
  }

  const memberships = savedLists.filter((list) => (list.prospectIds || []).includes(company.id));
  return `
    <label class="inline-field inline-select">
      <select data-list-select aria-label="Saved list">
        ${savedLists.map((list) => `<option value="${escapeAttribute(list.listId)}">${escapeHtml(list.listName)}</option>`).join("")}
      </select>
    </label>
    <button class="secondary-btn" type="button" data-add-to-list="${escapeAttribute(company.id)}">Add to List</button>
    ${
      memberships.length
        ? memberships
            .map(
              (list) =>
                `<button class="secondary-btn" type="button" data-remove-detail-list="${escapeAttribute(company.id)}" data-list-id="${escapeAttribute(list.listId)}">Remove ${escapeHtml(list.listName)}</button>`
            )
            .join("")
        : ""
    }
  `;
}

function renderCompanyGridCard(company, scanState, selectedCompanyId, savedCompanies) {
  const bestContact = company.primary_contact || null;
  const confidence = Number(company.lead_score || bestContact?.confidence_score || company.confidence_score || 0);
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";
  const isSaved = isSavedProspect(company, savedCompanies);
  const isHidden = Boolean(company.is_hidden || company.archived);

  return `
    <article class="company-grid-card ${company.id === selectedCompanyId ? "selected" : ""} ${isSaved ? "saved" : ""}">
      <div class="company-grid-top">
        <div>
          <h3>${escapeHtml(company.name || "NA")}</h3>
          <p>${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</p>
        </div>
        <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.opportunityPriority || company.lead_label))}">${escapeHtml(company.opportunityPriority || company.lead_label || formatConfidenceBadge(confidence))}</span>
      </div>
      <div class="company-grid-meta">
        <span>${escapeHtml(company.industry || "NA")}</span>
        <span>Website Status: ${escapeHtml(company.websiteStatus || "Unknown")}</span>
        <span>Website Quality: ${escapeHtml(company.websiteQualityStatus || "Not Checked")}${
          Number(company.websiteQualityScore || 0) > 0 ? ` (${escapeHtml(String(company.websiteQualityScore || 0))}/100)` : ""
        }</span>
        <span>Mobile App Status: ${escapeHtml(company.mobileAppStatus || "Unknown")}</span>
        ${isHidden ? `<span>Hidden</span>` : ""}
        ${company.bookingPlatform && company.bookingPlatform !== "Unknown" ? `<span>Booking Platform: ${escapeHtml(company.bookingPlatform)}</span>` : ""}
        ${company.socialPlatform && company.socialPlatform !== "Unknown" ? `<span>Social Platform: ${escapeHtml(company.socialPlatform)}</span>` : ""}
        <span>Status: ${escapeHtml(getProspectStage(company))}</span>
        <span>Next Follow-up: ${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
        <span>${escapeHtml(String(company.contacts_found || 0))} contacts</span>
        <span>${escapeHtml(bestContact?.name || "No best contact")}</span>
        <span>${escapeHtml(String(company.lead_score || 0))}/100 opportunity score</span>
        <span>${company.outreach_ready ? "Outreach ready" : "Not outreach ready"}</span>
      </div>
      <div class="table-actions">
        <button class="${isSaved ? "primary-btn" : "secondary-btn"}" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved Prospect" : "Save Prospect"}</button>
        <button class="secondary-btn" type="button" data-open-details="${escapeAttribute(company.id)}">Open Details</button>
        <button class="secondary-btn" type="button" data-hide-company="${escapeAttribute(company.id)}">${isHidden ? "Restore" : "Hide"}</button>
        <button class="secondary-btn" type="button" data-scan-company="${escapeAttribute(company.id)}">
          ${scanState.status === SCAN_STATUS.SCANNING ? "Scanning..." : "Deep Scan"}
        </button>
        ${
          failureReason
            ? `<button class="secondary-btn" type="button" data-retry-scan="${escapeAttribute(company.id)}">Retry</button>`
            : ""
        }
      </div>
      <span class="status-pill ${statusMeta.cssClass}"><span class="status-dot"></span>${escapeHtml(statusMeta.label)}</span>
      ${failureReason ? `<span class="row-subtitle failure-note">${escapeHtml(formatFailureReason(failureReason))}</span>` : ""}
    </article>
  `;
}

function renderTabContent({
  company,
  primaryContact,
  otherContacts,
  activeTab,
  isSaved = false,
  senderProfile = {},
  outreachDrafts = {},
  onSaveSenderProfile,
  onSetOutreachTone,
  onEditOutreachTemplate,
  onUpdateOutreachTemplateDraft,
  onSaveOutreachTemplate,
  onResetOutreachTemplate,
  onSaveQuoteDetails,
  onCopyQuoteSummary,
  onMarkQuoteSent,
  onMarkQuoteAccepted,
  onMarkQuoteRejected,
}) {
  if (activeTab === "contact") {
    return `
      <section class="workflow-card">
        <div class="workflow-header-row">
          <div>
            <p class="detail-section-title">Contact Enrichment</p>
            <p class="toolbar-subtle">Status: ${escapeHtml(company.enrichmentStatus || "Not Checked")}${company.enrichmentCheckedAt ? ` - ${escapeHtml(formatDate(company.enrichmentCheckedAt))}` : ""}</p>
          </div>
          <div class="workflow-actions">
            <button class="secondary-btn" type="button" data-enrich-contact="${escapeAttribute(company.id)}">Enrich Contact Info</button>
          </div>
        </div>
        <div class="quote-form-grid">
          <label class="inline-field"><span>Email</span><input type="email" value="${escapeAttribute(company.primaryEmail || company.primary_contact?.email || "")}" data-contact-field="primaryEmail" /></label>
          <label class="inline-field"><span>Contact Person</span><input type="text" value="${escapeAttribute(company.contactPersonName || company.primary_contact?.name || "")}" data-contact-field="contactPersonName" /></label>
          <label class="inline-field"><span>Title</span><input type="text" value="${escapeAttribute(company.contactPersonTitle || company.primary_contact?.title || "")}" data-contact-field="contactPersonTitle" /></label>
          <label class="inline-field"><span>Facebook</span><input type="url" value="${escapeAttribute(company.facebookUrl || company.facebook_url || "")}" data-contact-field="facebookUrl" /></label>
          <label class="inline-field"><span>Instagram</span><input type="url" value="${escapeAttribute(company.instagramUrl || company.instagram_url || "")}" data-contact-field="instagramUrl" /></label>
          <label class="inline-field"><span>LinkedIn</span><input type="url" value="${escapeAttribute(company.linkedinUrl || company.linkedin_url || company.primary_contact?.linkedin_url || "")}" data-contact-field="linkedinUrl" /></label>
          <label class="inline-field"><span>Booking Link</span><input type="url" value="${escapeAttribute(company.bookingUrl || company.booking_url || "")}" data-contact-field="bookingUrl" /></label>
          <label class="inline-field"><span>Contact Page</span><input type="url" value="${escapeAttribute(company.websiteContactPageUrl || "")}" data-contact-field="websiteContactPageUrl" /></label>
        </div>
        <label class="inline-field"><span>Enrichment Notes</span><textarea class="workflow-textarea" rows="2" data-contact-field="enrichmentNotes">${escapeHtml(company.enrichmentNotes || "")}</textarea></label>
        <div class="workflow-actions">
          <button class="secondary-btn" type="button" data-save-contact-fields="${escapeAttribute(company.id)}">Save Contact Fields</button>
        </div>
      </section>
      ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("No verified public contact person found yet.")}
      <div class="overview-grid">
        ${renderLinkCard("Website", company.website)}
        ${renderLinkCard("Google Profile", company.source_url)}
        ${renderLinkCard("Email", company.primaryEmail ? `mailto:${company.primaryEmail}` : "")}
        ${renderLinkCard("Contact Page", company.websiteContactPageUrl || "")}
        ${renderLinkCard("Booking", company.bookingUrl || company.booking_url || "")}
        ${renderLinkCard("Instagram", company.instagramUrl || company.instagram_url || "")}
        ${renderLinkCard("Facebook", company.facebookUrl || company.facebook_url || "")}
        ${renderLinkCard("LinkedIn", company.linkedinUrl || company.linkedin_url || "")}
      </div>
      ${renderSourceLinks(company)}
      <div class="detail-section">
        <p class="detail-section-title">Contact Records</p>
        ${
          company.contacts?.length
            ? `<div class="contact-list-wrap">${primaryContact ? renderContactListItem(primaryContact, true) : ""}${otherContacts.map((contact) => renderContactListItem(contact)).join("")}</div>`
            : renderNaPanel("No public contacts found yet.")
        }
      </div>
    `;
  }

  if (activeTab === "outreach") {
    const outreachContext = getOutreachContext(company);
    const customTemplates = company.outreach_templates || {};
    const draftState = outreachDrafts?.[company.id] || {};
    const tone = draftState.tone || company.outreach_tone || "Professional";
    const templateKeyMap = {
      intro_email: {
        label: "Intro Email",
        purpose: "Short, respectful first touch.",
        markLabel: "Mark intro email sent",
        milestone: "Initial intro email sent",
        actionMessage: "Marked intro email sent",
      },
      sms_message: {
        label: "SMS / WhatsApp",
        purpose: "Very short message for text or WhatsApp.",
        markLabel: "Mark message sent",
        milestone: "WhatsApp/message sent",
        actionMessage: "Marked message sent",
      },
      call_script: {
        label: "Phone Call Script",
        purpose: "Quick call opener with a simple ask.",
        markLabel: "Mark call attempted",
        milestone: "Call attempted",
        actionMessage: "Marked call attempted",
      },
      onsite_visit: {
        label: "Onsite Visit Script",
        purpose: "In-person opener for the owner or manager.",
        markLabel: "Mark onsite visit done",
        milestone: "Onsite visit done",
        actionMessage: "Marked onsite visit done",
      },
      follow_up: {
        label: "Follow-Up Message",
        purpose: "A brief check-in after first contact.",
        markLabel: "Mark follow-up sent",
        milestone: "Follow-up sent",
        actionMessage: "Marked follow-up sent",
      },
      quote_follow_up: {
        label: "Quote Follow-Up",
        purpose: "Follow up after sending a quote.",
        markLabel: "Mark quote follow-up sent",
        milestone: "Follow-up sent",
        actionMessage: "Marked quote follow-up sent",
      },
    };

    const templateBodies = {
      intro_email: buildOutreachTemplateBody("intro_email", company, outreachContext, senderProfile, tone),
      sms_message: buildOutreachTemplateBody("sms_message", company, outreachContext, senderProfile, tone),
      call_script: buildOutreachTemplateBody("call_script", company, outreachContext, senderProfile, tone),
      onsite_visit: buildOutreachTemplateBody("onsite_visit", company, outreachContext, senderProfile, tone),
      follow_up: buildOutreachTemplateBody("follow_up", company, outreachContext, senderProfile, tone),
      quote_follow_up: buildOutreachTemplateBody("quote_follow_up", company, outreachContext, senderProfile, tone),
    };
    return `
      ${renderSenderProfileCard(senderProfile, tone, company.id)}
      <section class="workflow-card">
        <p class="detail-section-title">Outreach Context</p>
        <div class="reason-chip-row">
          ${outreachContext.chips.map((chip) => `<span class="reason-chip">${escapeHtml(chip)}</span>`).join("")}
        </div>
        <p class="toolbar-subtle">${escapeHtml(outreachContext.summary)}</p>
      </section>
      ${Object.keys(templateKeyMap)
        .map((templateKey) => {
          const meta = templateKeyMap[templateKey];
          const customText = customTemplates[templateKey];
          const draft = draftState[templateKey] || {};
          const isEditing = Boolean(draft.editing);
          const text = isEditing
            ? draft.text || customText || templateBodies[templateKey]
            : customText || draft.text || templateBodies[templateKey];
          return renderOutreachTemplateCard({
            company,
            templateKey,
            label: meta.label,
            purpose: meta.purpose,
            text,
            isEditing,
            hasCustom: Boolean(customText),
            saveLabel: "Save",
            markLabel: meta.markLabel,
            milestone: meta.milestone,
            actionMessage: meta.actionMessage,
          });
        })
        .join("")}
    `;
  }

  if (activeTab === "activity") {
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Add Activity</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Activity Type</span><select data-activity-type>${ACTIVITY_TYPES.map((type) => `<option value="${escapeAttribute(type)}">${escapeHtml(type)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Date</span><input type="date" value="${escapeAttribute(getTodayDateInput())}" data-communication-date /></label>
          <label class="inline-field"><span>Method</span><select data-communication-method>${COMMUNICATION_METHODS.map((method) => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Outcome/Status</span><input type="text" data-communication-outcome placeholder="Reached owner, left voicemail, replied" /></label>
          <label class="inline-field"><span>Next Action</span><input type="text" data-communication-next-action placeholder="Call again, send quote, schedule visit" /></label>
          <label class="inline-field"><span>Next Follow-Up Date</span><input type="date" value="${escapeAttribute(company.next_follow_up || "")}" data-communication-follow-up /></label>
        </div>
        <textarea class="workflow-textarea" data-communication-note-input rows="4" placeholder="Notes from the activity"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-communication-note="${escapeAttribute(company.id)}">Add Activity</button></div>
      </section>
      ${renderWorkflowActivityLog(company)}
    `;
  }

  if (activeTab === "process") {
    const followUpStatus = getFollowUpStatus(company.next_follow_up);
    return `
      <div class="overview-grid">
        ${renderStageSelectCard(company)}
        ${renderProcessCard("Last contacted", company.last_contacted_at || "NA")}
        ${renderProcessCard("Next follow-up", company.next_follow_up || "Not scheduled")}
        ${renderProcessCard("Follow-up status", followUpStatus)}
        ${renderProcessCard("Priority", company.follow_up_priority || "Normal")}
        ${renderProcessCard("Quote status", company.quote_status || "Not Started")}
        ${renderProcessCard("Next action", company.next_action || getSuggestedNextAction(company))}
      </div>
      ${renderStageUpdateNote(company)}
      <section class="workflow-card">
        <p class="detail-section-title">Follow-up Plan</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Date</span><input type="date" value="${escapeAttribute(company.next_follow_up || "")}" data-follow-up-input /></label>
          <label class="inline-field"><span>Next Action</span><input type="text" value="${escapeAttribute(company.next_action || "")}" data-follow-up-action placeholder="Call owner, send quote, confirm scope" /></label>
          <label class="inline-field"><span>Priority</span><select data-follow-up-priority>${FOLLOW_UP_PRIORITIES.map((priority) => `<option value="${escapeAttribute(priority)}" ${priority === (company.follow_up_priority || "Normal") ? "selected" : ""}>${escapeHtml(priority)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Last Contacted</span><input type="date" value="${escapeAttribute(company.last_contacted_at || "")}" data-last-contacted-input /></label>
          <label class="inline-field"><span>Quote Status</span><select data-quote-status-input>${QUOTE_STATUSES.map((status) => `<option value="${escapeAttribute(status)}" ${status === (company.quote_status || "Not Started") ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label>
        </div>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-set-follow-up="${escapeAttribute(company.id)}">Save Workflow</button></div>
      </section>
      ${renderMilestoneChecklist(company)}
      ${renderConversionPlaceholder(company)}
    `;
  }

  if (activeTab === "notes") {
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Add Note</p>
        <textarea class="workflow-textarea" data-prospect-note-input rows="4" placeholder="Internal note, qualification detail, pricing context, or client preference"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-prospect-note="${escapeAttribute(company.id)}">Add Note</button></div>
      </section>
      ${renderProspectNotes(company)}
    `;
  }

  if (activeTab === "quote") {
    const quote = getQuoteDraftModel(company);
    const quoteSummary = buildQuoteSummaryPreview(company, quote, senderProfile);
    const packageHint = getQuotePackageHint(company);
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Quote preparation</p>
        <div class="overview-grid">
          ${renderProcessCard("Quote status", quote.quoteStatus || "Not Started")}
          ${renderProcessCard("Suggested package", packageHint)}
          ${renderProcessCard("Final quote amount", quote.finalQuoteAmount ? formatCurrencyDisplay(quote.finalQuoteAmount) : "TBD")}
          ${renderProcessCard("Quote follow-up", quote.quoteFollowUpDate || "Not scheduled")}
        </div>
        <div class="workflow-form-grid">
          <label class="inline-field">
            <span>Quote Status</span>
            <select data-quote-field data-quote-status>
              ${QUOTE_STATUSES.map(
                (status) => `<option value="${escapeAttribute(status)}" ${status === quote.quoteStatus ? "selected" : ""}>${escapeHtml(status)}</option>`
              ).join("")}
            </select>
          </label>
          <label class="inline-field">
            <span>Project Type</span>
            <select data-quote-field data-quote-project-type>
              ${QUOTE_PROJECT_TYPES.map(
                (projectType) =>
                  `<option value="${escapeAttribute(projectType)}" ${projectType === quote.projectType ? "selected" : ""}>${escapeHtml(projectType)}</option>`
              ).join("")}
            </select>
          </label>
          <label class="inline-field">
            <span>Package Type</span>
            <select data-quote-field data-quote-package-type>
              ${QUOTE_PACKAGE_TYPES.map(
                (packageType) =>
                  `<option value="${escapeAttribute(packageType)}" ${packageType === quote.packageType ? "selected" : ""}>${escapeHtml(packageType)}</option>`
              ).join("")}
            </select>
          </label>
          <label class="inline-field">
            <span>Estimated Price</span>
            <input type="number" min="0" step="50" value="${escapeAttribute(quote.estimatedPrice || "")}" data-quote-field data-quote-estimated-price />
          </label>
          <label class="inline-field">
            <span>Discount</span>
            <input type="number" min="0" step="25" value="${escapeAttribute(quote.discount || "")}" data-quote-field data-quote-discount />
          </label>
          <label class="inline-field">
            <span>Final Quote Amount</span>
            <input type="text" value="${escapeAttribute(quote.finalQuoteAmountDisplay || "TBD")}" data-quote-final-amount readonly />
          </label>
        </div>
        <div class="workflow-form-grid">
          <label class="inline-field">
            <span>Payment Terms</span>
            <input type="text" value="${escapeAttribute(quote.paymentTerms || "")}" data-quote-field data-quote-payment-terms placeholder="50% upfront, 50% on launch" />
          </label>
          <label class="inline-field">
            <span>Timeline Estimate</span>
            <input type="text" value="${escapeAttribute(quote.timelineEstimate || "")}" data-quote-field data-quote-timeline-estimate placeholder="2-3 weeks" />
          </label>
          <label class="inline-field">
            <span>Quote Sent Date</span>
            <input type="date" value="${escapeAttribute(quote.quoteSentDate || "")}" data-quote-field data-quote-sent-date />
          </label>
          <label class="inline-field">
            <span>Quote Follow-Up Date</span>
            <input type="date" value="${escapeAttribute(quote.quoteFollowUpDate || "")}" data-quote-field data-quote-follow-up-date />
          </label>
        </div>
        <div class="workflow-form-grid">
          <label class="inline-field">
            <span>Scope Notes</span>
            <textarea class="workflow-textarea" rows="4" data-quote-field data-quote-scope-notes placeholder="Pages, features, booking, SEO, integrations">${escapeHtml(quote.scopeNotes || "")}</textarea>
          </label>
          <label class="inline-field">
            <span>Internal Notes</span>
            <textarea class="workflow-textarea" rows="4" data-quote-field data-quote-internal-notes placeholder="Internal pricing context, assumptions, risks">${escapeHtml(quote.internalNotes || "")}</textarea>
          </label>
        </div>
        <div class="workflow-actions">
          <button class="primary-btn" type="button" data-save-quote-details data-company-id="${escapeAttribute(company.id)}">Save Quote</button>
          <button class="secondary-btn" type="button" data-copy-quote-summary data-company-id="${escapeAttribute(company.id)}">Copy Quote Summary</button>
          <button class="secondary-btn" type="button" data-mark-quote-sent data-company-id="${escapeAttribute(company.id)}">Mark Quote Sent</button>
          <button class="secondary-btn" type="button" data-mark-quote-accepted data-company-id="${escapeAttribute(company.id)}">Mark Accepted</button>
          <button class="secondary-btn" type="button" data-mark-quote-rejected data-company-id="${escapeAttribute(company.id)}">Mark Rejected</button>
        </div>
        <textarea class="workflow-textarea quote-summary" rows="8" readonly data-quote-summary-preview>${escapeHtml(quoteSummary)}</textarea>
        ${!isSaved ? `<p class="toolbar-subtle">Save prospect to keep quote details.</p>` : ""}
      </section>
    `;
  }

  const sourceUrls = dedupe([company.source_url, ...(company.contacts || []).map((contact) => contact.source_url)].filter(Boolean));

  return `
    <div class="overview-grid">
      <div class="overview-card">
        <span class="overview-label">Opportunity score</span>
        <strong>${escapeHtml(company.opportunityPriority || company.lead_label || "Needs Review")} (${escapeHtml(String(company.opportunityScore || company.lead_score || 0))}/100)</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Manual priority</span>
        <strong>Auto</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Prospect stage</span>
        <label class="inline-field">
          <select aria-label="Prospect stage" data-prospect-status="1" data-company-id="${escapeAttribute(company.id)}">
            ${PROSPECT_STAGES.map(
              (stage) => `<option value="${escapeAttribute(stage)}" ${stage === getProspectStage(company) ? "selected" : ""}>${escapeHtml(stage)}</option>`
            ).join("")}
          </select>
        </label>
      </div>
      <div class="overview-card">
        <span class="overview-label">Next follow-up</span>
        <strong>${escapeHtml(getFollowUpStatus(company.next_follow_up))}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Address</span>
        <strong>${escapeHtml(company.address || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Website</span>
        ${
          company.website
            ? `<a class="link" href="${escapeAttribute(company.website)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(company.website))}</a>`
            : "<strong>No Website</strong>"
        }
      </div>
      <div class="overview-card">
        <span class="overview-label">Website Status</span>
        <strong>${escapeHtml(company.websiteStatus || "Unknown")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Website Quality</span>
        <strong>
          ${escapeHtml(company.websiteQualityStatus || "Not Checked")}
          ${
            Number(company.websiteQualityScore || 0) > 0
              ? ` (${escapeHtml(String(company.websiteQualityScore || 0))}/100)`
              : ""
          }
        </strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Mobile App Status</span>
        <strong>${escapeHtml(company.mobileAppStatus || "Unknown")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Booking Platform</span>
        <strong>${escapeHtml(company.bookingPlatform && company.bookingPlatform !== "Unknown" ? company.bookingPlatform : "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Social Platform</span>
        <strong>${escapeHtml(company.socialPlatform && company.socialPlatform !== "Unknown" ? company.socialPlatform : "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Website Checked</span>
        <strong>${escapeHtml(company.websiteCheckedAt ? formatDate(company.websiteCheckedAt) : "Not checked")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Phone</span>
        <strong>${escapeHtml(company.phone || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Business type</span>
        <strong>${escapeHtml(company.industry || company.keyword || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Review status</span>
        <strong>${escapeHtml(formatReviewStatus(company.review_status))}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Listing source</span>
        <strong>${escapeHtml(formatSource(company.source))}</strong>
      </div>
    </div>
    ${renderReasonChips(company.scoreReasons || company.reasonChips)}

    <div class="source-list">
      ${sourceUrls
        .map(
          (url) => `
            <div class="source-item">
              <span class="source-label">Referenced page</span>
              <a class="link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(url))}</a>
            </div>
          `
        )
        .join("")}
    </div>
    ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("NA - no verified public contact person found after deep website scan.")}
  `;
}

function renderBestContactCard(contact) {
  return `
    <section class="best-contact-card">
      <div class="best-contact-header">
        <div>
          <p class="detail-section-title">Contact Details</p>
          <h3>${escapeHtml(contact.name || "NA")}</h3>
          <p>${escapeHtml(contact.title || "NA")}</p>
        </div>
        <div class="best-contact-badges">
          ${contact.decision_maker ? `<span class="contact-type-pill person_contact">Decision maker</span>` : ""}
          ${renderEmailStatusBadge(contact)}
          <span class="quality-pill ${escapeAttribute(getConfidenceBadgeClass(contact.confidence_score || 0))}">
            ${escapeHtml(formatConfidenceBadge(contact.confidence_score || 0))}
          </span>
        </div>
      </div>

      <div class="best-contact-grid">
        ${renderDetailRow("Email", contact.email || "NA")}
        ${renderDetailRow("Phone", contact.phone || "NA")}
        ${renderDetailRow(
          "LinkedIn",
          contact.linkedin_url
            ? `<a class="link prominent-link" href="${escapeAttribute(contact.linkedin_url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(contact.linkedin_url))}</a>`
            : "NA"
        )}
        ${renderDetailRow("Email status", escapeHtml(formatEmailStatus(contact)))}
        ${renderDetailRow("Confidence", escapeHtml(String(contact.confidence_score || "NA")))}
        ${renderDetailRow(
          "Source",
          contact.source_url
            ? `<a class="link" href="${escapeAttribute(contact.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(contact.source_url))}</a>`
            : "NA"
        )}
      </div>

      <div class="contact-actions">
        ${renderContactActionButtons(contact)}
      </div>
    </section>
  `;
}

function renderContactListItem(contact, isPrimary = false) {
  return `
    <article class="contact-list-item ${isPrimary ? "primary" : ""}">
      <div class="contact-list-top">
        <div>
          <h4>${escapeHtml(contact.name || "NA")}</h4>
          <p>${escapeHtml(contact.title || "NA")}</p>
        </div>
        <div class="best-contact-badges">
          ${contact.decision_maker ? `<span class="contact-type-pill person_contact">Decision maker</span>` : ""}
          ${renderEmailStatusBadge(contact)}
        </div>
      </div>
      <div class="contact-list-meta">
        <span>${escapeHtml(contact.email || "NA")}</span>
        <span>Email status: ${escapeHtml(formatEmailStatus(contact))}</span>
        <span>${escapeHtml(contact.phone || "NA")}</span>
        <span>${
          contact.linkedin_url
            ? `<a class="link" href="${escapeAttribute(contact.linkedin_url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(contact.linkedin_url))}</a>`
            : "NA"
        }</span>
        <span>${
          contact.source_url
            ? `<a class="link" href="${escapeAttribute(contact.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(contact.source_url))}</a>`
            : "NA"
        }</span>
        <span>Confidence: ${escapeHtml(String(contact.confidence_score || "NA"))}</span>
      </div>
      <div class="contact-actions">
        ${renderContactActionButtons(contact)}
      </div>
    </article>
  `;
}

function renderCommunicationLog(company) {
  const entries = Array.isArray(company.communication_logs) ? company.communication_logs : [];

  if (!entries.length) {
    return renderNaPanel("No communication entries saved yet.");
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Communication History</p>
      <div class="activity-list">
        ${entries
          .map(
            (entry) => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <div>
                  <p>${escapeHtml(entry.date || formatDate(entry.created_at))} - ${escapeHtml(entry.method || "Other")} - ${escapeHtml(entry.outcome || "No outcome")}</p>
                  <strong>${escapeHtml(entry.notes || "NA")}</strong>
                  <p>Next: ${escapeHtml(entry.next_action || "NA")}${entry.next_follow_up ? ` on ${escapeHtml(entry.next_follow_up)}` : ""}</p>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderOutreachTemplateCard({
  company,
  templateKey,
  label,
  purpose,
  text,
  isEditing,
  hasCustom,
  saveLabel,
  markLabel,
  milestone,
  actionMessage,
}) {
  return `
    <section class="workflow-card" data-outreach-card="${escapeAttribute(templateKey)}">
      <div class="workflow-header-row">
        <div>
          <p class="detail-section-title">${escapeHtml(label)}</p>
          ${purpose ? `<p class="toolbar-subtle">${escapeHtml(purpose)}</p>` : ""}
        </div>
        <div class="workflow-actions">
          <button
            class="secondary-btn"
            type="button"
            data-outreach-copy="${escapeAttribute(templateKey)}"
            data-outreach-label="${escapeAttribute(label)}"
            data-company-id="${escapeAttribute(company.id)}"
          >
            Copy
          </button>
          <button
            class="secondary-btn"
            type="button"
            data-outreach-edit="${escapeAttribute(templateKey)}"
            data-company-id="${escapeAttribute(company.id)}"
          >
            ${escapeHtml(isEditing ? saveLabel || "Save" : "Edit")}
          </button>
          <button
            class="secondary-btn"
            type="button"
            data-outreach-reset="${escapeAttribute(templateKey)}"
            data-company-id="${escapeAttribute(company.id)}"
          >
            Reset
          </button>
          ${
            milestone
              ? `
                <button
                  class="secondary-btn"
                  type="button"
                  data-outreach-mark="${escapeAttribute(milestone)}"
                  data-outreach-message="${escapeAttribute(actionMessage)}"
                  data-company-id="${escapeAttribute(company.id)}"
                >
                  ${escapeHtml(markLabel)}
                </button>
              `
              : ""
          }
        </div>
      </div>
      <textarea class="workflow-textarea outreach-template" ${isEditing ? "" : "readonly"} data-outreach-body rows="8">${escapeHtml(text)}</textarea>
      ${
        hasCustom
          ? `<p class="toolbar-subtle">Saved edit active for this prospect.</p>`
          : `<p class="toolbar-subtle">Save prospect to keep edits.</p>`
      }
    </section>
  `;
}

function renderSenderProfileCard(senderProfile, tone, companyId) {
  return `
    <section class="workflow-card">
      <p class="detail-section-title">Sender Info</p>
      <p class="toolbar-subtle">Personal details used in outreach templates.</p>
      <div class="workflow-form-grid">
        <label class="inline-field"><span>Your Name</span><input type="text" value="${escapeAttribute(senderProfile?.yourName || "")}" data-sender-your-name /></label>
        <label class="inline-field"><span>Company Name</span><input type="text" value="${escapeAttribute(senderProfile?.companyName || "")}" data-sender-company-name /></label>
        <label class="inline-field"><span>Phone</span><input type="text" value="${escapeAttribute(senderProfile?.phone || "")}" data-sender-phone /></label>
        <label class="inline-field"><span>Email</span><input type="email" value="${escapeAttribute(senderProfile?.email || "")}" data-sender-email /></label>
        <label class="inline-field"><span>Website / Portfolio URL</span><input type="url" value="${escapeAttribute(senderProfile?.website || "")}" data-sender-website /></label>
        <label class="inline-field"><span>Tone</span>
          <select data-outreach-tone>
            ${["Friendly", "Professional", "Very Short", "Follow-Up"].map((option) => `<option value="${escapeAttribute(option)}" ${option === tone ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="inline-field"><span>Short Service Pitch</span><textarea class="workflow-textarea" rows="3" data-sender-pitch>${escapeHtml(senderProfile?.pitch || "I help local businesses create clean, mobile-friendly websites that make services, photos, and contact options easier for customers to find.")}</textarea></label>
      <div class="workflow-actions">
        <button class="primary-btn" type="button" data-save-sender-profile="${escapeAttribute(companyId)}">Save Sender Info</button>
      </div>
    </section>
  `;
}

function getOutreachContextLegacy(company) {
  const businessName = company.name || company.businessName || "this business";
  const businessType = company.industry || company.keyword || company.businessType || "local business";
  const location = [company.city || company.location || "", company.state || ""].filter(Boolean).join(", ") || "your area";
  const websiteStatus = String(company.websiteStatus || company.website_status || "Unknown").trim();
  const websiteQualityStatus = String(company.websiteQualityStatus || company.website_quality_status || "Not Checked").trim();
  const bookingPlatform = String(company.bookingPlatform || company.booking_platform || "Unknown").trim();
  const socialPlatform = String(company.socialPlatform || company.social_platform || "Unknown").trim();
  const priority = String(company.opportunityPriority || company.opportunity_priority || company.lead_label || "Needs Review").trim();
  const websiteQualityScore = company.websiteQualityScore ?? company.website_quality_score ?? null;

  const chips = [priority];
  if (websiteStatus !== "Unknown") chips.push(websiteStatus);
  if (websiteQualityStatus && websiteQualityStatus !== "Not Checked") chips.push(websiteQualityStatus);
  if (bookingPlatform && bookingPlatform !== "Unknown") chips.push(`Booking: ${bookingPlatform}`);
  if (socialPlatform && socialPlatform !== "Unknown") chips.push(`Social: ${socialPlatform}`);

  const presenceNote =
    websiteStatus === "No Website"
      ? "I did not find a dedicated website."
      : websiteStatus === "Social Only"
      ? "I only found social profiles, so a dedicated website could build more trust."
      : websiteStatus === "Booking Link Only"
      ? "I found a booking presence, but not a full owned website."
      : websiteStatus === "Broken Website"
      ? "The website looks broken or unusable right now."
      : websiteStatus === "Has Website"
      ? "You already have a website, but there may still be room to improve how it converts visitors."
      : "I wanted to reach out because your online presence looks worth a closer look.";

  const qualityNote =
    websiteQualityStatus === "Weak Website" || websiteQualityStatus === "Needs Review"
      ? "There is room to improve the site for mobile visitors, services, and booking conversion."
      : websiteQualityStatus === "Broken Website"
      ? "The current website appears to have issues, so a cleaner web presence could help."
      : websiteQualityStatus === "Strong Website"
      ? "The website looks solid, so the outreach can focus on refinements and conversion."
      : "";

  const platformNote =
    bookingPlatform && bookingPlatform !== "Unknown"
      ? `I noticed ${bookingPlatform} in the mix${socialPlatform && socialPlatform !== "Unknown" ? `, along with ${socialPlatform}` : ""}.`
      : socialPlatform && socialPlatform !== "Unknown"
      ? `I noticed ${socialPlatform} as the main online presence.`
      : "";

  const summary = [presenceNote, qualityNote, platformNote].filter(Boolean).join(" ");
  const hook = summary || `I’m reaching out to ${businessName} in ${location}.`;
  const valueLine =
    priority === "Best Prospect" || priority === "Strong Prospect"
      ? "You may be a good fit for a quick conversation about simple website improvements that can help bring in more inquiries."
      : "I think there may be an opportunity to improve how your business is presented online.";
  const askLine = location
    ? `If you're open to it, I'd be happy to share a couple quick ideas for ${String(businessType).toLowerCase()} businesses in ${location}.`
    : `If you're open to it, I'd be happy to share a couple quick ideas for ${String(businessType).toLowerCase()} businesses.`;
  const followUpLine =
    websiteQualityScore != null ? `I also took a quick look at the current site and noted a score of ${websiteQualityScore}/100.` : "";

  return {
    businessName,
    businessType,
    location,
    websiteStatus,
    websiteQualityStatus,
    websiteQualityScore,
    bookingPlatform,
    socialPlatform,
    priority,
    summary,
    chips,
    hook,
    valueLine,
    askLine,
    followUpLine,
  };
}

function generateIntroEmailLegacy(company, context = getOutreachContext(company)) {
  return [
    `Hi${context.businessName ? ` ${context.businessName}` : ""},`,
    "",
    `I work with local ${String(context.businessType).toLowerCase()} businesses and wanted to reach out because ${context.hook.toLowerCase()}`,
    context.valueLine,
    context.followUpLine,
    "",
    context.askLine,
    "",
    "Best,",
    "Cody",
  ]
    .filter(Boolean)
    .join("\n");
}

function generateSmsTemplateLegacy(company, context = getOutreachContext(company)) {
  const leadIn =
    context.websiteStatus === "No Website"
      ? "I did not find a dedicated website"
      : context.websiteStatus === "Social Only"
      ? "I found social pages, but not a dedicated website"
      : context.websiteStatus === "Booking Link Only"
      ? "I found a booking presence, but not a full website"
      : context.websiteStatus === "Broken Website"
      ? "your current website looks like it may need attention"
      : "I took a quick look at your online presence";
  return `Hi${context.businessName ? ` ${context.businessName}` : ""} - I work with local ${String(context.businessType).toLowerCase()} businesses. ${leadIn}. ${context.valueLine} Open to a quick chat this week?`;
}

function generateCallScriptLegacy(company, context = getOutreachContext(company)) {
  return [
    `Hi, this is Cody. Am I speaking with the owner or manager at ${context.businessName}?`,
    "",
    `I work with local ${String(context.businessType).toLowerCase()} businesses, and I reached out because ${context.hook.toLowerCase()}`,
    context.valueLine,
    "",
    "I only need a minute - would you be open to hearing a couple quick ideas?",
    "",
    "If yes, the next step would be a short follow-up conversation.",
  ].join("\n");
}

function generateOnsiteVisitScriptLegacy(company, context = getOutreachContext(company)) {
  return [
    `Hi, I’m Cody. I’m visiting a few ${String(context.businessType).toLowerCase()} businesses${context.location ? ` in ${context.location}` : ""}.`,
    "",
    `I wanted to stop by because ${context.hook.toLowerCase()}`,
    context.valueLine,
    "",
    "Is the owner or manager available for a quick conversation?",
  ].join("\n");
}

function generateFollowUpTemplateLegacy(company, context = getOutreachContext(company)) {
  return [
    `Hi${context.businessName ? ` ${context.businessName}` : ""},`,
    "",
    "Just following up on my last note.",
    context.valueLine,
    context.askLine,
    "",
    "If now is not the right time, no problem - happy to reconnect later.",
  ].join("\n");
}

function generateQuoteFollowUpTemplateLegacy(company, context = getOutreachContext(company)) {
  return [
    `Hi${context.businessName ? ` ${context.businessName}` : ""},`,
    "",
    "I wanted to check in on the quote I shared.",
    "If you have any questions or want me to adjust anything, I'm happy to help.",
    "If it makes sense, we can also talk through next steps briefly.",
  ].join("\n");
}

function renderWorkflowActivityLog(company) {
  const activityEntries = Array.isArray(company.activity_log) ? company.activity_log : [];
  const communicationEntries = Array.isArray(company.communication_logs) ? company.communication_logs : [];
  const noteEntries = Array.isArray(company.notes)
    ? company.notes.map((note) => ({
        id: note.id || `note-${Date.now()}`,
        created_at: note.created_at || "",
        date: note.created_at || "",
        activity_type: "Note Added",
        method: "",
        notes: note.text || "",
        next_action: "",
        next_follow_up: "",
        source: "Manual",
        action: "note-added",
        message: note.text || "Added note",
      }))
    : [];

  const entries = [...activityEntries, ...communicationEntries, ...noteEntries]
    .map((entry) => ({
      id: entry.id || `activity-${Date.now()}`,
      created_at: entry.created_at || entry.date || "",
      date: entry.date || entry.created_at || "",
      activity_type: entry.activity_type || entry.activityType || entry.action || entry.message || "Status Changed",
      method: entry.method || "",
      notes: entry.notes || entry.message || "",
      outcome: entry.outcome || "",
      next_action: entry.next_action || "",
      next_follow_up: entry.next_follow_up || "",
      source: entry.source || "Manual",
      action: entry.action || "update",
      message: entry.message || entry.outcome || "Updated",
    }))
    .filter((entry, index, list) => {
      const key = [
        entry.source || "",
        entry.activity_type || "",
        entry.method || "",
        entry.message || "",
        entry.notes || "",
        entry.date || "",
      ]
        .join("|")
        .toLowerCase();
      return list.findIndex((candidate) => {
        const candidateKey = [
          candidate.source || "",
          candidate.activity_type || "",
          candidate.method || "",
          candidate.message || "",
          candidate.notes || "",
          candidate.date || "",
        ]
          .join("|")
          .toLowerCase();
        return candidateKey === key;
      }) === index;
    })
    .sort((left, right) => String(right.created_at || right.date || "").localeCompare(String(left.created_at || left.date || "")));

  if (!entries.length) {
    return renderNaPanel("No activity entries saved yet.");
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Activity Timeline</p>
      <div class="activity-list">
        ${entries
          .map(
            (entry) => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <div>
                  <p>${escapeHtml(formatDate(entry.created_at || entry.date))} - ${escapeHtml(entry.source || "Manual")}</p>
                  <strong>${escapeHtml(getActivityLabel(entry))}</strong>
                  <p>
                    ${entry.method && entry.method !== "Other" ? `<span class="detail-tag">${escapeHtml(entry.method)}</span>` : ""}
                    ${entry.notes ? `<span>${escapeHtml(entry.notes)}</span>` : ""}
                    ${entry.next_action ? `<span>Next: ${escapeHtml(entry.next_action)}</span>` : ""}
                    ${entry.next_follow_up ? `<span>Follow-up: ${escapeHtml(entry.next_follow_up)}</span>` : ""}
                  </p>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function getActivityLabel(entry) {
  const normalized = String(entry?.activity_type || entry?.action || entry?.message || "Updated").trim();
  if (entry?.source === "System" && /stage updated to/i.test(String(entry?.message || ""))) {
    return String(entry.message);
  }

  const labels = {
    "Intro Email Copied": "Intro Email Copied",
    "Intro Email Sent": "Intro Email Sent",
    "SMS/WhatsApp Copied": "SMS/WhatsApp Copied",
    "SMS/WhatsApp Sent": "SMS/WhatsApp Sent",
    "Message Sent": "Message Sent",
    "Call Attempted": "Call Attempted",
    "Onsite Visit Done": "Onsite Visit Done",
    "Virtual Meeting Done": "Virtual Meeting Done",
    "Client Responded": "Client Responded",
    "Requirements Discussed": "Requirements Discussed",
    "Quote Requested": "Quote Requested",
    "Quote Sent": "Quote Sent",
    "Follow-Up Sent": "Follow-Up Sent",
    "Contract Sent": "Contract Sent",
    "Contract Received": "Contract Received",
    "Advance Payment Received": "Advance Payment Received",
    "Note Added": "Note Added",
    "Status Changed": "Status Changed",
    save: "Saved",
    hide: "Hidden",
    archive: "Archived",
    unarchive: "Unarchived",
    Saved: "Saved",
    Hidden: "Hidden",
    Archived: "Archived",
    Unarchived: "Unarchived",
  };

  return labels[normalized] || titleCase(normalized);
}

function renderProspectNotes(company) {
  const notes = Array.isArray(company.notes) ? company.notes : [];

  if (!notes.length) {
    return renderNaPanel("No prospect notes saved yet.");
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Notes</p>
      <div class="activity-list">
        ${notes
          .map(
            (note) => `
              <div class="activity-item">
                <span class="activity-dot"></span>
                <div>
                  <p>${escapeHtml(formatDate(note.created_at))}</p>
                  <strong>${escapeHtml(note.text || "NA")}</strong>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderMilestoneChecklist(company) {
  const milestones = company.milestones || {};

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Milestones</p>
      <div class="milestone-list">
        ${PROCESS_MILESTONES.map(
          (milestone) => `
            <label class="milestone-item">
              <input
                type="checkbox"
                data-company-id="${escapeAttribute(company.id)}"
                data-process-milestone="${escapeAttribute(milestone)}"
                ${milestones[milestone] ? "checked" : ""}
              />
              <span>${escapeHtml(milestone)}</span>
            </label>
          `
        ).join("")}
      </div>
    </section>
  `;
}

function renderProcessCard(label, value) {
  return `
    <div class="overview-card">
      <span class="overview-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "NA")}</strong>
    </div>
  `;
}

function renderStageSelectCard(company) {
  return `
    <div class="overview-card">
      <span class="overview-label">Current stage</span>
      <label class="inline-field">
        <select aria-label="Current stage" data-prospect-status="1" data-company-id="${escapeAttribute(company.id)}">
          ${PROSPECT_STAGES.map(
            (stage) => `<option value="${escapeAttribute(stage)}" ${stage === getProspectStage(company) ? "selected" : ""}>${escapeHtml(stage)}</option>`
          ).join("")}
        </select>
      </label>
    </div>
  `;
}

function renderStageUpdateNote(company) {
  if (company.stageUpdateSource !== "process" || !company.stageUpdatedAt) {
    return "";
  }

  return `
    <p class="workflow-note">Stage updated to ${escapeHtml(getProspectStage(company))} from process checklist.</p>
  `;
}

function renderLinkCard(label, url) {
  return `
    <div class="overview-card">
      <span class="overview-label">${escapeHtml(label)}</span>
      ${
        url
          ? `<a class="link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(url))}</a>`
          : "<strong>NA</strong>"
      }
    </div>
  `;
}

function renderSourceLinks(company) {
  const links = Array.isArray(company.sourceLinks) ? company.sourceLinks : [];
  if (!links.length) {
    return "";
  }

  return `
    <div class="source-list">
      ${links
        .slice(0, 8)
        .map(
          (url) => `
          <div class="source-item">
            <span class="source-label">Enrichment source</span>
            <a class="link" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(url))}</a>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

function renderContactActionButtons(contact) {
  return `
    <button
      class="secondary-btn"
      type="button"
      data-approve-contact="1"
      data-company-website="${escapeAttribute(contact.company_website || "")}"
      data-email="${escapeAttribute(contact.email || "")}"
      data-phone="${escapeAttribute(contact.phone || "")}"
    >Approve</button>
    <button
      class="secondary-btn"
      type="button"
      data-mark-bad-contact="1"
      data-company-website="${escapeAttribute(contact.company_website || "")}"
      data-email="${escapeAttribute(contact.email || "")}"
      data-phone="${escapeAttribute(contact.phone || "")}"
    >Mark Bad</button>
    <button
      class="secondary-btn"
      type="button"
      data-copy-contact-email="1"
      data-company-website="${escapeAttribute(contact.company_website || "")}"
      data-email="${escapeAttribute(contact.email || "")}"
      data-phone="${escapeAttribute(contact.phone || "")}"
      ${contact.email ? "" : "disabled"}
    >Copy Email</button>
    <button
      class="secondary-btn"
      type="button"
      data-copy-contact-phone="1"
      data-company-website="${escapeAttribute(contact.company_website || "")}"
      data-email="${escapeAttribute(contact.email || "")}"
      data-phone="${escapeAttribute(contact.phone || "")}"
      ${contact.phone ? "" : "disabled"}
    >Copy Phone</button>
  `;
}

function bindContactActions(container, {
  onApproveContact,
  onMarkBadContact,
  onCopyContactEmail,
  onCopyContactPhone,
}) {
  container.querySelectorAll("[data-approve-contact]").forEach((button) => {
    button.addEventListener("click", () => onApproveContact(readContactPayload(button)));
  });
  container.querySelectorAll("[data-mark-bad-contact]").forEach((button) => {
    button.addEventListener("click", () => onMarkBadContact(readContactPayload(button)));
  });
  container.querySelectorAll("[data-copy-contact-email]").forEach((button) => {
    button.addEventListener("click", () => onCopyContactEmail(readContactPayload(button)));
  });
  container.querySelectorAll("[data-copy-contact-phone]").forEach((button) => {
    button.addEventListener("click", () => onCopyContactPhone(readContactPayload(button)));
  });
}

function renderDetailRow(label, valueHtml) {
  return `
    <div class="detail-row">
      <span class="detail-row-label">${escapeHtml(label)}</span>
      <span class="detail-row-value">${valueHtml}</span>
    </div>
  `;
}

function renderNaPanel(message) {
  return `<div class="na-panel">${escapeHtml(message)}</div>`;
}

function readContactPayload(button) {
  return {
    companyWebsite: button.getAttribute("data-company-website") || "",
    email: button.getAttribute("data-email") || "",
    phone: button.getAttribute("data-phone") || "",
  };
}

function readContactFieldsPayload(container) {
  const payload = {};
  container.querySelectorAll("[data-contact-field]").forEach((field) => {
    payload[field.getAttribute("data-contact-field")] = field.value || "";
  });
  return payload;
}

function readCommunicationPayload(container, companyId) {
  return {
    companyId,
    activityType: container.querySelector("[data-activity-type]")?.value || "",
    date: container.querySelector("[data-communication-date]")?.value || "",
    method: container.querySelector("[data-communication-method]")?.value || "Other",
    outcome: container.querySelector("[data-communication-outcome]")?.value || "",
    notes: container.querySelector("[data-communication-note-input]")?.value || "",
    nextAction: container.querySelector("[data-communication-next-action]")?.value || "",
    nextFollowUp: container.querySelector("[data-communication-follow-up]")?.value || "",
  };
}

function readSenderProfilePayload(container) {
  return {
    yourName: container.querySelector("[data-sender-your-name]")?.value || "",
    companyName: container.querySelector("[data-sender-company-name]")?.value || "",
    phone: container.querySelector("[data-sender-phone]")?.value || "",
    email: container.querySelector("[data-sender-email]")?.value || "",
    website: container.querySelector("[data-sender-website]")?.value || "",
    pitch: container.querySelector("[data-sender-pitch]")?.value || "",
  };
}

function readQuotePayload(container) {
  const estimatedPrice = String(container.querySelector("[data-quote-estimated-price]")?.value || "").trim();
  const discount = String(container.querySelector("[data-quote-discount]")?.value || "").trim();
  const finalQuoteAmount = calculateQuoteAmountValue(estimatedPrice, discount);

  return {
    quoteStatus: container.querySelector("[data-quote-status]")?.value || "Not Started",
    projectType: container.querySelector("[data-quote-project-type]")?.value || "Website",
    packageType: container.querySelector("[data-quote-package-type]")?.value || "Professional",
    estimatedPrice,
    discount,
    finalQuoteAmount,
    finalQuoteAmountDisplay: formatCurrencyDisplay(finalQuoteAmount),
    paymentTerms: container.querySelector("[data-quote-payment-terms]")?.value || "",
    timelineEstimate: container.querySelector("[data-quote-timeline-estimate]")?.value || "",
    scopeNotes: container.querySelector("[data-quote-scope-notes]")?.value || "",
    internalNotes: container.querySelector("[data-quote-internal-notes]")?.value || "",
    quoteSentDate: container.querySelector("[data-quote-sent-date]")?.value || "",
    quoteFollowUpDate: container.querySelector("[data-quote-follow-up-date]")?.value || "",
  };
}

function calculateQuoteAmountValue(estimatedPrice, discount) {
  const estimated = parseNumericQuoteValue(estimatedPrice);
  const discountValue = parseNumericQuoteValue(discount);
  return Math.max(0, Math.round(estimated - discountValue));
}

function parseNumericQuoteValue(value) {
  const normalized = String(value || "")
    .replace(/[$,]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyDisplay(value) {
  const amount = parseNumericQuoteValue(value);
  if (!amount) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getQuotePackageHint(company) {
  const websiteStatus = String(company?.websiteStatus || "").trim();
  const websiteQualityStatus = String(company?.websiteQualityStatus || "").trim();
  const opportunityPriority = String(company?.opportunityPriority || company?.lead_label || "").trim();

  if (opportunityPriority === "Best Prospect") {
    return "Professional or Premium";
  }

  if (websiteStatus === "No Website") {
    return "Starter or Professional";
  }

  if (websiteStatus === "Social Only") {
    return "Professional";
  }

  if (websiteStatus === "Booking Link Only") {
    return "Website + Booking or Professional";
  }

  if (websiteQualityStatus === "Weak Website" || websiteQualityStatus === "Broken Website") {
    return "Website Redesign or Professional";
  }

  if (websiteStatus === "Weak Website" || websiteStatus === "Broken Website") {
    return "Website Redesign or Professional";
  }

  return "Professional";
}

function getQuoteProjectType(company) {
  const websiteStatus = String(company?.websiteStatus || "").trim();
  const websiteQualityStatus = String(company?.websiteQualityStatus || "").trim();

  if (websiteStatus === "Booking Link Only") {
    return "Website + Booking";
  }

  if (websiteStatus === "Weak Website" || websiteStatus === "Broken Website") {
    return "Website Redesign";
  }

  if (websiteQualityStatus === "Weak Website" || websiteQualityStatus === "Broken Website") {
    return "Website Redesign";
  }

  return "Website";
}

function getQuoteDraftModel(company) {
  const estimatedPrice = parseNumericQuoteValue(company?.quote_estimated_price || company?.estimated_price || company?.quote_price || 0);
  const discount = parseNumericQuoteValue(company?.quote_discount || 0);
  const finalQuoteAmount = Number(
    company?.quote_final_quote_amount ?? calculateQuoteAmountValue(estimatedPrice, discount)
  );

  return {
    quoteStatus: String(company?.quote_status || "Not Started").trim() || "Not Started",
    projectType: String(company?.quote_project_type || getQuoteProjectType(company)).trim() || "Website",
    packageType: String(company?.quote_package_type || "Professional").trim() || "Professional",
    estimatedPrice,
    discount,
    finalQuoteAmount,
    finalQuoteAmountDisplay: formatCurrencyDisplay(finalQuoteAmount) || "TBD",
    paymentTerms: String(company?.quote_payment_terms || "").trim(),
    timelineEstimate: String(company?.quote_timeline_estimate || "").trim(),
    scopeNotes: String(company?.quote_scope_notes || "").trim(),
    internalNotes: String(company?.quote_internal_notes || "").trim(),
    quoteSentDate: String(company?.quote_sent_date || "").trim(),
    quoteFollowUpDate: String(company?.quote_follow_up_date || company?.next_follow_up || "").trim(),
  };
}

function buildQuoteSummaryPreview(company, quote, senderProfile = {}) {
  const businessName = company?.name || "your business";
  const projectType = String(quote?.projectType || "Website").trim() || "Website";
  const packageType = String(quote?.packageType || "Professional").trim() || "Professional";
  const scopeNotes = String(quote?.scopeNotes || "").trim() || "Scope to be confirmed";
  const timelineEstimate = String(quote?.timelineEstimate || "").trim() || "To be confirmed";
  const paymentTerms = String(quote?.paymentTerms || "").trim() || "To be confirmed";
  const finalAmount = formatCurrencyDisplay(quote?.finalQuoteAmount) || "TBD";
  const discount = formatCurrencyDisplay(quote?.discount) || "$0";
  const senderName = String(senderProfile?.yourName || "").trim();
  const senderCompany = String(senderProfile?.companyName || "").trim();
  const senderLabel = [senderName, senderCompany].filter(Boolean).join(" · ");

  const nextStep =
    quote?.quoteStatus === "Accepted"
      ? "Please confirm the final scope and we can get started."
      : quote?.quoteStatus === "Rejected"
        ? "Thanks for reviewing it. I’m happy to revisit this later if useful."
        : "Please review the scope and let me know if you'd like any changes.";

  const lines = [
    `Quote for ${businessName}`,
    `Project type: ${projectType}`,
    `Package: ${packageType}`,
    `Scope: ${scopeNotes}`,
    `Timeline: ${timelineEstimate}`,
    `Estimated price: ${formatCurrencyDisplay(quote?.estimatedPrice) || "TBD"}`,
    `Discount: ${discount}`,
    `Final quote amount: ${finalAmount}`,
    `Payment terms: ${paymentTerms}`,
    `Next step: ${nextStep}`,
  ];

  if (senderLabel) {
    lines.push(`Prepared by: ${senderLabel}`);
  } else if (String(senderProfile?.pitch || "").trim()) {
    lines.push(`Service pitch: ${String(senderProfile.pitch).trim()}`);
  }

  const senderContactLine = [
    String(senderProfile?.phone || "").trim() ? `Phone: ${String(senderProfile.phone).trim()}` : "",
    String(senderProfile?.email || "").trim() ? `Email: ${String(senderProfile.email).trim()}` : "",
    String(senderProfile?.website || "").trim() ? `Portfolio: ${String(senderProfile.website).trim()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (senderContactLine) {
    lines.push(`Contact: ${senderContactLine}`);
  }

  return lines.join("\n");
}

function updateQuotePreview(container, company = {}, senderProfile = {}) {
  const summaryField = container.querySelector("[data-quote-summary-preview]");
  const finalAmountField = container.querySelector("[data-quote-final-amount]");
  if (!summaryField && !finalAmountField) {
    return;
  }

  const quote = readQuotePayload(container);
  const summary = buildQuoteSummaryPreview(company || {}, quote, senderProfile || {});

  if (summaryField) {
    summaryField.value = summary;
  }

  if (finalAmountField) {
    finalAmountField.value = quote.finalQuoteAmountDisplay || "TBD";
  }
}

function showTransientButtonState(button, label, timeout = 1200) {
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = originalText;
  }, timeout);
}

function renderEmailStatusBadge(contact) {
  const emailStatus = String(contact?.email_status || "none");

  if (emailStatus === "none") {
    return "";
  }

  const labels = {
    verified: "Verified",
    guessed: "Guessed",
    generic: "Generic",
  };

  const cssClass =
    emailStatus === "verified"
      ? "verified-badge"
      : emailStatus === "guessed"
        ? "warning-badge"
        : "generic-badge";

  return `<span class="detail-badge ${cssClass}">${escapeHtml(labels[emailStatus] || "Email")}</span>`;
}

function formatEmailStatus(contact) {
  const emailStatus = String(contact?.email_status || "none");
  const labels = {
    verified: "Verified",
    guessed: `Guessed${contact?.email_guess_pattern ? ` (${contact.email_guess_pattern})` : ""}`,
    generic: "Generic",
    none: "None",
  };

  return labels[emailStatus] || "None";
}

function formatSource(value) {
  const labels = {
    google_places: "Google",
    serp_api: "SerpAPI",
    fallback_search: "Fallback",
    manual: "Manual",
  };

  return labels[value] || value || "NA";
}

function formatFailureReason(value) {
  const labels = {
    blocked: "Blocked",
    no_website: "No website",
    timeout: "Timeout",
    no_contacts: "No contacts",
    unknown: "Unknown",
  };

  return labels[value] || (value ? titleCase(value) : "NA");
}

function formatRating(company) {
  const rating = Number(company.rating || 0);
  const reviewCount = Number(company.reviews || company.reviewCount || 0);

  if (!rating && !reviewCount) {
    return "No rating";
  }

  return `${rating ? rating.toFixed(1) : "NA"} (${reviewCount} reviews)`;
}

function formatConfidenceBadge(value) {
  const numeric = Number(value || 0);
  if (numeric >= 85) {
    return "High";
  }

  if (numeric >= 70) {
    return "Medium";
  }

  return "Review";
}

function getConfidenceBadgeClass(value) {
  const numeric = Number(value || 0);
  if (numeric >= 85) {
    return "high_quality";
  }

  if (numeric >= 70) {
    return "medium_quality";
  }

  return "needs_review";
}

function getLeadBadgeClass(label) {
  const normalized = String(label || "").toLowerCase();

  if (normalized === "best prospect" || normalized === "strong prospect") {
    return "high_quality";
  }

  if (normalized === "needs review") {
    return "medium_quality";
  }

  return "needs_review";
}

function formatReviewStatus(value) {
  const labels = {
    approved: "Approved",
    new: "New",
    needs_review: "Needs Review",
    rejected: "Rejected",
    not_reviewed: "Not Reviewed",
  };

  return labels[value] || "New";
}

function getReviewStatusClass(value) {
  if (value === "approved") {
    return "contacts-found";
  }

  if (value === "rejected") {
    return "failed";
  }

  if (value === "needs_review" || value === "not_reviewed") {
    return "needs-review";
  }

  return "not-scanned";
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function getProspectStage(company) {
  const stage = String(company.prospect_stage || company.stage || "New Lead").trim();
  if (stage === "Meeting Scheduled") {
    return "Meeting Done";
  }

  return PROSPECT_STAGES.includes(stage) ? stage : "New Lead";
}

function getSuggestedNextAction(company) {
  const stage = getProspectStage(company);

  if (stage === "New Lead") {
    return company.website ? "Review website and prepare outreach." : "Confirm whether the business needs a website.";
  }

  if (stage === "Quote Requested") {
    return "Prepare quote placeholder and confirm scope.";
  }

  if (stage === "Quote Sent" || stage === "Negotiation") {
    return "Follow up on decision timeline.";
  }

  if (CONVERTIBLE_STAGES.has(stage)) {
    return "Create a client profile when the agreement is ready.";
  }

  return "Update communication status after the next touchpoint.";
}

function getFollowUpStatus(dateValue) {
  const dateKey = String(dateValue || "").slice(0, 10);
  if (!dateKey) {
    return "No Follow-Up Set";
  }

  const today = getTodayDateInput();
  if (dateKey < today) {
    return "Overdue";
  }

  if (dateKey === today) {
    return "Due Today";
  }

  const diffDays = Math.round((new Date(`${dateKey}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
  if (diffDays >= 1 && diffDays <= 7) {
    return "Upcoming This Week";
  }

  return "Upcoming";
}

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSavedProspect(company, savedCompanies) {
  if (!company) {
    return false;
  }

  if (Boolean(company.is_saved_prospect)) {
    return true;
  }

  const companyKeys = getProspectSavedKeys(company);
  return Array.isArray(savedCompanies) && savedCompanies.some((savedId) => companyKeys.includes(normalizeSavedKey(savedId)));
}

function getProspectSavedKeys(company) {
  const keys = [
    company?.id,
    company?.placeId,
    company?.place_id,
    company?.website,
    company?.phone,
    [company?.name, company?.address].filter(Boolean).join("|"),
    [company?.name, company?.city, company?.state].filter(Boolean).join("|"),
  ];

  return [...new Set(keys.map((value) => normalizeSavedKey(value)).filter(Boolean))];
}

function normalizeSavedKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function renderConversionPlaceholder(company) {
  const existingClientId = String(company?.clientId || "").trim();

  if (existingClientId) {
    return `
      <div class="overview-card">
        <span class="overview-label">Client profile</span>
        <strong>Linked to client record.</strong>
      </div>
    `;
  }

  if (!isProspectEligibleForClientConversion(company)) {
    return `
      <div class="overview-card">
        <span class="overview-label">Convert to Client</span>
        <strong>Available after quote acceptance or contract progress.</strong>
      </div>
    `;
  }

  return `
    <div class="overview-card">
      <span class="overview-label">Convert to Client</span>
      <strong>Ready to create an active client profile.</strong>
    </div>
  `;
}

function isProspectEligibleForClientConversion(company) {
  const milestones = company?.milestones && typeof company.milestones === "object" ? company.milestones : {};
  return (
    CONVERTIBLE_STAGES.has(getProspectStage(company)) ||
    String(company?.quote_status || "").trim() === "Accepted" ||
    Boolean(milestones["Contract received"]) ||
    Boolean(milestones["Advance payment received"])
  );
}

function formatDetailTab(value) {
  if (value === "next_actions") {
    return "Next Actions";
  }

  return titleCase(value);
}

function isSameContact(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    String(left.email || "") === String(right.email || "") &&
    String(left.phone || "") === String(right.phone || "")
  );
}

function formatDate(value) {
  if (!value) {
    return "NA";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "NA" : date.toLocaleString();
}

function stripProtocol(value) {
  return String(value || "").replace(/^https?:\/\//, "");
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
function getOutreachContext(company) {
  const businessName = company?.business_name || company?.businessName || "your business";
  const businessType = company?.business_type || company?.businessType || "business";
  const city = company?.city || company?.location || "";
  const state = company?.state || "";
  const location = [city, state].filter(Boolean).join(", ");
  const websiteStatus = company?.website_status || company?.websiteStatus || "Unknown";
  const websiteQualityStatus = company?.website_quality_status || company?.websiteQualityStatus || "Not Checked";
  const bookingPlatform = company?.booking_platform || company?.bookingPlatform || "";
  const socialPlatform = company?.social_platform || company?.socialPlatform || "";
  const opportunityPriority = company?.opportunity_priority || company?.opportunityPriority || "Needs Review";
  const websiteQualityScore = company?.website_quality_score ?? company?.websiteQualityScore ?? null;
  const contactName =
    company?.primary_contact?.name || company?.contact_name || company?.owner_name || company?.owner || company?.manager_name || "";
  const siteQualityNote =
    websiteQualityStatus === "Weak Website" || websiteQualityStatus === "Needs Review"
      ? "There is room to improve the site for mobile visitors, services, and booking conversion."
      : websiteQualityStatus === "Broken Website"
      ? "The current website appears to have issues, so a cleaner web presence could help."
      : websiteQualityStatus === "Strong Website"
      ? "The website looks solid, so the outreach can focus on refinements and conversion."
      : "";
  const presenceNote =
    websiteStatus === "No Website"
      ? "I did not find a dedicated website."
      : websiteStatus === "Social Only"
      ? "I only found social profiles, so a dedicated website could build more trust."
      : websiteStatus === "Booking Link Only"
      ? "I found a booking presence, but not a full owned website."
      : websiteStatus === "Broken Website"
      ? "The website looks broken or unusable right now."
      : websiteStatus === "Has Website"
      ? "You already have a website, but there may still be room to improve how it converts visitors."
      : "I wanted to reach out because your online presence looks worth a closer look.";
  const platformNote =
    bookingPlatform && bookingPlatform !== "Unknown"
      ? `I noticed ${bookingPlatform} in the mix${socialPlatform && socialPlatform !== "Unknown" ? `, along with ${socialPlatform}` : ""}.`
      : socialPlatform && socialPlatform !== "Unknown"
      ? `I noticed ${socialPlatform} as the main online presence.`
      : "";
  const valueLine =
    opportunityPriority === "Best Prospect" || opportunityPriority === "Strong Prospect"
      ? "You may be a good fit for a quick conversation about simple website improvements that can help bring in more inquiries."
      : "I think there may be an opportunity to improve how your business is presented online.";
  const hook = [presenceNote, siteQualityNote, platformNote].filter(Boolean).join(" ");
  const askLine = location
    ? `If you're open to it, I'd be happy to share a couple quick ideas for ${businessType.toLowerCase()} businesses in ${location}.`
    : `If you're open to it, I'd be happy to share a couple quick ideas for ${businessType.toLowerCase()} businesses.`;
  const followUpLine =
    websiteQualityScore != null
      ? `I also took a quick look at the current site and noted a score of ${websiteQualityScore}/100.`
      : "";

  return {
    businessName,
    businessType,
    location,
    websiteStatus,
    websiteQualityStatus,
    websiteQualityScore,
    bookingPlatform,
    socialPlatform,
    contactName,
    opportunityPriority,
    hook,
    valueLine,
    askLine,
    followUpLine,
  };
}

function buildOutreachTemplateBody(templateKey, company, context, senderProfile, tone) {
  return generateTemplateByType(templateKey, context, senderProfile, tone);
}

function generateTemplateByType(templateKey, context, senderProfile = {}, tone = "Professional") {
  const toneLabel = getTemplateToneVariant(tone);
  const greetingName =
    context.contactName ||
    (context.businessName && context.businessName !== "your business" ? context.businessName : "");
  const senderName = String(senderProfile.yourName || "").trim();
  const signatureName = senderName || "Cody";
  const senderCompany = String(senderProfile.companyName || "").trim();
  const senderPhone = String(senderProfile.phone || "").trim();
  const senderEmail = String(senderProfile.email || "").trim();
  const senderWebsite = String(senderProfile.website || "").trim();
  const pitch = String(
    senderProfile.pitch ||
      "I help local businesses create clean, mobile-friendly websites that make services, photos, and contact options easier for customers to find."
  ).trim();
  const contactLine = senderCompany || senderPhone || senderEmail || senderWebsite ? [senderCompany, senderPhone].filter(Boolean).join(" • ") : "";
  const noWebsiteLine =
    context.websiteStatus === "No Website"
      ? "I did not find a dedicated website."
      : context.websiteStatus === "Social Only"
      ? "I found social pages, but a dedicated website could help build more trust and control the message."
      : context.websiteStatus === "Booking Link Only"
      ? "I found a booking presence, but a dedicated website would give you more room for services, photos, and branding."
      : context.websiteStatus === "Broken Website"
      ? "The current website looks like it may not be working consistently."
      : context.websiteStatus === "Weak Website"
      ? "The current website looks like it could be clearer on mobile, services, gallery, and appointment flow."
      : context.websiteQualityStatus === "Strong Website"
      ? "You already have a solid website, so I’d focus on small improvements rather than a rebuild."
      : "I wanted to reach out because your online presence looks worth a closer look.";
  const shortHook =
    toneLabel === "Very Short"
      ? `${context.businessName || "your business"} ${noWebsiteLine.toLowerCase()}`
      : noWebsiteLine;

  const footer = [
    `Best,`,
    signatureName,
    senderCompany || "",
    contactLine || "",
    senderEmail || "",
    senderWebsite || "",
  ]
    .filter(Boolean)
    .join("\n");

  if (templateKey === "intro_email") {
    return [
      `Hi${greetingName ? ` ${greetingName}` : ""},`,
      "",
      toneLabel === "Friendly"
        ? `I came across ${context.businessName || "your business"} while looking at local ${context.businessType.toLowerCase()} businesses.`
        : `I work with local ${context.businessType.toLowerCase()} businesses and wanted to reach out.`,
      shortHook,
      pitch,
      context.askLine,
      "",
      footer,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (templateKey === "sms_message") {
    const line =
      toneLabel === "Very Short"
        ? `${context.businessName || "Hi"} - ${shortHook} ${context.valueLine}`
        : `${greetingName ? `Hi ${greetingName}` : "Hi"} - I work with local ${context.businessType.toLowerCase()} businesses. ${shortHook} ${context.valueLine} Open to a quick chat?`;
    return line
      .replace(/\s+/g, " ")
      .replace("  ", " ")
      .trim();
  }

  if (templateKey === "call_script") {
    return [
      `Hi, this is ${signatureName}. Am I speaking with the owner or manager at ${context.businessName}?`,
      "",
      toneLabel === "Very Short"
        ? shortHook
        : `I work with local ${context.businessType.toLowerCase()} businesses, and I reached out because ${shortHook.toLowerCase()}`,
      context.valueLine,
      "",
      "I only need a minute - would you be open to hearing a couple quick ideas?",
      "",
      "If yes, I can send a short note with next steps.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (templateKey === "onsite_visit") {
    return [
      `Hi, I’m ${signatureName}. I’m visiting a few ${context.businessType.toLowerCase()} businesses${context.location ? ` in ${context.location}` : ""}.`,
      "",
      shortHook,
      context.valueLine,
      "",
      "Is the owner or manager available for a quick conversation?",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (templateKey === "follow_up") {
    return [
      `Hi${greetingName ? ` ${greetingName}` : ""},`,
      "",
      toneLabel === "Follow-Up" ? "Just checking back in on my last message." : "Just following up on my last note.",
      context.valueLine,
      context.askLine,
      "",
      "If now is not the right time, no problem - happy to reconnect later.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (templateKey === "quote_follow_up") {
    return [
      `Hi${greetingName ? ` ${greetingName}` : ""},`,
      "",
      "I wanted to check in on the quote I shared.",
      "If you have any questions or want me to adjust anything, I'm happy to help.",
      "If it makes sense, we can also talk through next steps briefly.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return shortHook;
}

function getTemplateToneVariant(tone) {
  const normalized = String(tone || "Professional").trim().toLowerCase();
  if (normalized === "friendly") {
    return "Friendly";
  }
  if (normalized === "very short") {
    return "Very Short";
  }
  if (normalized === "follow-up") {
    return "Follow-Up";
  }
  return "Professional";
}
