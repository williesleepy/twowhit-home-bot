import { extractTextDisplays } from "./componentText.js";
import { fetchLatestMessageByAuthor } from "./discordRead.js";
import { truncate } from "../utils/text.js";

function parsePerson(block) {
  const userId = block.match(/<@(\d{17,20})>/)?.[1] ?? null;
  if (!userId) return null;

  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const second = lines[1] ?? "";
  const focusLine = lines.find((line) => line.startsWith("-# "));
  const firstParts = first.split(" · ");
  const secondParts = second.split(" · ");
  const expiresAt = second.match(/<t:(\d+):[tTRfFdD]>/)?.[1];

  return {
    userId,
    game: firstParts.slice(1).join(" · ").trim() || "Game",
    intent: secondParts[0]?.trim() || "Available",
    expiresAt: expiresAt ? Number(expiresAt) * 1000 : null,
    focus: focusLine ? focusLine.replace(/^-#\s*/, "").trim() : null,
    raw: truncate(block, 500),
  };
}

export function parsePlayDeskPanel(components) {
  const texts = extractTextDisplays(components).map((value) => value.trim()).filter(Boolean);
  if (!texts.length) return null;

  const empty = texts.some((text) => /Nobody is currently looking/i.test(text));
  const countText = texts.find((text) => /\*\*\d+ (?:person is|people are) available\*\*/i.test(text));
  const count = countText ? Number(countText.match(/\*\*(\d+)/)?.[1] ?? 0) : empty ? 0 : null;
  const people = texts.map(parsePerson).filter(Boolean);

  return {
    availableCount: Number.isInteger(count) ? count : people.length,
    people,
    empty,
  };
}

export async function readPlayDesk(client, config) {
  if (!config.readExternalBotMessages) return { status: "disabled", data: null };
  const message = await fetchLatestMessageByAuthor(
    client,
    config.channels.playDesk,
    config.bots.playDesk,
    config.messageScanLimit,
  );
  if (!message) return { status: "missing", data: null };
  const data = parsePlayDeskPanel(message.components);
  return { status: data ? "ok" : "unreadable", data, messageId: message.id };
}
