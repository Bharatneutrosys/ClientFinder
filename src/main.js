import { schemas } from "./models/schema.js";
import { searchCompanies } from "./providers/mockSearchProvider.js";
import { scanCompanyWebsite } from "./services/mockAiExtractionService.js";
import {
  loadScanResult,
  loadSearchResults,
  saveScanResult,
  saveSearchResults,
} from "./storage/localStorageRepository.js";

const form = document.querySelector("#search-form");
const resultsBody = document.querySelector("#results-body");
const resultsSummary = document.querySelector("#results-summary");
const detailsTemplate = document.querySelector("#contact-panel-template");

const state = {
  companies: hydrateCompanies(loadSearchResults()),
  expandedCompanyId: null,
  scanCache: {},
};

window.__CONSULTANCY_FINDER_SCHEMAS__ = schemas;

if (state.companies.length > 0) {
  renderResults(state.companies);
  updateSummary(state.companies.length);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const filters = {
    keyword: String(formData.get("keyword") || ""),
    city: String(formData.get("city") || ""),
    state: String(formData.get("state") || "").toUpperCase(),
  };

  resultsSummary.textContent = "Searching mock provider...";

  const companies = await searchCompanies(filters);
  state.companies = companies;
  state.expandedCompanyId = null;
  saveSearchResults(companies);
  renderResults(companies);
  updateSummary(companies.length);
});

function renderResults(companies) {
  if (companies.length === 0) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          No mock companies matched this search. Try a broader keyword or a different city/state pair.
        </td>
      </tr>
    `;
    return;
  }

  const rows = [];

  companies.forEach((company) => {
    const isExpanded = state.expandedCompanyId === company.id;
    const normalizedStatus = normalizeStatus(company.status);

    rows.push(`
      <tr data-company-row="${company.id}">
        <td class="company-cell">
          <p class="company-name">${escapeHtml(company.name)}</p>
          <p class="company-meta">Source: ${escapeHtml(company.source)}</p>
        </td>
        <td>${escapeHtml(company.city)}</td>
        <td>${escapeHtml(company.state)}</td>
        <td>${escapeHtml(company.address)}</td>
        <td>${escapeHtml(company.phone)}</td>
        <td><a class="link" href="${escapeAttribute(company.website)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(company.website))}</a></td>
        <td>
          <button class="secondary-btn" type="button" data-scan-company="${company.id}">
            ${isExpanded ? "Hide Scan" : "Scan Website"}
          </button>
        </td>
        <td>
          <span class="status-chip ${normalizedStatus.cssClass}">
            <span class="status-dot"></span>
            ${escapeHtml(normalizedStatus.label)}
          </span>
        </td>
      </tr>
    `);

    if (isExpanded) {
      rows.push(renderDetailsRow(company.id, company.name));
    }
  });

  resultsBody.innerHTML = rows.join("");

  resultsBody.querySelectorAll("[data-scan-company]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { scanCompany } = button.dataset;
      await handleScanToggle(scanCompany);
    });
  });
}

function renderDetailsRow(companyId, companyName) {
  const cachedResult = state.scanCache[companyId] || loadScanResult(companyId);
  const fragment = detailsTemplate.content.cloneNode(true);
  const title = fragment.querySelector(".details-title");
  const copy = fragment.querySelector(".details-copy");
  const cards = fragment.querySelector(".contact-cards");

  title.textContent = `${companyName} contact signals`;

  if (!cachedResult) {
    copy.textContent = "Mock website scan has not been run yet for this company.";
    cards.innerHTML = `
      <div class="contact-card">
        <h5>Ready to scan</h5>
        <p class="contact-meta">Click Scan Website to generate mock public contact data for this company.</p>
      </div>
    `;
  } else {
    copy.textContent = cachedResult.summary;
    cards.innerHTML = cachedResult.contacts
      .map(
        (contact) => `
          <article class="contact-card">
            <h5>${escapeHtml(contact.name)}</h5>
            <p>${escapeHtml(contact.title)}</p>
            <p class="contact-meta">${escapeHtml(contact.email)}</p>
            <p class="contact-meta">${escapeHtml(contact.phone)}</p>
            <p class="contact-meta">Verification: ${escapeHtml(contact.verification_status)}</p>
            <p class="contact-meta">Source: <a class="link" href="${escapeAttribute(contact.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(stripProtocol(contact.source_url))}</a></p>
            <p class="contact-meta confidence">Confidence ${(contact.confidence_score * 100).toFixed(0)}%</p>
          </article>
        `
      )
      .join("");
  }

  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);

  return `
    <tr class="details-row" data-details-row="${companyId}">
      <td colspan="8">${wrapper.innerHTML}</td>
    </tr>
  `;
}

async function handleScanToggle(companyId) {
  if (state.expandedCompanyId === companyId && (state.scanCache[companyId] || loadScanResult(companyId))) {
    state.expandedCompanyId = null;
    renderResults(state.companies);
    return;
  }

  state.expandedCompanyId = companyId;
  renderResults(state.companies);

  if (!state.scanCache[companyId] && !loadScanResult(companyId)) {
    resultsSummary.textContent = "Running mock website scan...";
    const scanResult = await scanCompanyWebsite(companyId);
    state.scanCache[companyId] = scanResult;
    saveScanResult(companyId, scanResult);

    state.companies = state.companies.map((company) =>
      company.id === companyId ? { ...company, status: "Scanned" } : company
    );
    saveSearchResults(state.companies);
  }

  renderResults(state.companies);
  updateSummary(state.companies.length);
}

function updateSummary(resultCount) {
  resultsSummary.textContent =
    resultCount > 0
      ? `${resultCount} mock compan${resultCount === 1 ? "y" : "ies"} loaded from the provider layer.`
      : "No mock companies found.";
}

function hydrateCompanies(companies) {
  return companies.map((company) =>
    loadScanResult(company.id) ? { ...company, status: "Scanned" } : company
  );
}

function normalizeStatus(label) {
  const value = label.toLowerCase();

  if (value.includes("scan")) {
    return { label, cssClass: "scanned" };
  }

  if (value.includes("queue")) {
    return { label, cssClass: "queued" };
  }

  return { label, cssClass: "pending" };
}

function stripProtocol(value) {
  return value.replace(/^https?:\/\//, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
