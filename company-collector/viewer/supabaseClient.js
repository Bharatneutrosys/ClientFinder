const DEFAULT_STORAGE_MODE = "localStorage";
const STORAGE_MODE_KEY = "CLIENT_FINDER_STORAGE_MODE";

function getRuntimeConfig() {
  return globalThis.CLIENT_FINDER_CONFIG && typeof globalThis.CLIENT_FINDER_CONFIG === "object"
    ? globalThis.CLIENT_FINDER_CONFIG
    : {};
}

function readConfigValue(key) {
  const config = getRuntimeConfig();
  const value = config[key] || config[key.toLowerCase()] || "";
  return String(value || "").trim();
}

export function getSupabaseConfig() {
  return {
    url: readConfigValue("SUPABASE_URL"),
    anonKey: readConfigValue("SUPABASE_ANON_KEY"),
  };
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export function getConfiguredStorageMode() {
  const configMode = readConfigValue(STORAGE_MODE_KEY);
  const localOverride = globalThis.localStorage?.getItem?.(STORAGE_MODE_KEY) || "";
  const mode = String(configMode || localOverride || DEFAULT_STORAGE_MODE).trim();
  return ["localStorage", "supabase", "hybrid"].includes(mode) ? mode : DEFAULT_STORAGE_MODE;
}

export function getActiveStorageMode() {
  const configuredMode = getConfiguredStorageMode();
  if ((configuredMode === "supabase" || configuredMode === "hybrid") && !isSupabaseConfigured()) {
    return DEFAULT_STORAGE_MODE;
  }

  return configuredMode;
}

export function createSupabaseClientPlaceholder() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return {
    configured: true,
    mode: "placeholder",
  };
}

export function getStorageStatus() {
  return {
    configuredMode: getConfiguredStorageMode(),
    activeMode: getActiveStorageMode(),
    supabaseConfigured: isSupabaseConfigured(),
  };
}
