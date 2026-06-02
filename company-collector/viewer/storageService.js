import { createSupabaseClientPlaceholder, getStorageStatus } from "./supabaseClient.js";

export const STORAGE_KEYS = {
  savedSearches: "find-any-company.saved-searches",
  savedCompanies: "find-any-company.saved-companies",
  prospectWorkflows: "find-any-company.prospect-workflows",
  clients: "find-any-company.clients",
  manualProspects: "find-any-company.manual-prospects",
  hiddenProspects: "find-any-company.hidden-prospects",
  senderProfile: "find-any-company.sender-profile",
};

function readLocalJson(key, fallbackValue) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return JSON.parse(raw || JSON.stringify(fallbackValue));
  } catch {
    return fallbackValue;
  }
}

function writeLocalJson(key, value) {
  globalThis.localStorage?.setItem(key, JSON.stringify(value));
}

const localStorageStorageService = {
  readJson: readLocalJson,
  writeJson: writeLocalJson,
  getSavedProspects() {
    return readLocalJson(STORAGE_KEYS.savedCompanies, []);
  },
  saveProspect(prospectId) {
    const saved = new Set(this.getSavedProspects().filter(Boolean));
    saved.add(prospectId);
    writeLocalJson(STORAGE_KEYS.savedCompanies, [...saved]);
  },
  updateSavedProspect(prospectId, updates = {}) {
    const workflows = readLocalJson(STORAGE_KEYS.prospectWorkflows, {});
    writeLocalJson(STORAGE_KEYS.prospectWorkflows, {
      ...workflows,
      [prospectId]: {
        ...(workflows[prospectId] || {}),
        ...updates,
        updated_at: new Date().toISOString(),
      },
    });
  },
  getClients() {
    return readLocalJson(STORAGE_KEYS.clients, []);
  },
  saveClient(client) {
    const clients = this.getClients();
    const nextClients = clients.some((item) => item.clientId === client.clientId)
      ? clients.map((item) => (item.clientId === client.clientId ? client : item))
      : [client, ...clients];
    writeLocalJson(STORAGE_KEYS.clients, nextClients);
  },
  updateClient(clientId, updates = {}) {
    const clients = this.getClients().map((client) =>
      client.clientId === clientId ? { ...client, ...updates, updatedAt: new Date().toISOString() } : client
    );
    writeLocalJson(STORAGE_KEYS.clients, clients);
  },
  addActivity(targetType, targetId, activity = {}) {
    if (targetType === "client") {
      const clients = this.getClients().map((client) =>
        client.clientId === targetId
          ? {
              ...client,
              activity: [
                {
                  id: activity.id || `client-activity-${Date.now()}`,
                  createdAt: activity.createdAt || new Date().toISOString(),
                  message: activity.message || "Activity added",
                  source: activity.source || "Storage",
                },
                ...(Array.isArray(client.activity) ? client.activity : []),
              ].slice(0, 50),
              updatedAt: new Date().toISOString(),
            }
          : client
      );
      writeLocalJson(STORAGE_KEYS.clients, clients);
      return;
    }

    if (targetType === "prospect") {
      this.updateSavedProspect(targetId, {
        activity_log: [
          {
            id: activity.id || `activity-${Date.now()}`,
            created_at: activity.createdAt || new Date().toISOString(),
            message: activity.message || "Activity added",
            source: activity.source || "Storage",
          },
          ...(readLocalJson(STORAGE_KEYS.prospectWorkflows, {})[targetId]?.activity_log || []),
        ].slice(0, 50),
      });
    }
  },
  getSettings() {
    return {
      senderProfile: readLocalJson(STORAGE_KEYS.senderProfile, null),
      savedSearches: readLocalJson(STORAGE_KEYS.savedSearches, []),
    };
  },
  saveSettings(settings = {}) {
    if ("senderProfile" in settings) {
      writeLocalJson(STORAGE_KEYS.senderProfile, settings.senderProfile);
    }
    if ("savedSearches" in settings) {
      writeLocalJson(STORAGE_KEYS.savedSearches, settings.savedSearches);
    }
  },
  getStatus() {
    return getStorageStatus();
  },
};

const supabaseStorageService = {
  ...localStorageStorageService,
  supabase: createSupabaseClientPlaceholder(),
  getStatus() {
    return getStorageStatus();
  },
};

export function createStorageService() {
  const status = getStorageStatus();
  if (status.activeMode === "localStorage") {
    return localStorageStorageService;
  }

  return supabaseStorageService;
}

export const storageService = createStorageService();
