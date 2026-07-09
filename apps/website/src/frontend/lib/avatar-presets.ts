/**
 * Profile-picture presets. A stored avatar value is one of:
 *   - "" / undefined         → no picture; render the member's initial
 *   - a `data:image/…` URI   → a photo the customer uploaded (resized client-side)
 *   - an illustration id      → a bundled Noto Emoji illustration (see /public/avatars)
 *
 * The illustrations are Google Noto Emoji, Apache-2.0 (see
 * /public/avatars/NOTICE.txt) — flat, colourful vector art self-hosted under
 * /avatars/<id>.svg (id = the emoji's lowercase codepoint), so they render
 * identically on every device and satisfy the CSP (same-origin images). Google's
 * own *profile* illustrations are proprietary and can't be reused, so we ship
 * this open, illustration-style gallery instead.
 */

export const AVATAR_ILLUSTRATIONS: { id: string; label: string }[] = [
  { id: "1f339", label: "Rose" },
  { id: "1f33b", label: "Sunflower" },
  { id: "1f335", label: "Cactus" },
  { id: "1f341", label: "Maple leaf" },
  { id: "1f334", label: "Palm tree" },
  { id: "1f30a", label: "Wave" },
  { id: "26f0", label: "Mountain" },
  { id: "1f525", label: "Fire" },
  { id: "1f981", label: "Lion" },
  { id: "1f42f", label: "Tiger" },
  { id: "1f43a", label: "Wolf" },
  { id: "1f98a", label: "Fox" },
  { id: "1f43c", label: "Panda" },
  { id: "1f42c", label: "Dolphin" },
  { id: "1f989", label: "Owl" },
  { id: "1f98b", label: "Butterfly" },
  { id: "1f422", label: "Turtle" },
  { id: "1f995", label: "Dinosaur" },
  { id: "1f577", label: "Spider" },
  { id: "1f40d", label: "Snake" },
  { id: "1f431", label: "Cat" },
  { id: "1f41d", label: "Bee" },
  { id: "1f984", label: "Unicorn" },
  { id: "1f419", label: "Octopus" },
  { id: "1f3f0", label: "Castle" },
  { id: "1f54c", label: "Mosque" },
  { id: "1f5ff", label: "Moai" },
  { id: "1f309", label: "Bridge" },
  { id: "26f5", label: "Sailboat" },
  { id: "1f680", label: "Rocket" },
  { id: "1f3a1", label: "Ferris wheel" },
  { id: "1f3a2", label: "Roller coaster" },
  { id: "1f3b8", label: "Guitar" },
  { id: "1f3a7", label: "Headphones" },
  { id: "1f3a8", label: "Palette" },
  { id: "1f4d6", label: "Book" },
  { id: "1f52c", label: "Microscope" },
  { id: "1f9ea", label: "Test tube" },
  { id: "1f48e", label: "Gem" },
  { id: "1f9e0", label: "Brain" },
  { id: "1f4f7", label: "Camera" },
  { id: "265f", label: "Chess pawn" },
  { id: "26bd", label: "Football" },
  { id: "1f3c0", label: "Basketball" },
  { id: "1f3be", label: "Tennis" },
  { id: "1f3c4", label: "Surfer" },
  { id: "1f45f", label: "Trainer" },
  { id: "1f957", label: "Salad" },
];

const BY_ID = new Map(AVATAR_ILLUSTRATIONS.map((a) => [a.id, a.label]));

// Literal, complete class strings so Tailwind's content scanner keeps them.
// Do NOT build these dynamically or they'll be purged from the CSS.
export const AVATAR_GRADIENTS = [
  "from-rose-400 to-orange-300",
  "from-sky-400 to-indigo-400",
  "from-emerald-400 to-teal-400",
  "from-amber-400 to-yellow-300",
  "from-fuchsia-400 to-purple-400",
  "from-cyan-400 to-blue-500",
  "from-lime-400 to-green-500",
  "from-pink-400 to-rose-500",
  "from-violet-400 to-indigo-500",
  "from-orange-400 to-red-400",
  "from-teal-400 to-cyan-500",
  "from-indigo-400 to-purple-500",
] as const;

export function isPhotoAvatar(v?: string | null): boolean {
  return !!v && v.startsWith("data:image/");
}

export function isIllustrationAvatar(v?: string | null): boolean {
  return !!v && BY_ID.has(v);
}

export function illustrationSrc(id: string): string {
  return `/avatars/${id}.svg`;
}

export function illustrationLabel(id: string): string {
  return BY_ID.get(id) ?? "Avatar";
}

/** Deterministic gradient for an id/seed, so a given avatar always looks the same. */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** Max stored avatar length (~220 KB). Ids are tiny; uploads are resized. */
export const MAX_AVATAR_LEN = 300_000;

/**
 * Server-side sanitiser. Returns the safe value to store, or null to reject
 * (leave the stored value unchanged). "" clears the picture.
 */
export function sanitizeAvatar(v: unknown): string | null {
  const s = typeof v === "string" ? v : "";
  if (s === "") return "";
  if (isIllustrationAvatar(s)) return s;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= MAX_AVATAR_LEN) return s;
  return null;
}
