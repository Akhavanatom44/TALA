// Defense-in-depth text cleanup: strips other channels' links/usernames/ad
// phrases even if the AI rewrite missed something. Runs before AND after Gemini.

const TME_LINK_RE = /https?:\/\/(www\.)?t\.me\/[a-zA-Z0-9_+/]+/gi;
const TELEGRAM_ME_RE = /https?:\/\/(www\.)?telegram\.me\/[a-zA-Z0-9_+/]+/gi;
const USERNAME_MENTION_RE = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{4,32})/g;
const JOIN_PHRASES_RE =
  /(عضو شوید|عضو کانال|لینک کانال|لینک عضویت|جوین شوید|join (our|the)? ?channel|کانال ما|منبع\s*[:：]?)/gi;

export function stripForeignLinksAndMentions(input: string): string {
  if (!input) return input;
  let out = input;
  out = out.replace(TME_LINK_RE, "");
  out = out.replace(TELEGRAM_ME_RE, "");
  out = out.replace(USERNAME_MENTION_RE, "$1");
  out = out.replace(JOIN_PHRASES_RE, "");
  // Collapse excess blank lines/spaces left behind by removals.
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();
  return out;
}

export function containsBlacklistedKeyword(text: string, blacklistRaw?: string | null): string | null {
  if (!blacklistRaw) return null;
  const keywords = blacklistRaw
    .split(/[\n,]/)
    .map((k) => k.trim())
    .filter(Boolean);
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (kw && lower.includes(kw.toLowerCase())) return kw;
  }
  return null;
}

export function buildFinalCaption(
  body: string,
  footerText?: string | null,
): string {
  const cleanBody = body.trim();
  const footer = (footerText ?? "").trim();
  if (!footer) return cleanBody;
  if (!cleanBody) return footer;
  return `${cleanBody}\n\n${footer}`;
}
