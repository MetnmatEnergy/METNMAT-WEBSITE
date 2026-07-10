/**
 * Indian States & Union Territories — used by the address form's State dropdown
 * (shown when the address country is India). Also used to normalise the state
 * names returned by the pincode / reverse-geocode autofill so they match an
 * option in the dropdown.
 */
export const INDIAN_STATES: string[] = [
  // 28 states
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  // 8 union territories
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const NORMALISE = (s: string) => s.trim().toLowerCase().replace(/[^a-z]/g, "");

// A few aliases the geocode/postal APIs sometimes return.
const ALIASES: Record<string, string> = {
  orissa: "Odisha",
  pondicherry: "Puducherry",
  uttaranchal: "Uttarakhand",
  nctofdelhi: "Delhi",
  delhinct: "Delhi",
  jammukashmir: "Jammu and Kashmir",
};

const BY_NORM = new Map(INDIAN_STATES.map((s) => [NORMALISE(s), s]));

/**
 * Best-effort match of a free-text state name (from an autofill API) to a
 * canonical dropdown option. Returns "" when there's no confident match.
 */
export function matchIndianState(input?: string | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const norm = NORMALISE(raw);
  if (BY_NORM.has(norm)) return BY_NORM.get(norm) as string;
  if (ALIASES[norm]) return ALIASES[norm];
  // Loose contains match (e.g. "Maharashtra State").
  for (const [n, name] of BY_NORM) {
    if (norm.includes(n) || n.includes(norm)) return name;
  }
  return "";
}
