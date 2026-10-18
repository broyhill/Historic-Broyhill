// Split a single display name into salutation / first / middle / last.
// Heuristic and best-effort — it never guesses a salutation from a first name
// (that would risk misgendering); a salutation is only set when the name text
// actually contains a title (Dr., Rev., …).

export interface NameParts {
  salutation: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
}

const SALUTATIONS: Record<string, string> = {
  mr: "Mr.", mrs: "Mrs.", ms: "Ms.", miss: "Miss", mx: "Mx.",
  dr: "Dr.", prof: "Prof.", professor: "Prof.", rev: "Rev.", reverend: "Rev.",
  fr: "Fr.", sir: "Sir", madam: "Madam", hon: "Hon.", capt: "Capt.", col: "Col.",
  sgt: "Sgt.", lt: "Lt.", gen: "Gen.", pastor: "Pastor", coach: "Coach",
};

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v", "phd", "md", "esq", "cpa", "cfp"]);

export function parseName(raw: string | null | undefined): NameParts {
  const empty: NameParts = { salutation: null, firstName: null, middleName: null, lastName: null };
  if (!raw) return empty;

  // Drop nicknames in quotes or parentheses: Zebulon "Zeb" Williams -> Zebulon Williams
  let s = raw.replace(/["'“”‘’(][^"'“”‘’)]*["'“”‘’)]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return empty;

  let tokens = s.split(" ");

  // Leading salutation
  let salutation: string | null = null;
  const head = tokens[0].replace(/\./g, "").toLowerCase();
  if (SALUTATIONS[head] && tokens.length > 1) {
    salutation = SALUTATIONS[head];
    tokens = tokens.slice(1);
  }

  // Drop trailing suffixes (Jr, III, PhD) from the name parts
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1].replace(/\./g, "").toLowerCase())) {
    tokens = tokens.slice(0, -1);
  }

  if (tokens.length === 0) return { salutation, firstName: null, middleName: null, lastName: null };
  if (tokens.length === 1) return { salutation, firstName: tokens[0], middleName: null, lastName: null };
  if (tokens.length === 2) return { salutation, firstName: tokens[0], middleName: null, lastName: tokens[1] };
  return { salutation, firstName: tokens[0], middleName: tokens.slice(1, -1).join(" "), lastName: tokens[tokens.length - 1] };
}
