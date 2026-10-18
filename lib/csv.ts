// Minimal RFC 4180 CSV reader + header mapper for the lead importer.
// Runs in the browser (no dependency) so we can preview a file before upload.

// Parse CSV text into rows of string cells. Handles quoted fields, escaped
// quotes (""), commas and newlines inside quotes, CRLF, and a leading BOM.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      // Skip the blank row a trailing newline would otherwise produce
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  return rows;
}

export interface MappedLead {
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  linkedinId: string | null;
}

export interface MapResult {
  leads: MappedLead[];
  skipped: number;            // rows dropped for missing/invalid email
  columns: Record<string, string | null>; // which header fed each field (for display)
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Find the first header whose normalized form matches one of the candidates
function findCol(headers: string[], exact: string[], contains: string[] = []): number {
  const normed = headers.map(norm);
  for (const cand of exact) { const i = normed.indexOf(cand); if (i !== -1) return i; }
  for (const cand of contains) { const i = normed.findIndex((h) => h.includes(cand)); if (i !== -1) return i; }
  return -1;
}

// Turn parsed CSV rows into lead records, auto-detecting the common columns.
export function mapRowsToLeads(rows: string[][]): MapResult {
  if (rows.length === 0) return { leads: [], skipped: 0, columns: {} };
  const headers = rows[0];

  const idx = {
    email: findCol(headers, ["email", "emailaddress", "mail"], ["email"]),
    name: findCol(headers, ["name", "fullname", "contactname", "contact", "client", "clientname", "customer", "customername"]),
    first: findCol(headers, ["firstname", "first", "fname", "givenname"]),
    last: findCol(headers, ["lastname", "last", "lname", "surname", "familyname"]),
    company: findCol(headers, ["company", "companyname", "organization", "organisation", "org", "business", "account"]),
    phone: findCol(headers, ["phone", "phonenumber", "mobile", "cell", "cellphone", "tel", "telephone"], ["phone", "mobile"]),
    linkedin: findCol(headers, ["linkedin", "linkedinurl", "linkedinprofile"], ["linkedin"]),
  };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const leads: MappedLead[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const email = cell(row, idx.email).toLowerCase();
    if (!EMAIL_RE.test(email)) { skipped++; continue; }

    let name = cell(row, idx.name);
    if (!name) name = `${cell(row, idx.first)} ${cell(row, idx.last)}`.trim();

    leads.push({
      email,
      name: name || null,
      company: cell(row, idx.company) || null,
      phone: cell(row, idx.phone) || null,
      linkedinId: cell(row, idx.linkedin) || null,
    });
  }

  const label = (i: number) => (i >= 0 ? headers[i] : null);
  return {
    leads,
    skipped,
    columns: {
      email: label(idx.email),
      name: idx.name >= 0 ? label(idx.name) : [label(idx.first), label(idx.last)].filter(Boolean).join(" + ") || null,
      company: label(idx.company),
      phone: label(idx.phone),
      linkedin: label(idx.linkedin),
    },
  };
}
