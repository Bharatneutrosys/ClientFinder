import { getScanStatusMeta, SCAN_STATUS } from "./scanner.js";

const PROSPECT_STAGES = [
  "New Lead",
  "Saved",
  "Outreach Started",
  "Engaged",
  "Meeting Scheduled",
  "Quote Requested",
  "Quote Sent",
  "Negotiation",
  "Contract Received",
  "Client Onboarding",
  "Lost",
  "Archived",
];

const CONVERTIBLE_STAGES = new Set(["Contract Received"]);
const COMMUNICATION_METHODS = ["Call", "Email", "SMS", "WhatsApp", "Onsite Visit", "LinkedIn", "Other"];
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
}) {
  if (!companies.length) {
    container.innerHTML = "";
    return;
  }

  container.className = "results-container list-view";
  container.innerHTML = renderCompanyTable(companies, scanner, selectedCompanyId, savedCompanies, mode);

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
  onApproveContact,
  onMarkBadContact,
  onCopyContactEmail,
  onCopyContactPhone,
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
  const availableTabs = ["overview", "contact", "activity", "process", "notes", "quote"];
  const selectedTab = availableTabs.includes(activeTab) ? activeTab : "overview";
  const statusMeta = getScanStatusMeta(company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = company.scan_failure_reason || "";
  const prospectStage = getProspectStage(company);

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
      <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.lead_label))}">${escapeHtml(company.lead_label || "Needs Review")}</span>
      <span class="detail-tag">${escapeHtml(String(company.lead_score || 0))}/100 opportunity score</span>
      <span class="detail-tag">${escapeHtml(prospectStage)}</span>
      ${company.outreach_ready ? `<span class="detail-tag">Outreach ready</span>` : ""}
      ${(company.industry_tags || [company.industry || "NA"])
        .map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`)
        .join("")}
    </div>

    <div class="detail-actions">
      <a class="primary-btn inline-link-btn" href="${escapeAttribute(company.website || "#")}" target="_blank" rel="noreferrer">Website</a>
      <button class="secondary-btn" type="button" data-detail-scan="${escapeAttribute(company.id)}">Deep Scan</button>
      ${
        failureReason
          ? `<button class="secondary-btn" type="button" data-detail-retry="${escapeAttribute(company.id)}">Retry</button>`
          : ""
      }
      <button class="secondary-btn" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved Prospect" : "Save Prospect"}</button>
      ${
        CONVERTIBLE_STAGES.has(prospectStage)
          ? `<button class="secondary-btn" type="button" title="Client credential, document, and payment storage will be added later.">Convert to Client</button>`
          : ""
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
      ${renderTabContent({ company, primaryContact, otherContacts, activeTab: selectedTab })}
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
      const input = container.querySelector("[data-follow-up-input]");
      onSetNextFollowUp(followUpButton.getAttribute("data-set-follow-up"), input?.value || "");
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
}

function renderCompanyTable(companies, scanner, selectedCompanyId, savedCompanies, mode) {
  return `
    <div class="prospect-list-shell">
      <div class="prospect-list-head">
        <span>${mode === "saved" ? "Saved prospect" : "Business"}</span>
        <span>${mode === "saved" ? "Workflow" : "Fit"}</span>
        <span>Signals</span>
        <span>Actions</span>
      </div>
      <div class="prospect-list">
        ${companies
          .map((company) => renderCompanyRow(company, scanner.getState(company.id), selectedCompanyId, savedCompanies, mode))
          .join("")}
      </div>
    </div>
  `;
}

function renderCompanyRow(company, scanState, selectedCompanyId, savedCompanies, mode) {
  const bestContact = company.primary_contact || null;
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";
  const confidence = Number(bestContact?.confidence_score || company.confidence_score || 0);
  const leadScore = Number(company.lead_score || 0);
  const isSaved = isSavedProspect(company, savedCompanies);

  return `
    <article class="prospect-row ${company.id === selectedCompanyId ? "selected" : ""} ${isSaved ? "saved" : ""}">
      <button class="prospect-main" type="button" data-open-details="${escapeAttribute(company.id)}">
        <span class="row-title">${escapeHtml(company.name || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.industry || company.keyword || "NA")} · ${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</span>
        <span class="row-subtitle">${escapeHtml(company.phone || "No phone")} · ${escapeHtml(formatRating(company))}</span>
      </button>
      <div class="prospect-fit">
        <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.lead_label))}">${escapeHtml(company.lead_label || "Needs Review")}</span>
        <span class="row-subtitle">${escapeHtml(String(leadScore))}/100</span>
        ${mode === "saved" ? `<span class="row-subtitle">${escapeHtml(getProspectStage(company))}</span>` : ""}
      </div>
      <div class="prospect-signals">
        <span>${escapeHtml(company.websiteStatus || "Unknown")}</span>
        <span>${escapeHtml(company.mobileAppStatus || "Unknown")}</span>
        ${company.bookingPlatform && company.bookingPlatform !== "Unknown" ? `<span>${escapeHtml(company.bookingPlatform)}</span>` : ""}
        ${mode === "saved" ? `<span>Follow-up: ${escapeHtml(company.next_follow_up || "Not scheduled")}</span>` : ""}
        ${mode === "saved" ? `<span>Last contacted: ${escapeHtml(company.last_contacted_at || "NA")}</span>` : ""}
      </div>
      <div class="table-actions">
        <button class="${isSaved ? "primary-btn" : "secondary-btn"}" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved" : "Save"}</button>
        <button class="secondary-btn" type="button" data-hide-company="${escapeAttribute(company.id)}">Hide</button>
        <button class="secondary-btn" type="button" data-open-details="${escapeAttribute(company.id)}">View Details</button>
      </div>
    </article>
  `;
}

function renderCompanyGridCard(company, scanState, selectedCompanyId, savedCompanies) {
  const bestContact = company.primary_contact || null;
  const confidence = Number(company.lead_score || bestContact?.confidence_score || company.confidence_score || 0);
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";
  const isSaved = isSavedProspect(company, savedCompanies);

  return `
    <article class="company-grid-card ${company.id === selectedCompanyId ? "selected" : ""} ${isSaved ? "saved" : ""}">
      <div class="company-grid-top">
        <div>
          <h3>${escapeHtml(company.name || "NA")}</h3>
          <p>${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</p>
        </div>
        <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.lead_label))}">${escapeHtml(company.lead_label || formatConfidenceBadge(confidence))}</span>
      </div>
      <div class="company-grid-meta">
        <span>${escapeHtml(company.industry || "NA")}</span>
        <span>Website Status: ${escapeHtml(company.websiteStatus || "Unknown")}</span>
        <span>Mobile App Status: ${escapeHtml(company.mobileAppStatus || "Unknown")}</span>
        ${company.bookingPlatform ? `<span>Booking Platform: ${escapeHtml(company.bookingPlatform)}</span>` : ""}
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

function renderTabContent({ company, primaryContact, otherContacts, activeTab }) {
  if (activeTab === "contact") {
    return `
      ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("No verified public contact person found yet.")}
      <div class="overview-grid">
        ${renderLinkCard("Website", company.website)}
        ${renderLinkCard("Google Profile", company.source_url)}
        ${renderLinkCard("Booking", company.booking_url || "")}
        ${renderLinkCard("Instagram", company.instagram_url || "")}
        ${renderLinkCard("Facebook", company.facebook_url || "")}
      </div>
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

  if (activeTab === "activity") {
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Add Activity</p>
        <div class="workflow-form-grid">
          <label class="inline-field"><span>Date</span><input type="date" value="${escapeAttribute(getTodayDateInput())}" data-communication-date /></label>
          <label class="inline-field"><span>Method</span><select data-communication-method>${COMMUNICATION_METHODS.map((method) => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("")}</select></label>
          <label class="inline-field"><span>Outcome/Status</span><input type="text" data-communication-outcome placeholder="Reached owner, left voicemail, replied" /></label>
          <label class="inline-field"><span>Next Action</span><input type="text" data-communication-next-action placeholder="Call again, send quote, schedule visit" /></label>
          <label class="inline-field"><span>Next Follow-Up Date</span><input type="date" value="${escapeAttribute(company.next_follow_up || "")}" data-communication-follow-up /></label>
        </div>
        <textarea class="workflow-textarea" data-communication-note-input rows="4" placeholder="Notes from the activity"></textarea>
        <div class="workflow-actions"><button class="primary-btn" type="button" data-add-communication-note="${escapeAttribute(company.id)}">Add Activity</button></div>
      </section>
      ${renderCommunicationLog(company)}
    `;
  }

  if (activeTab === "process") {
    const followUpStatus = getFollowUpStatus(company.next_follow_up);
    return `
      <div class="overview-grid">
        ${renderProcessCard("Current stage", getProspectStage(company))}
        ${renderProcessCard("Last contacted", company.last_contacted_at || "NA")}
        ${renderProcessCard("Next follow-up", company.next_follow_up || "Not scheduled")}
        ${renderProcessCard("Follow-up status", followUpStatus)}
        ${renderProcessCard("Next action", company.next_action || getSuggestedNextAction(company))}
      </div>
      <section class="workflow-card">
        <p class="detail-section-title">Set Next Follow-up</p>
        <div class="workflow-inline">
          <label class="inline-field"><span>Date</span><input type="date" value="${escapeAttribute(company.next_follow_up || "")}" data-follow-up-input /></label>
          <button class="primary-btn" type="button" data-set-follow-up="${escapeAttribute(company.id)}">Set Follow-up</button>
        </div>
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
    return `
      <div class="overview-grid">
        ${renderProcessCard("Quote status", getProspectStage(company) === "Quote Sent" ? "Quote Sent" : "Not created")}
        ${renderProcessCard("Convert to Client", CONVERTIBLE_STAGES.has(getProspectStage(company)) ? "Available" : "Requires Contract Received")}
      </div>
      ${renderConversionPlaceholder(company)}
    `;
  }

  const sourceUrls = dedupe([company.source_url, ...(company.contacts || []).map((contact) => contact.source_url)].filter(Boolean));

  return `
    <div class="overview-grid">
      <div class="overview-card">
        <span class="overview-label">Opportunity score</span>
        <strong>${escapeHtml(company.lead_label || "Needs Review")} (${escapeHtml(String(company.lead_score || 0))}/100)</strong>
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
        <strong>${escapeHtml(company.next_follow_up || "Not scheduled")}</strong>
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
            : "<strong>Has Website = No</strong>"
        }
      </div>
      <div class="overview-card">
        <span class="overview-label">Website Status</span>
        <strong>${escapeHtml(company.websiteStatus || "Unknown")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Mobile App Status</span>
        <strong>${escapeHtml(company.mobileAppStatus || "Unknown")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Booking Platform</span>
        <strong>${escapeHtml(company.bookingPlatform || "NA")}</strong>
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

function readCommunicationPayload(container, companyId) {
  return {
    companyId,
    date: container.querySelector("[data-communication-date]")?.value || "",
    method: container.querySelector("[data-communication-method]")?.value || "Other",
    outcome: container.querySelector("[data-communication-outcome]")?.value || "",
    notes: container.querySelector("[data-communication-note-input]")?.value || "",
    nextAction: container.querySelector("[data-communication-next-action]")?.value || "",
    nextFollowUp: container.querySelector("[data-communication-follow-up]")?.value || "",
  };
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

  if (normalized === "high fit") {
    return "high_quality";
  }

  if (normalized === "medium fit") {
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
    return "Convert to Client placeholder is available. Full client storage is not built yet.";
  }

  return "Update communication status after the next touchpoint.";
}

function getFollowUpStatus(dateValue) {
  const dateKey = String(dateValue || "").slice(0, 10);
  if (!dateKey) {
    return "Not scheduled";
  }

  const today = getTodayDateInput();
  if (dateKey < today) {
    return "Overdue";
  }

  if (dateKey === today) {
    return "Due today";
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

  return Boolean(company.is_saved_prospect) || (Array.isArray(savedCompanies) && savedCompanies.includes(company.id));
}

function renderConversionPlaceholder(company) {
  const stage = getProspectStage(company);

  if (!CONVERTIBLE_STAGES.has(stage)) {
    return `
      <div class="overview-card">
        <span class="overview-label">Convert to Client</span>
        <strong>Available only after Contract Received.</strong>
      </div>
    `;
  }

  return `
    <div class="overview-card">
      <span class="overview-label">Convert to Client</span>
      <strong>Placeholder only - onboarding, credential, document, and payment storage will be added later.</strong>
    </div>
  `;
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
