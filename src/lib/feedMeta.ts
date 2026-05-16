// Derives the visual metadata the design needs (letter avatar, accent color,
// host label) from the backend's richer-but-plainer Feed model, plus the
// relative / absolute time formatting the prototype shows.

import type { Feed } from "../types";
import i18n from "../i18n";

/** Maps the active app language to a BCP-47 locale for date formatting. */
function dateLocale(): string {
  return { zh: "zh-CN", en: "en-US", ja: "ja-JP" }[i18n.language] ?? "en-US";
}

const PALETTE = [
  "#7c5cff", "#2c8a3e", "#0a6bd4", "#d23a8b", "#a8501f", "#ff6600",
  "#c0392b", "#d05050", "#3a4cb8", "#4a4a4a", "#1d8a8a", "#b85c00",
  "#1c1c1c", "#5200ff", "#1a73e8", "#0f9d8c",
];

/** Stable accent color for a feed, hashed off its id so it never shifts. */
export function feedColor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 1–2 character avatar label: first CJK glyph, or latin initials. */
export function feedAvatar(title: string): string {
  const t = (title || "").trim();
  if (!t) return "?";
  if (/[㐀-鿿]/.test(t[0])) return t[0];
  const words = t.split(/[\s·|—-]+/).filter(Boolean);
  if (words.length >= 2 && /[a-zA-Z]/.test(words[0][0]))
    return (words[0][0] + words[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

/** Bare hostname for the feed, used as a secondary label. */
export function feedHost(feed: Pick<Feed, "siteUrl" | "feedUrl">): string {
  try {
    return new URL(feed.siteUrl || feed.feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return feed.feedUrl;
  }
}

/** Compact relative timestamp ("刚刚", "3h", "2d", or a date). */
export function relTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 1) return i18n.t("common.justNow");
  if (mins < 60) return `${Math.floor(mins)}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  if (mins < 1440 * 7) return `${Math.floor(mins / 1440)}d`;
  return d.toLocaleDateString(dateLocale(), { month: "long", day: "numeric" });
}

/** Long-form publication date for the reader byline. */
export function fullDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(dateLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
