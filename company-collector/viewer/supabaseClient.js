const DEFAULT_STORAGE_MODE = "localStorage";
const STORAGE_MODE_KEY = "CLIENT_FINDER_STORAGE_MODE";
const DEFAULT_ORG_ID_KEY = "CLIENT_FINDER_DEFAULT_ORG_ID";
const DEFAULT_USER_ID_KEY = "CLIENT_FINDER_DEFAULT_USER_ID";

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
    defaultOrganizationId:
      readConfigValue(DEFAULT_ORG_ID_KEY) || "00000000-0000-4000-8000-000000000001",
    defaultUserId: readConfigValue(DEFAULT_USER_ID_KEY),
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

export async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const url = `${config.url.replace(/\/+$/, "")}/rest/v1/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || payload?.hint || `Supabase request failed (${response.status})`);
  }

  return payload;
}

export function getStorageStatus() {
  const supabaseStatus = getSupabaseStatus();
  return {
    configuredMode: getConfiguredStorageMode(),
    activeMode: getActiveStorageMode(),
    supabaseConfigured: supabaseStatus.configured,
    reason: supabaseStatus.reason,
  };
}

export function getSupabaseStatus() {
  const config = getSupabaseConfig();
  const missing = [];
  if (!config.url) {
    missing.push("SUPABASE_URL");
  }
  if (!config.anonKey) {
    missing.push("SUPABASE_ANON_KEY");
  }

  const configured = missing.length === 0;
  return {
    configured,
    storageMode: getActiveStorageMode(),
    configuredStorageMode: getConfiguredStorageMode(),
    defaultOrganizationId: config.defaultOrganizationId,
    reason: configured ? "Supabase URL and anon key are configured." : `Missing ${missing.join(" and ")}.`,
  };
}
