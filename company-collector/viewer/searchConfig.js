export const SEARCH_MODES = {
  client_acquisition: {
    label: "Client Acquisition",
    resultLabel: "Best Prospect",
    recordPurpose: "client_acquisition",
  },
  marketing_leads: {
    label: "Marketing Leads",
    resultLabel: "Marketing Lead",
    recordPurpose: "marketing",
  },
  vendor_supply: {
    label: "Vendor / Supply Search",
    resultLabel: "Potential Vendor",
    recordPurpose: "vendor_research",
  },
  staffing_consulting: {
    label: "Staffing / Consulting Research",
    resultLabel: "Company Match",
    recordPurpose: "staffing_research",
  },
  local_research: {
    label: "Local Business Research",
    resultLabel: "Business Record",
    recordPurpose: "local_research",
  },
};

export const DEFAULT_SEARCH_MODE = "client_acquisition";

export const BUSINESS_TYPE_GROUPS = {
  "Beauty & Wellness": {
    query: "local beauty wellness services",
    tags: ["Beauty & Wellness", "Local Services"],
    types: {
      Salon: {
        searchKeywords: ["salon", "hair salon", "beauty salon"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Hair Salon": {
        searchKeywords: ["hair salon", "hair stylist", "beauty salon"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Nail Salon": {
        searchKeywords: ["nail salon", "manicure", "pedicure"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      Barbershop: {
        searchKeywords: ["barbershop", "barber", "men's grooming"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Lash Studio": {
        searchKeywords: ["lash studio", "eyelash extensions", "lashes"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Brow Studio": {
        searchKeywords: ["brow studio", "eyebrow threading", "brow waxing"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      Spa: {
        searchKeywords: ["spa", "day spa", "facial spa"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Med Spa": {
        searchKeywords: ["med spa", "medical spa", "aesthetics"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Massage Studio": {
        searchKeywords: ["massage studio", "massage therapy", "massage"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
      "Skin Care Clinic": {
        searchKeywords: ["skin care clinic", "esthetician", "facial clinic"],
        defaultWebsiteCondition: "no_website",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "client_acquisition",
        usefulFor: ["client_acquisition", "marketing"],
      },
    },
  },
  "Home Services": {
    query: "home services contractor local service business",
    tags: ["Home Services", "Local Contractor"],
    types: {
      Construction: keywords(["construction", "construction contractor", "building contractor"]),
      Plumber: keywords(["plumber", "plumbing contractor", "plumbing company"]),
      Painter: keywords(["painter", "painting contractor", "painting company"]),
      Roofing: keywords(["roofing", "roofer", "roofing contractor"]),
      "Cleaning Company": {
        ...keywords(["cleaning company", "commercial cleaning", "house cleaning"]),
        defaultBookingSystemCondition: "no_booking",
        usefulFor: ["client_acquisition", "vendor_research", "supply"],
      },
      Landscaping: keywords(["landscaping", "lawn care", "landscape contractor"]),
      HVAC: keywords(["HVAC", "heating and cooling", "air conditioning contractor"]),
      Electrician: keywords(["electrician", "electrical contractor", "electrical services"]),
      Flooring: keywords(["flooring", "flooring contractor", "floor installation"]),
      Handyman: keywords(["handyman", "home repair", "repair services"]),
    },
  },
  "Professional Services": {
    query: "professional services local business consulting",
    tags: ["Professional Services", "Business Services"],
    types: {
      "IT Staffing": {
        searchKeywords: ["IT staffing", "staffing agency", "recruiting agency"],
        defaultWebsiteCondition: "",
        defaultMobileAppCondition: "",
        defaultBookingSystemCondition: "",
        recommendedSearchMode: "staffing_consulting",
        usefulFor: ["vendor_research", "marketing", "client_acquisition"],
      },
      "Staffing Agency": keywords(["staffing agency", "employment agency", "recruiting agency"], "staffing_consulting"),
      "Recruiting Agency": keywords(["recruiting agency", "recruiter", "talent agency"], "staffing_consulting"),
      "Consulting Firm": keywords(["consulting firm", "business consulting", "management consulting"], "staffing_consulting"),
      "HR Consulting": keywords(["HR consulting", "human resources consulting", "HR consultant"], "staffing_consulting"),
      "Software Consulting": keywords(["software consulting", "software consultant", "IT consulting"], "staffing_consulting"),
      "Accounting Firm": keywords(["accounting firm", "CPA", "bookkeeping service"]),
      "Law Firm": keywords(["law firm", "attorney", "legal services"]),
      "Marketing Agency": keywords(["marketing agency", "digital marketing", "advertising agency"], "marketing_leads"),
    },
  },
  "Restaurants & Food": {
    query: "restaurants food local business",
    tags: ["Restaurants & Food", "Local Food"],
    types: {
      Restaurant: keywords(["restaurant", "local restaurant", "dining"]),
      Cafe: keywords(["cafe", "coffee shop", "coffee house"]),
      Bakery: keywords(["bakery", "bakeshop", "pastry shop"]),
      Catering: keywords(["catering", "catering company", "event catering"]),
      "Food Truck": keywords(["food truck", "mobile food", "street food"]),
    },
  },
  Healthcare: {
    query: "healthcare clinic local medical services",
    tags: ["Healthcare", "Local Clinic"],
    types: {
      "Dental Clinic": keywords(["dental clinic", "dentist", "dental office"]),
      "Chiropractic Clinic": keywords(["chiropractic clinic", "chiropractor", "chiropractic office"]),
      "Physical Therapy": keywords(["physical therapy", "physical therapist", "rehab clinic"]),
      "Urgent Care": keywords(["urgent care", "walk-in clinic", "medical clinic"]),
      "Medical Clinic": keywords(["medical clinic", "doctor office", "family clinic"]),
    },
  },
  "Retail & Local Shops": {
    query: "retail local shop service business",
    tags: ["Retail & Local Shops", "Main Street Business"],
    types: {
      Boutique: keywords(["boutique", "clothing boutique", "fashion boutique"]),
      "Printing Company": keywords(["printing company", "print shop", "printing services"]),
      "Auto Repair": keywords(["auto repair", "mechanic", "auto service"]),
      Daycare: keywords(["daycare", "childcare", "preschool"]),
      "Fitness Studio": keywords(["fitness studio", "gym", "personal training"]),
      "Pet Grooming": keywords(["pet grooming", "dog grooming", "pet groomer"]),
    },
  },
  "Real Estate & Property": {
    query: "real estate property professional services",
    tags: ["Real Estate & Property", "Professional Services"],
    types: {
      "Real Estate Agency": keywords(["real estate agency", "realtor", "real estate office"], "marketing_leads"),
      "Property Management": keywords(["property management", "property manager", "rental management"], "vendor_supply"),
      "Mortgage Broker": keywords(["mortgage broker", "mortgage lender", "home loans"], "marketing_leads"),
      "Insurance Agency": keywords(["insurance agency", "insurance broker", "local insurance"], "marketing_leads"),
    },
  },
};

export const QUICK_PRESETS = [
  ["Beauty & Wellness", "Salon"],
  ["Home Services", "Cleaning Company"],
  ["Professional Services", "IT Staffing"],
  ["Home Services", "Plumber"],
  ["Home Services", "HVAC"],
  ["Professional Services", "Marketing Agency"],
  ["Restaurants & Food", "Restaurant"],
  ["Healthcare", "Dental Clinic"],
  ["Retail & Local Shops", "Auto Repair"],
  ["Real Estate & Property", "Property Management"],
];

function keywords(searchKeywords, recommendedSearchMode = "client_acquisition") {
  return {
    searchKeywords,
    defaultWebsiteCondition: recommendedSearchMode === "staffing_consulting" ? "" : "no_website",
    defaultMobileAppCondition: "",
    defaultBookingSystemCondition: "",
    recommendedSearchMode,
    usefulFor: ["client_acquisition", "marketing", "vendor_research"],
  };
}

export function getBusinessTypePreset(group, type) {
  return BUSINESS_TYPE_GROUPS[group]?.types?.[type] || null;
}

export function getSearchMode(mode) {
  return SEARCH_MODES[mode] || SEARCH_MODES[DEFAULT_SEARCH_MODE];
}

export function getModeSpecificResultLabel(mode) {
  return getSearchMode(mode).resultLabel;
}

export function getDefaultFiltersForSearchMode(mode) {
  const normalizedMode = getSearchMode(mode);
  return {
    searchMode: Object.keys(SEARCH_MODES).find((key) => SEARCH_MODES[key] === normalizedMode) || DEFAULT_SEARCH_MODE,
  };
}

export function getDefaultFiltersForBusinessType(group, type) {
  const preset = getBusinessTypePreset(group, type);
  if (!preset) {
    return {};
  }

  return {
    searchMode: preset.recommendedSearchMode || DEFAULT_SEARCH_MODE,
    websiteCondition: preset.defaultWebsiteCondition || "",
    mobileAppCondition: preset.defaultMobileAppCondition || "",
    bookingSystemCondition: preset.defaultBookingSystemCondition || "",
  };
}
