import { getScanStatusMeta, SCAN_STATUS } from "./scanner.js";

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
  onApproveContact,
  onMarkBadContact,
  onCopyContactEmail,
  onCopyContactPhone,
}) {
  if (!company) {
    container.innerHTML = `
      <div class="detail-empty">
        <p class="detail-empty-eyebrow">Company details</p>
        <h2>Select a company</h2>
        <p>Choose a company from the results table to review company information and all public contacts found.</p>
      </div>
    `;
    return;
  }

  const contacts = Array.isArray(company.contacts) ? company.contacts : [];
  const primaryContact = company.primary_contact || null;
  const otherContacts = contacts.filter((contact) => !isSameContact(contact, primaryContact));
  const isSaved = Array.isArray(savedCompanies) && savedCompanies.includes(company.id);
  const availableTabs = ["overview", "contacts", "sources", "activity"];
  const selectedTab = availableTabs.includes(activeTab) ? activeTab : "overview";
  const statusMeta = getScanStatusMeta(company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = company.scan_failure_reason || "";

  container.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-eyebrow">Company profile</p>
        <h2 id="detail-modal-title">${escapeHtml(company.name || "NA")}</h2>
        <p class="detail-location">${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</p>
      </div>
      <span class="status-pill ${statusMeta.cssClass}">
        <span class="status-dot"></span>
        ${escapeHtml(statusMeta.label)}
      </span>
    </div>

    <div class="detail-tag-row">
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
      <button class="secondary-btn" type="button" data-save-company="${escapeAttribute(company.id)}">${isSaved ? "Saved" : "Save"}</button>
    </div>

    <div class="detail-tabs">
      ${availableTabs
        .map(
          (tab) => `
            <button class="detail-tab ${selectedTab === tab ? "active" : ""}" type="button" data-detail-tab="${tab}">
              ${escapeHtml(titleCase(tab))}
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
            <th>Company</th>
            <th>Location</th>
            <th>Contacts</th>
            <th>Best Contact</th>
            <th>Confidence</th>
            <th>Status</th>
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

  return `
    <tr class="${company.id === selectedCompanyId ? "selected" : ""}">
      <td>
        <button class="row-link" type="button" data-open-details="${escapeAttribute(company.id)}">
          <span class="row-title">${escapeHtml(company.name || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(company.website ? stripProtocol(company.website) : "NA")}</span>
        </button>
      </td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(company.industry || "NA")}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(String(company.contacts_found || 0))}</span>
          <span class="row-subtitle">${company.has_primary_contact ? "Primary available" : "No primary"}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span>${escapeHtml(bestContact?.name || "NA")}</span>
          <span class="row-subtitle">${escapeHtml(bestContact?.title || "No verified public person")}</span>
        </div>
      </td>
      <td><span class="quality-pill ${escapeAttribute(getConfidenceBadgeClass(confidence))}">${escapeHtml(formatConfidenceBadge(confidence))}</span></td>
      <td><span class="status-pill ${statusMeta.cssClass}"><span class="status-dot"></span>${escapeHtml(statusMeta.label)}</span></td>
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
  const confidence = Number(bestContact?.confidence_score || company.confidence_score || 0);
  const statusMeta = getScanStatusMeta(scanState.status || company.scan_status || SCAN_STATUS.NOT_SCANNED);
  const failureReason = scanState.failureReason || company.scan_failure_reason || "";

  return `
    <article class="company-grid-card ${company.id === selectedCompanyId ? "selected" : ""}">
      <div class="company-grid-top">
        <div>
          <h3>${escapeHtml(company.name || "NA")}</h3>
          <p>${escapeHtml(company.city || "NA")}, ${escapeHtml(company.state || "NA")}</p>
        </div>
        <span class="quality-pill ${escapeAttribute(getConfidenceBadgeClass(confidence))}">${escapeHtml(formatConfidenceBadge(confidence))}</span>
      </div>
      <div class="company-grid-meta">
        <span>${escapeHtml(company.industry || "NA")}</span>
        <span>${escapeHtml(String(company.contacts_found || 0))} contacts</span>
        <span>${escapeHtml(bestContact?.name || "No best contact")}</span>
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
  if (activeTab === "contacts") {
    return `
      ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("NA - no verified public contact person found after deep website scan.")}
      <div class="detail-section">
        <p class="detail-section-title">All found contacts</p>
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

  if (activeTab === "sources") {
    const sourceUrls = dedupe(
      [company.source_url, ...(company.contacts || []).map((contact) => contact.source_url)].filter(Boolean)
    );

    return `
      <div class="detail-section">
        <p class="detail-section-title">Source details</p>
        <div class="source-list">
          <div class="source-item">
            <span class="source-label">Company source</span>
            <a class="link" href="${escapeAttribute(company.source_url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(company.source_url || "NA"))}</a>
          </div>
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
      </div>
    `;
  }

  if (activeTab === "activity") {
    return `
      <div class="activity-list">
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Last scanned</p>
            <strong>${escapeHtml(formatDate(company.last_scanned))}</strong>
          </div>
        </div>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Contacts found</p>
            <strong>${escapeHtml(String(company.contacts_found || 0))}</strong>
          </div>
        </div>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Collection source</p>
            <strong>${escapeHtml(formatSource(company.source))}</strong>
          </div>
        </div>
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <p>Failure reason</p>
            <strong>${escapeHtml(formatFailureReason(company.scan_failure_reason || ""))}</strong>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="overview-grid">
      <div class="overview-card">
        <span class="overview-label">Address</span>
        <strong>${escapeHtml(company.address || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Website</span>
        ${
          company.website
            ? `<a class="link" href="${escapeAttribute(company.website)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(company.website))}</a>`
            : "<strong>NA</strong>"
        }
      </div>
      <div class="overview-card">
        <span class="overview-label">Phone</span>
        <strong>${escapeHtml(company.phone || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Source</span>
        <strong>${escapeHtml(formatSource(company.source))}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Best contact</span>
        <strong>${escapeHtml(primaryContact?.name || "NA")}</strong>
      </div>
      <div class="overview-card">
        <span class="overview-label">Confidence</span>
        <strong>${escapeHtml(primaryContact?.confidence_score ? String(primaryContact.confidence_score) : "NA")}</strong>
      </div>
    </div>
    ${primaryContact ? renderBestContactCard(primaryContact) : renderNaPanel("NA - no verified public contact person found after deep website scan.")}
  `;
}

function renderBestContactCard(contact) {
  return `
    <section class="best-contact-card">
      <div class="best-contact-header">
        <div>
          <p class="detail-section-title">Best Contact</p>
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

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
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
