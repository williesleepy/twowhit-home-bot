import { fetchTextChannel } from "./discordRead.js";
import { messageUrl } from "../utils/discord.js";
import { collapseWhitespace, truncate } from "../utils/text.js";

function displayChannelMention(message, id) {
  const channel = message.mentions?.channels?.get(id) ?? message.guild?.channels?.cache?.get(id);
  return channel?.name ? `#${channel.name}` : "#channel";
}

function displayUserMention(message, id) {
  const member = message.guild?.members?.cache?.get(id);
  const user = message.mentions?.users?.get(id) ?? member?.user;
  const name = member?.displayName ?? user?.globalName ?? user?.username;
  return name ? `@${name}` : "@user";
}

function displayRoleMention(message, id) {
  const role = message.mentions?.roles?.get(id) ?? message.guild?.roles?.cache?.get(id);
  return role?.name ? `@${role.name}` : "@role";
}

/**
 * Convert Discord's clickable mention/autolink syntaxes to plain, readable text.
 *
 * This matters when the result is placed inside a Markdown link label. A channel
 * mention such as <#123> is itself a linked UI element in Discord, and nesting it
 * inside [label](url) can cause the outer link to render incorrectly.
 */
export function flattenDiscordLinkables(content, message = {}) {
  return String(content ?? "")
    // Markdown links: keep the human-readable label, discard the nested target.
    .replace(/\[([^\]]+)]\((?:\\.|[^)])+\)/g, "$1")
    // Discord channel, role, and user mentions are themselves clickable.
    .replace(/<#(\d+)>/g, (_match, id) => displayChannelMention(message, id))
    .replace(/<@&(\d+)>/g, (_match, id) => displayRoleMention(message, id))
    .replace(/<@!?(\d+)>/g, (_match, id) => displayUserMention(message, id))
    // Custom emoji and slash-command mentions also use Discord angle-bracket syntax.
    .replace(/<a?:([A-Za-z0-9_]+):\d+>/g, ":$1:")
    .replace(/<\/([^:>]+):\d+>/g, "/$1")
    // Remove angle-bracket autolink wrappers while retaining their readable target.
    .replace(/<(https?:\/\/[^>]+)>/gi, "$1")
    // Timestamps are interactive Discord tokens too. Keep a neutral readable form
    // rather than nesting the token inside the outer message link.
    .replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (_match, unix) => {
      const date = new Date(Number(unix) * 1000);
      return Number.isNaN(date.getTime()) ? "date" : date.toISOString().slice(0, 10);
    });
}

export function summarizeAnnouncement(content, maxLength, message = {}) {
  const lines = String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^@everyone\b/i.test(line))
    .map((line) => line.replace(/^#{1,6}\s*/, ""));

  const preferred = lines.find((line) => /\*\*.+\*\*/.test(line)) ?? lines[0];
  const joined = preferred ?? lines.slice(0, 2).join(" ");
  const flattened = flattenDiscordLinkables(joined, message).replaceAll("**", "");
  return truncate(collapseWhitespace(flattened), maxLength);
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
    summary: summarizeAnnouncement(message.content, config.limits.announcementChars, message),
    url: messageUrl(config.guildId, config.channels.announcements, message.id),
  };
}
