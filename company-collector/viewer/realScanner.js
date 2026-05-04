export async function scanCompanyWebsiteReal(company) {
  if (!company.website) {
    return {
      contacts: [],
      status: "needs_review",
      message: "No website URL available for scanning.",
      blocked: false,
      failure_reason: "no_website",
    };
  }

  try {
    const response = await fetch("/api/scan-website", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        website: company.website,
        company_name: company.name,
        city: company.city,
        state: company.state,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with ${response.status}`);
    }

    const payload = await response.json();
    const contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
    const scannedUrls = Array.isArray(payload.scanned_urls) ? payload.scanned_urls : [];

    return {
      contacts,
      status: payload.status || (contacts.length > 0 ? "contacts_found" : "needs_review"),
      message:
        payload.error ||
        (contacts.length > 0
          ? `Scanned ${scannedUrls.length || 1} page${scannedUrls.length === 1 ? "" : "s"} and extracted public contact details.`
          : `Scanned ${scannedUrls.length || 1} page${scannedUrls.length === 1 ? "" : "s"} but found no public email addresses or phone numbers.`),
      blocked: !payload.success,
      scanned_urls: scannedUrls,
      failure_reason: inferFailureReason(payload.error, payload.success, contacts.length),
    };
  } catch (error) {
    return {
      contacts: [],
      status: "needs_review",
      message: "Website scan blocked. Use backend scanner later.",
      blocked: true,
      scanned_urls: [],
      failure_reason: inferFailureReason(error.message, false, 0),
    };
  }
}

function inferFailureReason(message, success, contactCount) {
  if (contactCount > 0) {
    return "";
  }

  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("no website")) {
    return "no_website";
  }

  if (normalized.includes("timeout")) {
    return "timeout";
  }

  if (
    normalized.includes("blocked") ||
    normalized.includes("forbidden") ||
    normalized.includes("cors") ||
    normalized.includes("denied")
  ) {
    return "blocked";
  }

  if (success === false && normalized) {
    return "unknown";
  }

  return "no_contacts";
}
