import { mockContactsByCompanyId } from "../data/mockData.js";

/**
 * @param {string} companyId
 */
export async function scanCompanyWebsite(companyId) {
  await delay(500);

  return {
    contacts: (mockContactsByCompanyId[companyId] || []).map((contact) => ({ ...contact })),
    summary:
      "Mock AI extraction reviewed public-facing pages and surfaced likely business contacts, emails, and phone numbers.",
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
