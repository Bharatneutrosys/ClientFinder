const MAX_PAGE_TEXT_LENGTH = 4000;

export function isAiExtractionEnabled() {
  return (
    String(process.env.AI_EXTRACTION_ENABLED || "").toLowerCase() === "true" &&
    Boolean(String(process.env.OPENAI_API_KEY || "").trim())
  );
}

export async function extractContactsWithAi({ companyName, website, pageUrl, pageText }) {
  const cleanedPageText = cleanPageText(pageText);

  if (!isAiExtractionEnabled() || !cleanedPageText) {
    return [];
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contact_extraction",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                contacts: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      title: { type: "string" },
                      email: { type: "string" },
                      phone: { type: "string" },
                      linkedin_url: { type: "string" },
                      contact_page_url: { type: "string" },
                      source_url: { type: "string" },
                      confidence_score: { type: "number" },
                      evidence_summary: { type: "string" },
                    },
                    required: [
                      "name",
                      "title",
                      "email",
                      "phone",
                      "linkedin_url",
                      "contact_page_url",
                      "source_url",
                      "confidence_score",
                      "evidence_summary",
                    ],
                  },
                },
              },
              required: ["contacts"],
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "Extract public outreach-relevant business contacts from page text. Prefer people in business development, sales, account management, vendor management, recruiting, talent acquisition, leadership, founders, or executives. Return only contacts directly supported by the text. Use empty strings when a field is unknown.",
          },
          {
            role: "user",
            content: buildPrompt({
              companyName,
              website,
              pageUrl,
              cleanedPageText,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    const contacts = Array.isArray(parsed?.contacts) ? parsed.contacts : [];

    return contacts
      .map((contact) => normalizeAiContact(contact, pageUrl))
      .filter((contact) => contact.email || contact.phone);
  } catch (error) {
    return [];
  }
}

function getModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function buildPrompt({ companyName, website, pageUrl, cleanedPageText }) {
  return [
    `Company: ${companyName || "Unknown"}`,
    `Website: ${website || ""}`,
    `Page URL: ${pageUrl || ""}`,
    "Task: Extract structured public contact details from this page text.",
    "Rules:",
    "- Return a contact only if the text supports it.",
    '- Use "Unknown" for missing names and "Website Contact" for missing titles.',
    "- Look for names, titles, emails, phones, LinkedIn URLs, and outreach-relevant roles.",
    "- Keep confidence_score between 0 and 100.",
    "- Keep evidence_summary short and specific.",
    "- Use the provided Page URL as source_url and contact_page_url unless the text clearly references another page.",
    "Page text:",
    cleanedPageText,
  ].join("\n");
}

function normalizeAiContact(contact, defaultSourceUrl) {
  return {
    name: String(contact?.name || "Unknown").trim() || "Unknown",
    title: String(contact?.title || "Website Contact").trim() || "Website Contact",
    email: String(contact?.email || "")
      .trim()
      .toLowerCase(),
    phone: String(contact?.phone || "").trim(),
    linkedin_url: String(contact?.linkedin_url || "").trim(),
    contact_page_url: String(contact?.contact_page_url || defaultSourceUrl || "").trim(),
    source_url: String(contact?.source_url || defaultSourceUrl || "").trim(),
    confidence_score: clampConfidence(contact?.confidence_score),
    evidence_summary: String(contact?.evidence_summary || "").trim(),
    extraction_method: "ai",
  };
}

function cleanPageText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT_LENGTH);
}

function clampConfidence(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 70;
  }

  if (numeric < 0) {
    return 0;
  }

  if (numeric <= 1) {
    return Math.round(numeric * 100);
  }

  if (numeric > 100) {
    return 100;
  }

  return Math.round(numeric);
}
