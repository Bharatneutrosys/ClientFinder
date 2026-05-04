import { mockCompanies } from "../data/mockData.js";

/**
 * @param {{ keyword: string, city: string, state: string }} filters
 */
export async function searchCompanies(filters) {
  const normalized = {
    keyword: filters.keyword.trim().toLowerCase(),
    city: filters.city.trim().toLowerCase(),
    state: filters.state.trim().toLowerCase(),
  };

  const results = mockCompanies.filter((company) => {
    const matchesKeyword =
      !normalized.keyword ||
      company.keyword.toLowerCase().includes(normalized.keyword) ||
      company.name.toLowerCase().includes(normalized.keyword);
    const matchesCity = !normalized.city || company.city.toLowerCase().includes(normalized.city);
    const matchesState = !normalized.state || company.state.toLowerCase() === normalized.state;

    return matchesKeyword && matchesCity && matchesState;
  });

  await delay(350);

  return results.map((company) => ({ ...company }));
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
