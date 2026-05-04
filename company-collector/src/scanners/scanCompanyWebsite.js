export function scanCompanyWebsite(company) {
  return {
    status: "not_implemented",
    next_step: "Use public company website pages to extract contact names, titles, emails, and phones.",
    company_id: company.id || "",
    company_name: company.name || "",
    company_website: company.website || "",
  };
}
