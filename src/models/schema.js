/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} keyword
 * @property {string} city
 * @property {string} state
 * @property {string} address
 * @property {string} phone
 * @property {string} website
 * @property {string} source
 * @property {string} source_url
 * @property {number} confidence_score
 * @property {string} status
 * @property {string} created_at
 */

/**
 * @typedef {Object} Contact
 * @property {string} id
 * @property {string} company_id
 * @property {string} name
 * @property {string} title
 * @property {string} email
 * @property {string} phone
 * @property {string} source_url
 * @property {number} confidence_score
 * @property {string} verification_status
 * @property {string} created_at
 */

export const companySchema = {
  table: "companies",
  fields: [
    "id",
    "name",
    "keyword",
    "city",
    "state",
    "address",
    "phone",
    "website",
    "source",
    "source_url",
    "confidence_score",
    "status",
    "created_at",
  ],
};

export const contactSchema = {
  table: "contacts",
  fields: [
    "id",
    "company_id",
    "name",
    "title",
    "email",
    "phone",
    "source_url",
    "confidence_score",
    "verification_status",
    "created_at",
  ],
};

export const schemas = {
  companies: companySchema,
  contacts: contactSchema,
};
