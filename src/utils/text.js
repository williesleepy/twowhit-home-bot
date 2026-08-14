export function truncate(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("~", "\\~")
    .replaceAll("`", "\\`")
    .replaceAll("|", "\\|");
}

export function escapeMarkdownLinkLabel(value) {
  return escapeMarkdown(value)
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

export function markdownLink(label, url, maxLabelLength = 150) {
  if (!url) return escapeMarkdownLinkLabel(truncate(label, maxLabelLength));
  const safeLabel = escapeMarkdownLinkLabel(truncate(label, maxLabelLength));
  return `[${safeLabel}](${url})`;
}

export function firstEmoji(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(?:\p{Extended_Pictographic}|[#*0-9]\uFE0F?\u20E3)(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}|[#*0-9]\uFE0F?\u20E3))*/u);
  return match?.[0] ?? null;
}

export function normalizeLookupName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function stripGuideNumber(value) {
  return String(value ?? "").replace(/^\s*\d+(?:ε)?(?:\s*[–-]\s*\d+(?:ε)?)?(?:\.)?\s*/u, "").trim();
}

export function humanizeRoleName(value) {
  const text = String(value ?? "").trim();
  const emoji = firstEmoji(text);
  return emoji ? text.slice(emoji.length).trim() : text;
}
