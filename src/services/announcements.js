import { fetchTextChannel } from "./discordRead.js";
import { messageUrl } from "../utils/discord.js";
import { collapseWhitespace, truncate } from "../utils/text.js";

function summarizeAnnouncement(content, maxLength) {
  const lines = String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^@everyone\b/i.test(line))
    .map((line) => line.replace(/^#{1,6}\s*/, ""));

  const preferred = lines.find((line) => /\*\*.+\*\*/.test(line)) ?? lines[0];
  const joined = preferred ?? lines.slice(0, 2).join(" ");
  return truncate(collapseWhitespace(joined).replaceAll("**", ""), maxLength);
}

export async function readLatestAnnouncement(client, config) {
  if (!config.showLatestAnnouncement || !config.readExternalBotMessages || !config.channels.announcements) {
    return null;
  }

  const channel = await fetchTextChannel(client, config.channels.announcements);
  if (!channel) return null;
  const messages = await channel.messages.fetch({ limit: Math.min(config.messageScanLimit, 50) });
  const message = [...messages.values()]
    .filter((item) => !item.author?.bot && item.content?.trim())
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp)[0] ?? null;

  if (!message) return null;
  return {
    messageId: message.id,
    createdAt: message.createdAt,
    summary: summarizeAnnouncement(message.content, config.limits.announcementChars),
    url: messageUrl(config.guildId, config.channels.announcements, message.id),
  };
}
