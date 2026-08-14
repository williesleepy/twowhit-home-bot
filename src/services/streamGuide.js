import { orderedTopLevelTextBlocks } from "./componentText.js";
import { fetchLatestMessageByAuthor } from "./discordRead.js";

function stripHeading(line) {
  return line.replace(/^#{1,6}\s*/, "").trim();
}

function markdownLink(line) {
  const match = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  return match ? { label: match[1], url: match[2] } : null;
}

function parseTournamentBlock(content) {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const nameLine = lines.find((line) => line.startsWith("### "));
  if (!nameLine) return null;

  const tournamentLinkLine = lines.find((line) => line.includes("[Tournament page]("));
  const broadcastsIndex = lines.findIndex((line) => line === "**Broadcasts**");
  const liveBroadcasts = [];

  if (broadcastsIndex >= 0) {
    for (let index = broadcastsIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.startsWith("🔴 **LIVE**")) continue;
      const link = markdownLink(line);
      const context = [];
      for (let look = index + 1; look < Math.min(lines.length, index + 4); look += 1) {
        const next = lines[look];
        if (/^[🔴⚫⚪📺]/u.test(next) || next.startsWith("Up next:")) break;
        context.push(next.replace(/^\*\*(.+)\*\*$/, "$1"));
      }
      liveBroadcasts.push({ name: link?.label ?? "Live stream", url: link?.url ?? null, context });
    }
  }

  return {
    name: stripHeading(nameLine),
    games: lines.find((line) => line.startsWith("🎮 "))?.slice(3).trim() ?? null,
    date: lines.find((line) => line.startsWith("📅 "))?.slice(3).trim() ?? null,
    location: lines.find((line) => line.startsWith("📍 "))?.slice(3).trim() ?? null,
    entrants: lines.find((line) => line.startsWith("👥 "))?.slice(3).trim() ?? null,
    url: tournamentLinkLine ? markdownLink(tournamentLinkLine)?.url ?? null : null,
    liveBroadcasts,
  };
}

export function parseStreamGuidePanel(components) {
  const blocks = orderedTopLevelTextBlocks(components);
  if (!blocks.length) return null;

  const intro = blocks.find((block) => /#\s*📺\s*Stream Guide/i.test(block.content));
  const week = intro?.content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^\*\*Week of .+\*\*$/.test(line))
    ?.replace(/^\*\*|\*\*$/g, "") ?? null;

  let section = null;
  const today = [];
  const weekly = [];

  for (const block of blocks) {
    if (/Happening Today/i.test(block.content)) {
      section = "today";
      continue;
    }
    if (/Also This Week/i.test(block.content)) {
      section = "weekly";
      continue;
    }
    if (block.kind !== "container") continue;
    const tournament = parseTournamentBlock(block.content);
    if (!tournament) continue;
    if (section === "today") today.push(tournament);
    else if (section === "weekly") weekly.push(tournament);
  }

  const liveBroadcasts = today.flatMap((event) =>
    event.liveBroadcasts.map((broadcast) => ({ ...broadcast, tournament: event.name })),
  );

  return { week, today, weekly, liveBroadcasts };
}

export async function readStreamGuide(client, config) {
  if (!config.readExternalBotMessages) return { status: "disabled", data: null };
  const message = await fetchLatestMessageByAuthor(
    client,
    config.channels.tournamentStreams,
    config.bots.streamGuide,
    config.messageScanLimit,
  );
  if (!message) return { status: "missing", data: null };
  const data = parseStreamGuidePanel(message.components);
  return { status: data ? "ok" : "unreadable", data, messageId: message.id };
}
