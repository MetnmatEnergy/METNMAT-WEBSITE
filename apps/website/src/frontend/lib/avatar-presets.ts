/**
 * Profile-picture presets. A stored avatar value is one of:
 *   - "" / undefined         → no picture; render the member's initial
 *   - a `data:image/…` URI   → a photo the customer uploaded (resized client-side)
 *   - one of AVATAR_EMOJIS   → an emoji rendered on a colourful gradient circle
 *
 * Emoji + gradient avatars render in full colour on every modern browser, weigh
 * a few bytes, and are CSP-safe (no external images). Google's own profile
 * illustrations are proprietary and can't be reused, so we offer a themed emoji
 * gallery (same variety: nature, animals, landmarks, objects, food, sport) plus
 * real photo upload.
 */

export const AVATAR_EMOJIS = [
  "🌹", "🌻", "🌵", "🍁", "🌴", "🌊",
  "⛰️", "🔥", "🦁", "🐯", "🐺", "🦊",
  "🐼", "🐬", "🦉", "🦋", "🐢", "🦕",
  "🕷️", "🐍", "🐱", "🐝", "🦄", "🐙",
  "🏰", "🕌", "🗿", "🌉", "⛵", "🚀",
  "🎡", "🎢", "🎸", "🎧", "🎨", "📖",
  "🔬", "🧪", "💎", "🧠", "📷", "♟️",
  "⚽", "🏀", "🎾", "🏄", "👟", "🥗",
] as const;

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

const EMOJI_SET = new Set<string>(AVATAR_EMOJIS as readonly string[]);

export function isPhotoAvatar(v?: string | null): boolean {
  return !!v && v.startsWith("data:image/");
}

export function isEmojiAvatar(v?: string | null): boolean {
  return !!v && EMOJI_SET.has(v);
}

/** Deterministic gradient for an emoji/seed, so a given avatar always looks the same. */
export function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** Max stored avatar length (~220 KB). Presets are tiny; uploads are resized. */
export const MAX_AVATAR_LEN = 300_000;

/**
 * Server-side sanitiser. Returns the safe value to store, or null to reject
 * (leave the stored value unchanged). "" clears the picture.
 */
export function sanitizeAvatar(v: unknown): string | null {
  const s = typeof v === "string" ? v : "";
  if (s === "") return "";
  if (isEmojiAvatar(s)) return s;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= MAX_AVATAR_LEN) return s;
  return null;
}
