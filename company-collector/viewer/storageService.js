import {
  createSupabaseClientPlaceholder,
  getActiveStorageMode,
  getStorageStatus,
  getSupabaseConfig,
  isSupabaseConfigured,
  supabaseRequest,
} from "./supabaseClient.js";

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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

function getProspectDedupeKey(prospect = {}) {
  const placeId = normalizeText(prospect.placeId || prospect.place_id || prospect.id || "");
  const name = normalizeText(prospect.name || prospect.businessName || "");
  const address = normalizeText(prospect.address || "");
  const phone = normalizePhone(prospect.phone || "");
  const city = normalizeText(prospect.city || "");
  const state = normalizeText(prospect.state || "");

  if (placeId) {
    return `place:${placeId}`;
  }
  if (name && address) {
    return `name-address:${name}|${address}`;
  }
  if (name && phone) {
    return `name-phone:${name}|${phone}`;
  }
  if (name && city && state) {
    return `name-city-state:${name}|${city}|${state}`;
  }
  return "";
}

function getClientDedupeKey(client = {}) {
  const clientId = normalizeText(client.clientId || "");
  const prospectId = normalizeText(client.prospectId || "");
  const dedupeKey = normalizeText(client.dedupeKey || "");
  const businessName = normalizeText(client.businessName || "");
  const address = normalizeText(client.address || "");

  if (clientId) {
    return `client:${clientId}`;
  }
  if (prospectId) {
    return `prospect:${prospectId}`;
  }
  if (dedupeKey) {
    return `dedupe:${dedupeKey}`;
  }
  if (businessName && address) {
    return `name-address:${businessName}|${address}`;
  }
  return "";
}

function getLocalProspectById(prospectId) {
  const manualProspects = readLocalJson(STORAGE_KEYS.manualProspects, []);
  return Array.isArray(manualProspects) ? manualProspects.find((item) => item?.id === prospectId) || null : null;
}

function buildSavedProspectMetadata(prospect = {}, workflow = {}) {
  return {
    appProspectId: prospect.id || workflow.appProspectId || "",
    placeId: prospect.placeId || prospect.place_id || "",
    dedupeKey: getProspectDedupeKey(prospect),
    businessName: prospect.name || prospect.businessName || "",
    businessType: prospect.keyword || prospect.businessType || "",
    businessTypeGroup: prospect.industry || prospect.businessTypeGroup || "",
    address: prospect.address || "",
    city: prospect.city || "",
    state: prospect.state || "",
    phone: prospect.phone || "",
    rating: prospect.rating || "",
    reviewCount: prospect.reviewCount || prospect.reviews || "",
    websiteUrl: prospect.website || prospect.websiteUrl || "",
    websiteStatus: prospect.websiteStatus || "",
    websiteQualityStatus: prospect.websiteQualityStatus || "",
    mobileAppStatus: prospect.mobileAppStatus || "",
    bookingPlatform: prospect.bookingPlatform || "",
    socialPlatform: prospect.socialPlatform || "",
    opportunityScore: prospect.opportunityScore || prospect.lead_score || "",
    opportunityPriority: prospect.opportunityPriority || prospect.lead_label || "",
    scoreReasons: Array.isArray(prospect.scoreReasons) ? prospect.scoreReasons : [],
    reasonChips: Array.isArray(prospect.reasonChips) ? prospect.reasonChips : [],
    currentStage: workflow.currentStage || workflow.prospect_stage || prospect.prospect_stage || prospect.stage || "Saved",
    workflow,
    sourceData: prospect,
  };
}

export function mapProspectToSupabaseRow(prospect = {}, workflow = {}) {
  const config = getSupabaseConfig();
  const dedupeKey = getProspectDedupeKey(prospect) || `app-id:${normalizeText(prospect.id || Date.now())}`;
  return {
    organization_id: config.defaultOrganizationId,
    external_source: prospect.source || prospect.external_source || "client-finder",
    external_id: String(prospect.placeId || prospect.place_id || prospect.id || "").trim() || null,
    dedupe_key: dedupeKey,
    business_name: prospect.name || prospect.businessName || "Unknown prospect",
    business_type: prospect.keyword || prospect.businessType || "",
    phone: prospect.phone || "",
    email: prospect.email || prospect.primary_contact?.email || "",
    website_url: prospect.website || prospect.websiteUrl || "",
    google_profile_url: prospect.source_url || prospect.googleProfileUrl || "",
    maps_url: prospect.mapsUrl || prospect.google_maps_url || "",
    address: prospect.address || "",
    city: prospect.city || "",
    state: prospect.state || "",
    website_status: prospect.websiteStatus || "",
    mobile_app_status: prospect.mobileAppStatus || "",
    review_count: Number(prospect.reviewCount || prospect.reviews || 0) || null,
    rating: Number(prospect.rating || 0) || null,
    opportunity_score: Number(prospect.opportunityScore || prospect.lead_score || 0) || null,
    opportunity_priority: prospect.opportunityPriority || prospect.lead_label || "",
    score_reasons: Array.isArray(prospect.scoreReasons) ? prospect.scoreReasons : [],
    contacts: Array.isArray(prospect.contacts) ? prospect.contacts : [],
    source_data: buildSavedProspectMetadata(prospect, workflow),
    created_by: config.defaultUserId || null,
  };
}

function mapWorkflowToSavedProspectRow(prospectRow, prospect = {}, workflow = {}) {
  const config = getSupabaseConfig();
  return {
    organization_id: config.defaultOrganizationId,
    prospect_id: prospectRow.id,
    saved_by: config.defaultUserId || null,
    current_stage: workflow.currentStage || workflow.prospect_stage || prospect.prospect_stage || prospect.stage || "Saved",
    status: workflow.archived || prospect.archived ? "archived" : "saved",
    priority: workflow.manual_priority || workflow.follow_up_priority || prospect.manual_priority || prospect.follow_up_priority || "",
    archived: Boolean(workflow.archived || prospect.archived),
    archived_at: workflow.archived_at || prospect.archived_at || null,
    workflow_state: buildSavedProspectMetadata(prospect, workflow),
  };
}

export function mapSupabaseRowToProspect(row = {}) {
  const metadata = row.workflow_state || row.prospects?.source_data || {};
  const sourceData = metadata.sourceData || metadata.source_data || row.prospects?.source_data?.sourceData || {};
  const appProspectId =
    metadata.appProspectId || sourceData.id || row.prospects?.external_id || row.prospect_id || row.id || "";
  return {
    id: appProspectId,
    company: {
      ...sourceData,
      id: appProspectId,
      name: sourceData.name || metadata.businessName || row.prospects?.business_name || "Saved prospect",
      keyword: sourceData.keyword || metadata.businessType || row.prospects?.business_type || "",
      industry: sourceData.industry || metadata.businessTypeGroup || "",
      city: sourceData.city || metadata.city || row.prospects?.city || "",
      state: sourceData.state || metadata.state || row.prospects?.state || "",
      address: sourceData.address || metadata.address || row.prospects?.address || "",
      phone: sourceData.phone || metadata.phone || row.prospects?.phone || "",
      website: sourceData.website || metadata.websiteUrl || row.prospects?.website_url || "",
      archived: Boolean(row.archived),
      archived_at: row.archived_at || "",
      is_saved_prospect: true,
    },
    workflow: {
      ...(metadata.workflow || {}),
      currentStage: row.current_stage || metadata.currentStage || "Saved",
      prospect_stage: row.current_stage || metadata.currentStage || "Saved",
      archived: Boolean(row.archived),
      archived_at: row.archived_at || "",
      lastUpdatedAt: row.updated_at || "",
      updated_at: row.updated_at || "",
    },
  };
}

async function upsertSupabaseProspect(prospect = {}, workflow = {}) {
  const row = mapProspectToSupabaseRow(prospect, workflow);
  const rows = await supabaseRequest("prospects?on_conflict=organization_id,dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function upsertSupabaseSavedProspect(prospect = {}, workflow = {}) {
  const prospectRow = await upsertSupabaseProspect(prospect, workflow);
  if (!prospectRow?.id) {
    throw new Error("Supabase prospect upsert did not return an id.");
  }

  const row = mapWorkflowToSavedProspectRow(prospectRow, prospect, workflow);
  const rows = await supabaseRequest("saved_prospects?on_conflict=organization_id,prospect_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function getSavedProspectsFromSupabase() {
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "*,prospects(*)",
    organization_id: `eq.${config.defaultOrganizationId}`,
    order: "updated_at.desc",
  });
  const rows = await supabaseRequest(`saved_prospects?${query.toString()}`);
  return Array.isArray(rows) ? rows.map((row) => mapSupabaseRowToProspect(row)) : [];
}

async function saveProspectToSupabase(prospect = {}, workflow = {}) {
  return upsertSupabaseSavedProspect(prospect, workflow);
}

async function updateSavedProspectInSupabase(prospectId, updates = {}) {
  const workflows = readLocalJson(STORAGE_KEYS.prospectWorkflows, {});
  const prospect = updates.prospect || getLocalProspectById(prospectId) || { id: prospectId };
  const workflow = {
    ...(workflows[prospectId] || {}),
    ...(updates.workflow || updates),
    updated_at: new Date().toISOString(),
  };
  return upsertSupabaseSavedProspect(prospect, workflow);
}

async function setSavedProspectArchiveState(prospect = {}, archived) {
  const workflows = readLocalJson(STORAGE_KEYS.prospectWorkflows, {});
  const prospectId = prospect.id || prospect;
  const workflow = {
    ...(workflows[prospectId] || {}),
    archived,
    archived_at: archived ? new Date().toISOString() : "",
    updated_at: new Date().toISOString(),
  };
  return upsertSupabaseSavedProspect(typeof prospect === "object" ? prospect : { id: prospectId }, workflow);
}

async function removeSavedProspectFromSupabase(prospect = {}) {
  const config = getSupabaseConfig();
  const dedupeKey = getProspectDedupeKey(prospect) || `app-id:${normalizeText(prospect.id || prospect)}`;
  const prospects = await supabaseRequest(
    `prospects?select=id&organization_id=eq.${config.defaultOrganizationId}&dedupe_key=eq.${encodeURIComponent(dedupeKey)}`
  );
  const prospectId = Array.isArray(prospects) ? prospects[0]?.id : "";
  if (!prospectId) {
    return;
  }
  await supabaseRequest(
    `saved_prospects?organization_id=eq.${config.defaultOrganizationId}&prospect_id=eq.${prospectId}`,
    { method: "DELETE" }
  );
}

async function syncLocalSavedProspectsToSupabase(prospectRecords = []) {
  const savedIds = readLocalJson(STORAGE_KEYS.savedCompanies, []);
  const workflows = readLocalJson(STORAGE_KEYS.prospectWorkflows, {});
  const manualProspects = readLocalJson(STORAGE_KEYS.manualProspects, []);
  const results = { total: savedIds.length, synced: 0, failed: 0 };

  for (const savedId of savedIds) {
    try {
      const prospect =
        prospectRecords.find((item) => item?.id === savedId) ||
        manualProspects.find((item) => item?.id === savedId) ||
        { id: savedId };
      await upsertSupabaseSavedProspect(prospect, workflows[savedId] || {});
      results.synced += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
}

function buildClientMetadata(client = {}) {
  return {
    appClientId: client.clientId || "",
    prospectId: client.prospectId || "",
    dedupeKey: client.dedupeKey || getClientDedupeKey(client),
    clientRecord: client,
    projectTracker: client.projectTracker || {},
    onboardingChecklist: client.onboardingChecklist || {},
    handoverChecklist: client.handoverChecklist || {},
    documentChecklist: client.documentChecklist || {},
    documents: Array.isArray(client.documents) ? client.documents : [],
    paymentSummary: client.paymentSummary || {},
    paymentRecords: Array.isArray(client.paymentRecords) ? client.paymentRecords : [],
    accessChecklist: client.accessChecklist || {},
    accessRecords: Array.isArray(client.accessRecords) ? client.accessRecords : [],
    supportPlan: client.supportPlan || {},
    supportRequests: Array.isArray(client.supportRequests) ? client.supportRequests : [],
    activity: Array.isArray(client.activity) ? client.activity : [],
    sourceProspectData: client.sourceProspectData || {},
  };
}

export function mapClientToSupabaseRow(client = {}) {
  const config = getSupabaseConfig();
  const appClientId = client.clientId || `client-${Date.now()}`;
  return {
    organization_id: config.defaultOrganizationId,
    app_client_id: appClientId,
    client_dedupe_key: getClientDedupeKey({ ...client, clientId: appClientId }) || `client:${normalizeText(appClientId)}`,
    created_by: config.defaultUserId || null,
    business_name: client.businessName || "Unknown client",
    business_type: client.businessType || "",
    owner_or_manager_name: client.ownerOrManagerName || "",
    phone: client.phone || "",
    email: client.email || "",
    address: client.address || "",
    city: client.city || "",
    state: client.state || "",
    website_url: client.websiteUrl || "",
    google_profile_url: client.googleProfileUrl || client.mapsUrl || "",
    current_client_status: client.currentClientStatus || "Active Client",
    project_status: client.projectStatus || "Client Onboarding",
    project_type: client.projectType || "",
    package_type: client.packageType || "",
    start_date: client.startDate || null,
    target_launch_date: client.targetLaunchDate || null,
    actual_launch_date: client.actualLaunchDate || null,
    handover_status: client.handoverStatus || "Not Started",
    support_status: client.supportStatus || client.supportPlan?.supportStatus || "Not Started",
    maintenance_plan: client.maintenancePlan || client.supportPlan?.maintenancePlan || "None",
    monthly_support_amount: Number(client.monthlySupportAmount || client.supportPlan?.monthlySupportAmount || 0) || null,
    support_start_date: client.supportStartDate || client.supportPlan?.supportStartDate || null,
    support_end_date: client.supportEndDate || client.supportPlan?.supportEndDate || null,
    renewal_reminder_date: client.renewalReminderDate || client.supportPlan?.renewalReminderDate || null,
    notes: client.notes || "",
    internal_notes: client.internalNotes || "",
    source_prospect_data: buildClientMetadata(client),
  };
}

export function mapSupabaseRowToClient(row = {}) {
  const metadata = row.source_prospect_data || {};
  const clientRecord = metadata.clientRecord || {};
  return {
    ...clientRecord,
    clientId: clientRecord.clientId || row.app_client_id || row.id || "",
    prospectId: clientRecord.prospectId || metadata.prospectId || "",
    dedupeKey: clientRecord.dedupeKey || metadata.dedupeKey || row.client_dedupe_key || "",
    businessName: clientRecord.businessName || row.business_name || "",
    businessType: clientRecord.businessType || row.business_type || "",
    ownerOrManagerName: clientRecord.ownerOrManagerName || row.owner_or_manager_name || "",
    phone: clientRecord.phone || row.phone || "",
    email: clientRecord.email || row.email || "",
    address: clientRecord.address || row.address || "",
    city: clientRecord.city || row.city || "",
    state: clientRecord.state || row.state || "",
    websiteUrl: clientRecord.websiteUrl || row.website_url || "",
    googleProfileUrl: clientRecord.googleProfileUrl || row.google_profile_url || "",
    currentClientStatus: clientRecord.currentClientStatus || row.current_client_status || "Active Client",
    projectStatus: clientRecord.projectStatus || row.project_status || "Client Onboarding",
    projectType: clientRecord.projectType || row.project_type || "",
    packageType: clientRecord.packageType || row.package_type || "",
    startDate: clientRecord.startDate || row.start_date || "",
    targetLaunchDate: clientRecord.targetLaunchDate || row.target_launch_date || "",
    actualLaunchDate: clientRecord.actualLaunchDate || row.actual_launch_date || "",
    handoverStatus: clientRecord.handoverStatus || row.handover_status || "Not Started",
    supportStatus: clientRecord.supportStatus || row.support_status || "Not Started",
    maintenancePlan: clientRecord.maintenancePlan || row.maintenance_plan || "None",
    monthlySupportAmount: clientRecord.monthlySupportAmount || row.monthly_support_amount || "",
    supportStartDate: clientRecord.supportStartDate || row.support_start_date || "",
    supportEndDate: clientRecord.supportEndDate || row.support_end_date || "",
    renewalReminderDate: clientRecord.renewalReminderDate || row.renewal_reminder_date || "",
    notes: clientRecord.notes || row.notes || "",
    internalNotes: clientRecord.internalNotes || row.internal_notes || "",
    sourceProspectData: clientRecord.sourceProspectData || metadata.sourceProspectData || {},
    projectTracker: clientRecord.projectTracker || metadata.projectTracker || {},
    onboardingChecklist: clientRecord.onboardingChecklist || metadata.onboardingChecklist || {},
    handoverChecklist: clientRecord.handoverChecklist || metadata.handoverChecklist || {},
    documentChecklist: clientRecord.documentChecklist || metadata.documentChecklist || {},
    documents: clientRecord.documents || metadata.documents || [],
    paymentSummary: clientRecord.paymentSummary || metadata.paymentSummary || {},
    paymentRecords: clientRecord.paymentRecords || metadata.paymentRecords || [],
    accessChecklist: clientRecord.accessChecklist || metadata.accessChecklist || {},
    accessRecords: clientRecord.accessRecords || metadata.accessRecords || [],
    supportPlan: clientRecord.supportPlan || metadata.supportPlan || {},
    supportRequests: clientRecord.supportRequests || metadata.supportRequests || [],
    activity: clientRecord.activity || metadata.activity || [],
    createdAt: clientRecord.createdAt || row.created_at || "",
    updatedAt: clientRecord.updatedAt || row.updated_at || "",
  };
}

async function getClientsFromSupabase() {
  const config = getSupabaseConfig();
  const query = new URLSearchParams({
    select: "*",
    organization_id: `eq.${config.defaultOrganizationId}`,
    order: "updated_at.desc",
  });
  const rows = await supabaseRequest(`clients?${query.toString()}`);
  return Array.isArray(rows) ? rows.map((row) => mapSupabaseRowToClient(row)) : [];
}

async function saveClientToSupabase(client = {}) {
  const row = mapClientToSupabaseRow(client);
  const rows = await supabaseRequest("clients?on_conflict=organization_id,app_client_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateClientInSupabase(clientId, updates = {}) {
  const clients = readLocalJson(STORAGE_KEYS.clients, []);
  const existing = Array.isArray(clients) ? clients.find((client) => client.clientId === clientId) : null;
  return saveClientToSupabase({
    ...(existing || { clientId }),
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

async function syncLocalClientsToSupabase(clientRecords = []) {
  const clients = clientRecords.length ? clientRecords : readLocalJson(STORAGE_KEYS.clients, []);
  const results = { total: Array.isArray(clients) ? clients.length : 0, synced: 0, failed: 0 };

  for (const client of Array.isArray(clients) ? clients : []) {
    try {
      await saveClientToSupabase(client);
      results.synced += 1;
    } catch {
      results.failed += 1;
    }
  }

  return results;
}

const localStorageStorageService = {
  readJson: readLocalJson,
  writeJson: writeLocalJson,
  getSavedProspectsFromSupabase,
  saveProspectToSupabase,
  updateSavedProspectInSupabase,
  syncLocalSavedProspectsToSupabase,
  getClientsFromSupabase,
  saveClientToSupabase,
  updateClientInSupabase,
  syncLocalClientsToSupabase,
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
  archiveSavedProspect(prospect) {
    const prospectId = typeof prospect === "object" ? prospect.id : prospect;
    this.updateSavedProspect(prospectId, {
      archived: true,
      archived_at: new Date().toISOString(),
    });
  },
  unarchiveSavedProspect(prospect) {
    const prospectId = typeof prospect === "object" ? prospect.id : prospect;
    this.updateSavedProspect(prospectId, {
      archived: false,
      archived_at: "",
    });
  },
  removeSavedProspect(prospect) {
    const savedId = typeof prospect === "object" ? prospect.id : prospect;
    const saved = this.getSavedProspects().filter((id) => id !== savedId);
    writeLocalJson(STORAGE_KEYS.savedCompanies, saved);
  },
  getClients() {
    return readLocalJson(STORAGE_KEYS.clients, []);
  },
  getClientById(clientId) {
    return this.getClients().find((client) => client.clientId === clientId) || null;
  },
  getClientByProspectId(prospectId) {
    return this.getClients().find((client) => client.prospectId === prospectId) || null;
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
  createClientFromProspect(client) {
    this.saveClient(client);
  },
  archiveClient(clientId) {
    this.updateClient(clientId, { currentClientStatus: "Archived", archived: true });
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
  async getSavedProspects() {
    if (!isSupabaseConfigured()) {
      return localStorageStorageService.getSavedProspects();
    }

    try {
      return await getSavedProspectsFromSupabase();
    } catch (error) {
      console.warn("Supabase saved prospect read failed; using localStorage fallback.", error);
      return localStorageStorageService.getSavedProspects();
    }
  },
  async saveProspect(prospect, workflow = {}) {
    localStorageStorageService.saveProspect(typeof prospect === "object" ? prospect.id : prospect);
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      await saveProspectToSupabase(typeof prospect === "object" ? prospect : { id: prospect }, workflow);
    } catch (error) {
      console.warn("Supabase saved prospect write failed; localStorage fallback retained.", error);
    }
  },
  async updateSavedProspect(prospectId, updates = {}) {
    localStorageStorageService.updateSavedProspect(prospectId, updates.workflow || updates);
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      await updateSavedProspectInSupabase(prospectId, updates);
    } catch (error) {
      console.warn("Supabase saved prospect update failed; localStorage fallback retained.", error);
    }
  },
  async archiveSavedProspect(prospect) {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      await setSavedProspectArchiveState(prospect, true);
    } catch (error) {
      console.warn("Supabase saved prospect archive failed; localStorage fallback retained.", error);
    }
  },
  async unarchiveSavedProspect(prospect) {
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      await setSavedProspectArchiveState(prospect, false);
    } catch (error) {
      console.warn("Supabase saved prospect restore failed; localStorage fallback retained.", error);
    }
  },
  async removeSavedProspect(prospect) {
    localStorageStorageService.removeSavedProspect(prospect);
    if (!isSupabaseConfigured()) {
      return;
    }
    try {
      await removeSavedProspectFromSupabase(prospect);
    } catch (error) {
      console.warn("Supabase saved prospect removal failed; localStorage fallback retained.", error);
    }
  },
  async getClients() {
    if (!isSupabaseConfigured()) {
      return localStorageStorageService.getClients();
    }

    try {
      return await getClientsFromSupabase();
    } catch (error) {
      console.warn("Supabase client read failed; using localStorage fallback.", error);
      return localStorageStorageService.getClients();
    }
  },
  async getClientById(clientId) {
    const clients = await this.getClients();
    return clients.find((client) => client.clientId === clientId) || null;
  },
  async getClientByProspectId(prospectId) {
    const clients = await this.getClients();
    return clients.find((client) => client.prospectId === prospectId) || null;
  },
  async saveClient(client) {
    localStorageStorageService.saveClient(client);
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      await saveClientToSupabase(client);
    } catch (error) {
      console.warn("Supabase client write failed; localStorage fallback retained.", error);
    }
  },
  async updateClient(clientId, updates = {}) {
    localStorageStorageService.updateClient(clientId, updates);
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      await updateClientInSupabase(clientId, updates);
    } catch (error) {
      console.warn("Supabase client update failed; localStorage fallback retained.", error);
    }
  },
  async createClientFromProspect(client) {
    await this.saveClient(client);
  },
  async archiveClient(clientId) {
    await this.updateClient(clientId, { currentClientStatus: "Archived", archived: true });
  },
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
export { getActiveStorageMode };
