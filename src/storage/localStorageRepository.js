const SEARCH_RESULTS_KEY = "consultancy-finder-search-results";
const SCAN_RESULTS_KEY = "consultancy-finder-scan-results";

export function saveSearchResults(companies) {
  writeJson(SEARCH_RESULTS_KEY, companies);
}

export function loadSearchResults() {
  return readJson(SEARCH_RESULTS_KEY, []);
}

export function saveScanResult(companyId, scanResult) {
  const existing = readJson(SCAN_RESULTS_KEY, {});
  existing[companyId] = scanResult;
  writeJson(SCAN_RESULTS_KEY, existing);
}

export function loadScanResult(companyId) {
  const scans = readJson(SCAN_RESULTS_KEY, {});
  return scans[companyId] || null;
}

function readJson(key, fallbackValue) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Unable to save ${key}`, error);
  }
}
