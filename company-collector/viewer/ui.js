import { getScanStatusMeta, SCAN_STATUS } from "./scanner.js";

const PROSPECT_STAGES = [
  "New Lead",
  "Contacted",
  "Message Sent",
  "Call Done",
  "Onsite Visit Done",
  "Interested",
  "Quote Requested",
  "Quote Sent",
  "Negotiation",
  "Contract Expected",
  "Contract Received",
  "Follow Up Later",
  "Not Interested",
];

const CONVERTIBLE_STAGES = new Set(["Contract Expected", "Contract Received"]);

export function renderResultsView({
  companies,
  container,
  viewMode,
  scanner,
  selectedCompanyId,
  onOpenDetails,
  onScanCompany,
  onRetryScan,
}) {
  if (!companies.length) {
    container.innerHTML = "";
    return;
  }

  if (viewMode === "grid") {
    container.className = "results-container grid-view";
    container.innerHTML = companies
      .map((company) => renderCompanyGridCard(company, scanner.getState(company.id), selectedCompanyId))
      .join("");
  } else {
    container.className = "results-container list-view";
    container.innerHTML = renderCompanyTable(companies, scanner, selectedCompanyId);
  }

  container.querySelectorAll("[data-open-details]").forEach((button) => {
    button.addEventListener("click", () => onOpenDetails(button.getAttribute("data-open-details")));
  });

  container.querySelectorAll("[data-scan-company]").forEach((button) => {
    button.addEventListener("click", () => onScanCompany(button.getAttribute("data-scan-company")));
  });

  container.querySelectorAll("[data-retry-scan]").forEach((button) => {
    button.addEventListener("click", () => onRetryScan(button.getAttribute("data-retry-scan")));
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
  onAddCommunicationNote,
  onSetNextFollowUp,
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
  const availableTabs = ["overview", "communication", "notes", "quote", "next_actions"];
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
      onAddCommunicationNote(noteButton.getAttribute("data-add-communication-note"), textarea?.value || "");
    });
  }

  const followUpButton = container.querySelector("[data-set-follow-up]");
  if (followUpButton) {
    followUpButton.addEventListener("click", () => {
      const input = container.querySelector("[data-follow-up-input]");
      onSetNextFollowUp(followUpButton.getAttribute("data-set-follow-up"), input?.value || "");
    });
  }

  bindContactActions(container, {
    onApproveContact,
    onMarkBadContact,
    onCopyContactEmail,
    onCopyContactPhone,
  });
}

function renderCompanyTable(companies, scanner, selectedCompanyId) {
  return `
    <div class="table-shell">
      <table class="results-table">
        <thead>
          <tr>
            <th>Prospect</th>
            <th>Location</th>
            <th>Opportunity Score</th>
            <th>Contact Details</th>
            <th>Review</th>
            <th>Last Scanned</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${companies
            .map((company) => renderCompanyRow(company, scanner.getState(company.id), selectedCompanyId))
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCompanyRow(company, scanState, selectedCompanyId) {
  const bestContact = company.primary_contact || null;
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";
  const confidence = Number(bestContact?.confidence_score || company.confidence_score || 0);
  const leadScore = Number(company.lead_score || 0);

  return `
    <tr class="${company.id === selectedCompanyId ? "selected" : ""}">
      <td>
        <button class="row-link" type="button" data-open-details="${escapeAttribute(company.id)}">
          <span class="row-title">${escapeHtml(company.name || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(company.website ? stripProtocol(company.website) : "NA")}</span>
          <span class="row-subtitle">Website Status: ${escapeHtml(company.websiteStatus || "Unknown")}</span>
          <span class="row-subtitle">Mobile App Status: ${escapeHtml(company.mobileAppStatus || "Unknown")}</span>
          ${company.bookingPlatform ? `<span class="row-subtitle">Booking Platform: ${escapeHtml(company.bookingPlatform)}</span>` : ""}
          <span class="row-subtitle">Status: ${escapeHtml(getProspectStage(company))}</span>
          <span class="row-subtitle">Next Follow-up: ${escapeHtml(company.next_follow_up || "Not scheduled")}</span>
          <span class="row-subtitle">${escapeHtml(company.phone || "No business phone")}</span>
        </button>
      </td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(company.industry || company.keyword || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(formatSource(company.source))}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span class="quality-pill ${escapeAttribute(getLeadBadgeClass(company.lead_label))}">${escapeHtml(company.lead_label || "Needs Review")}</span>
          <span class="row-subtitle">${escapeHtml(String(leadScore))}/100</span>
          <span class="row-subtitle">${company.outreach_ready ? "Outreach ready" : "Not outreach ready"}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(bestContact?.name || company.phone || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(bestContact?.title || "No verified public person")}</span>
          <span class="row-subtitle">${escapeHtml(bestContact?.email || bestContact?.phone || "No usable contact")}</span>
          <span>${renderEmailStatusBadge(bestContact)}</span>
        </div>
      </td>
      <td><span class="status-pill ${escapeAttribute(getReviewStatusClass(company.review_status))}"><span class="status-dot"></span>${escapeHtml(formatReviewStatus(company.review_status))}</span></td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(formatDate(company.last_scanned))}</span>
          <span class="status-pill ${statusMeta.cssClass}"><span class="status-dot"></span>${escapeHtml(statusMeta.label)}</span>
        </div>
      </td>
      <td>
        <div class="table-actions">
          <button class="secondary-btn" type="button" data-open-details="${escapeAttribute(company.id)}">Open</button>
          <button class="secondary-btn" type="button" data-scan-company="${escapeAttribute(company.id)}">
            ${scanState.status === SCAN_STATUS.SCANNING ? "Scanning..." : "Deep Scan"}
          </button>
          ${
            failureReason
              ? `<button class="secondary-btn" type="button" data-retry-scan="${escapeAttribute(company.id)}">Retry</button>`
              : ""
          }
        </div>
        ${failureReason ? `<span class="row-subtitle failure-note">${escapeHtml(formatFailureReason(failureReason))}</span>` : ""}
      </td>
    </tr>
  `;
}

function renderCompanyGridCard(company, scanState, selectedCompanyId) {
  const bestContact = company.primary_contact || null;
  const confidence = Number(company.lead_score || bestContact?.confidence_score || company.confidence_score || 0);
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";

  return `
    <article class="company-grid-card ${company.id === selectedCompanyId ? "selected" : ""}">
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
  if (activeTab === "communication") {
    return `
      <section class="workflow-card">
        <p class="detail-section-title">Communication Note</p>
        <textarea class="workflow-textarea" data-communication-note-input rows="4" placeholder="Call outcome, message sent, objection, or next step"></textarea>
        <div class="workflow-actions">
          <button class="primary-btn" type="button" data-add-communication-note="${escapeAttribute(company.id)}">Add Note</button>
        </div>
      </section>
      ${renderCommunicationNotes(company)}
      ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("NA - no verified public contact person found after deep website scan.")}
      <div class="detail-section">
        <p class="detail-section-title">Contact Details</p>
        ${
          company.contacts?.length
            ? `
              <div class="contact-list-wrap">
                ${primaryContact ? `<div class="contact-list-block"><p class="contact-list-heading">Primary contact</p>${renderContactListItem(primaryContact, true)}</div>` : ""}
                ${
                  otherContacts.length
                    ? `<div class="contact-list-block"><p class="contact-list-heading">Other contacts</p><div class="other-contact-list">${otherContacts.map((contact) => renderContactListItem(contact)).join("")}</div></div>`
                    : ""
                }
              </div>
            `
            : renderNaPanel("NA - no public contacts found yet.")
        }
      </div>
    `;
  }

  if (activeTab === "notes") {
    return `
      ${renderCommunicationNotes(company)}
      <div class="overview-card">
        <span class="overview-label">Private context</span>
        <strong>${escapeHtml((company.lead_reasons || []).join(", ") || "No notes captured yet")}</strong>
      </div>
    `;
  }

  if (activeTab === "quote") {
    return `
      <div class="overview-grid">
        <div class="overview-card">
          <span class="overview-label">Quote status</span>
          <strong>Placeholder - no quote has been created.</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">Client storage</span>
          <strong>Credentials, documents, and payment storage are not built yet.</strong>
        </div>
      </div>
      ${renderConversionPlaceholder(company)}
    `;
  }

  if (activeTab === "next_actions") {
    return `
      <div class="activity-list">
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Current stage</p>
            <strong>${escapeHtml(getProspectStage(company))}</strong>
          </div>
        </div>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Next follow-up</p>
            <strong>${escapeHtml(company.next_follow_up || "Not scheduled")}</strong>
          </div>
        </div>
        <section class="workflow-card">
          <p class="detail-section-title">Set Next Follow-up</p>
          <div class="workflow-inline">
            <label class="inline-field">
              <span>Date</span>
              <input type="date" value="${escapeAttribute(company.next_follow_up || "")}" data-follow-up-input />
            </label>
            <button class="primary-btn" type="button" data-set-follow-up="${escapeAttribute(company.id)}">Set Follow-up</button>
          </div>
        </section>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Suggested next action</p>
            <strong>${escapeHtml(getSuggestedNextAction(company))}</strong>
          </div>
        </div>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Stage options</p>
            <strong>${escapeHtml(PROSPECT_STAGES.join(", "))}</strong>
          </div>
        </div>
        ${renderConversionPlaceholder(company)}
      </div>
    `;
  }

  const sourceUrls = dedupe(
    [company.source_url, ...(company.contacts || []).map((contact) => contact.source_url)].filter(Boolean)
  );

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

function renderCommunicationNotes(company) {
  const notes = Array.isArray(company.communication_notes) ? company.communication_notes : [];

  if (!notes.length) {
    return renderNaPanel("No communication notes saved yet.");
  }

  return `
    <section class="workflow-card">
      <p class="detail-section-title">Communication History</p>
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

function renderConversionPlaceholder(company) {
  const stage = getProspectStage(company);

  if (!CONVERTIBLE_STAGES.has(stage)) {
    return `
      <div class="overview-card">
        <span class="overview-label">Convert to Client</span>
        <strong>Available only for Contract Expected or Contract Received.</strong>
      </div>
    `;
  }

  return `
    <div class="overview-card">
      <span class="overview-label">Convert to Client</span>
      <strong>Placeholder only - credential, document, and payment storage will be added later.</strong>
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
