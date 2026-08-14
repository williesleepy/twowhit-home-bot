import { channelUrl, discordTimestamp } from "../utils/discord.js";
import { escapeMarkdown, markdownLink, truncate } from "../utils/text.js";

const Type = Object.freeze({ actionRow: 1, button: 2, section: 9, text: 10, separator: 14, container: 17 });
const ButtonStyle = Object.freeze({ primary: 1, secondary: 2, success: 3, danger: 4, link: 5 });

function text(content) {
  return { type: Type.text, content };
}

function separator({ large = false, divider = true } = {}) {
  return { type: Type.separator, divider, spacing: large ? 2 : 1 };
}

function linkButton(label, url) {
  return url ? { type: Type.button, style: ButtonStyle.link, label, url } : null;
}

function customButton(label, customId, style = ButtonStyle.secondary) {
  return { type: Type.button, style, label, custom_id: customId };
}

function row(buttons) {
  const components = buttons.filter(Boolean).slice(0, 5);
  return components.length ? { type: Type.actionRow, components } : null;
}

function section(content, accessory) {
  return {
    type: Type.section,
    components: [text(content)],
    accessory,
  };
}

function guildChannel(config, key) {
  const id = config.channels[key];
  return id ? channelUrl(config.guildId, id) : null;
}

function memberHeader(data) {
  const parts = [`👥 **${data.guild.memberCount.toLocaleString()} members**`];
  if (data.members.available && Number.isInteger(data.members.smasherCount)) {
    parts.push(`🎮 **${data.members.smasherCount} Smashers**`);
  }
  if (data.members.available && Number.isInteger(data.members.totCount)) {
    parts.push(`🥔 **${data.members.totCount} Tots**`);
  }
  return parts.join(" · ");
}

function liveHeaderLine(data, config) {
  if (data.live.isLive === true) return `🔴 **${config.streamer.name} is live**`;
  if (data.live.isLive === false) {
    const last = data.latestLiveAlert?.createdAt
      ? ` · last go-live alert ${discordTimestamp(data.latestLiveAlert.createdAt, "R")}`
      : "";
    return `⚫ **${config.streamer.name} is offline**${last}`;
  }
  return `⚪ **${config.streamer.name} live status unavailable**`;
}

function playDeskText(data, config) {
  const panel = data.playDesk.data;
  if (!panel) {
    return "## 🟢 Play Desk\n\nSee who’s around, mark yourself available, or join a session.";
  }
  if (panel.availableCount === 0) {
    return "## 🟢 Play Desk\n\n**Nobody is looking right now.** Be the first 👀";
  }

  const lines = [
    "## 🟢 Play Desk",
    "",
    `**${panel.availableCount} ${panel.availableCount === 1 ? "person is" : "people are"} available right now**`,
    "",
  ];
  for (const person of panel.people.slice(0, config.limits.playDeskPeople)) {
    const focus = person.focus ? ` — ${truncate(person.focus, 70)}` : "";
    const expiry = person.expiresAt ? ` · ${discordTimestamp(person.expiresAt, "R")}` : "";
    lines.push(`• <@${person.userId}> · ${person.game} · ${person.intent}${focus}${expiry}`);
  }
  if (panel.availableCount > config.limits.playDeskPeople) {
    lines.push(`-# +${panel.availableCount - config.limits.playDeskPeople} more in Play Desk`);
  }
  return lines.join("\n");
}

function streamGuideText(data, config) {
  const guide = data.streamGuide.data;
  if (!guide) {
    return "## 📺 Tournament Streams\n\nSee notable Ultimate & Melee tournaments, broadcasts, and what’s live.";
  }

  if (guide.liveBroadcasts.length) {
    const lines = ["## 🔴 Live Tournament Streams", ""];
    for (const broadcast of guide.liveBroadcasts.slice(0, config.limits.liveBroadcasts)) {
      const stream = broadcast.url ? `[${broadcast.name}](${broadcast.url})` : broadcast.name;
      const context = broadcast.context?.[0] ? ` · ${truncate(broadcast.context[0], 80)}` : "";
      lines.push(`• **${truncate(broadcast.tournament, 100)}** — ${stream}${context}`);
    }
    return lines.join("\n");
  }

  if (guide.today.length) {
    const lines = ["## 📺 Tournaments Today", ""];
    for (const event of guide.today.slice(0, config.limits.todayTournaments)) {
      const detail = [event.games, event.entrants].filter(Boolean).join(" · ");
      lines.push(`• **${truncate(event.name, 120)}**${detail ? ` — ${detail}` : ""}`);
    }
    if (guide.week) lines.push(`-# ${guide.week}`);
    return lines.join("\n");
  }

  const count = guide.weekly.length;
  return [
    "## 📺 Tournament Streams This Week",
    "",
    count
      ? `**${count} notable ${count === 1 ? "tournament" : "tournaments"}** still on the guide.`
      : "Nothing notable is currently listed on the guide.",
    guide.week ? `-# ${guide.week}` : null,
  ].filter(Boolean).join("\n");
}

function learningText(data) {
  const lines = ["## 📚 Learn Smash", ""];
  const counts = [];
  if (data.ultimateGuide.count) counts.push(`**${data.ultimateGuide.count}** Ultimate chapters`);
  if (data.fighterGuides.count) counts.push(`**${data.fighterGuides.count}** fighter guides`);
  lines.push(counts.length ? counts.join(" · ") : "Competitive fundamentals and fighter-specific resources live here.");

  if (data.members.topFighters.length) {
    const popular = data.members.topFighters
      .map((fighter, index) => `${index === 0 ? "👑 " : ""}**${fighter.fighterName}** (${fighter.count})`)
      .join(" · ");
    lines.push("", `Most played here: ${popular}`);
  }
  return lines.join("\n");
}

function communityText(data) {
  const generalEmoji = data.channelIcons?.general || "☁️";
  const announcementEmoji = data.channelIcons?.announcements || "🛰️";
  const suggestionEmoji = data.channelIcons?.suggestions || "💫";
  const blocks = [`## ${generalEmoji} Around the server`];

  if (data.announcement?.summary) {
    blocks.push(
      `${announcementEmoji} **Latest update:** ${escapeMarkdown(data.announcement.summary)} · ${markdownLink("Open", data.announcement.url)}`,
    );
  }

  if (data.suggestions.latest) {
    const statuses = data.suggestions.latest.tags.filter((tag) => /Review|Planned|Progress|Completed|Declined/i.test(tag));
    const status = statuses[0] ? ` · ${statuses[0]}` : "";
    const suggestionLines = [
      `${suggestionEmoji} **Latest suggestion:** ${escapeMarkdown(truncate(data.suggestions.latest.name, 120))}${status} · ${markdownLink("Open", data.suggestions.latest.url)}`,
    ];

    const activeSuggestionStatuses = Object.entries(data.suggestions.statusCounts ?? {})
      .filter(([name, count]) => count > 0 && /Under Review|Planned|In Progress/i.test(name))
      .map(([name, count]) => `${name.replace(/^[^\p{L}]+/u, "")} ${count}`);
    if (activeSuggestionStatuses.length) {
      suggestionLines.push(`-# Ideas in motion: ${activeSuggestionStatuses.join(" · ")}`);
    }

    blocks.push(suggestionLines.join("\n"));
  } else if (data.suggestions.count) {
    const suggestionLines = [
      `${suggestionEmoji} **${data.suggestions.count} community ${data.suggestions.count === 1 ? "idea" : "ideas"}** in Suggestions.`,
    ];

    const activeSuggestionStatuses = Object.entries(data.suggestions.statusCounts ?? {})
      .filter(([name, count]) => count > 0 && /Under Review|Planned|In Progress/i.test(name))
      .map(([name, count]) => `${name.replace(/^[^\p{L}]+/u, "")} ${count}`);
    if (activeSuggestionStatuses.length) {
      suggestionLines.push(`-# Ideas in motion: ${activeSuggestionStatuses.join(" · ")}`);
    }

    blocks.push(suggestionLines.join("\n"));
  }

  if (data.voice?.totalHumans > 0) {
    const occupied = data.voice.rooms
      .filter((room) => room.count > 0)
      .map((room) => `<#${room.channelId}> **${room.count}**`)
      .join(" · ");
    blocks.push(`🎙️ **Voice right now:** ${occupied}`);
  }

  if (data.deutsch.data?.postedToday && data.deutsch.data.words.length) {
    const words = data.deutsch.data.words.slice(0, 3).map((word) => `**${word.german}**`).join(" · ");
    blocks.push(`🇩🇪 **Deutsch today:** ${words}${data.deutsch.data.quizReady ? " · 🧠 quiz ready" : " · quiz later"}`);
  } else if (data.deutsch.status === "ok" && data.deutsch.data && !data.deutsch.data.postedToday) {
    blocks.push("🇩🇪 **Deutsch Buddy:** today’s lesson hasn’t posted yet.");
  }

  if (blocks.length === 1) {
    blocks.push("Chat, share clips, wander into the Tall Grass, or leave an idea for the server.");
  }

  return blocks.join("\n\n");
}

export function buildHomeDashboard(data, config, meta = {}) {
  const children = [];
  const titleEmoji = data.theme.emoji || "☁️";

  children.push(text(
    `# ${titleEmoji} ${data.guild.name}\n` +
    `**${config.tagline}**\n\n` +
    `${memberHeader(data)}\n` +
    liveHeaderLine(data, config),
  ));

  if (data.live.isLive === true) {
    children.push(separator({ large: true }));
    children.push(section(
      `## 🔴 ${config.streamer.name} is LIVE!\n\nThe stream is live on TikTok right now.`,
      linkButton("Watch Live", data.live.liveUrl),
    ));
  }

  children.push(separator({ large: true }));
  children.push(section(
    playDeskText(data, config),
    linkButton("Open Play Desk", guildChannel(config, "playDesk")),
  ));

  children.push(separator({ large: true }));
  children.push(section(
    streamGuideText(data, config),
    linkButton("Open Stream Guide", guildChannel(config, "tournamentStreams")),
  ));

  children.push(separator({ large: true }));
  children.push(text(learningText(data)));
  children.push(row([
    linkButton("Ultimate Guide", guildChannel(config, "ultimateGuide")),
    linkButton("Fighter Guides", guildChannel(config, "fighterGuides")),
    customButton("My Fighter Guides", "home:my-fighters", ButtonStyle.primary),
    customButton("My Setup", "home:my-setup", ButtonStyle.secondary),
  ]));

  children.push(separator({ large: true }));
  children.push(text(communityText(data)));
  children.push(row([
    linkButton("General", guildChannel(config, "general")),
    linkButton("Media", guildChannel(config, "media")),
    linkButton("Tall Grass", guildChannel(config, "tallGrass")),
    linkButton("Suggestions", guildChannel(config, "suggestions")),
  ]));

  children.push(separator({ large: true }));
  children.push(section(
    "### 👋 New here?\n\nRead the rules, use **Channels & Roles** to choose your interests, fighters, color, and notifications, then jump in whenever you want.",
    linkButton("Read Rules", guildChannel(config, "rules")),
  ));
  children.push(row([
    linkButton("Announcements", guildChannel(config, "announcements")),
    linkButton("Stream Alerts", guildChannel(config, "streamAlerts")),
    linkButton("Play Alerts", guildChannel(config, "playAlerts")),
    linkButton("Deutsch Buddy", guildChannel(config, "deutschBuddy")),
  ]));

  const changedAt = meta.changedAt ?? new Date();
  children.push(text(`-# Home updates automatically when the server changes • Last dashboard change ${discordTimestamp(changedAt, "R")}`));

  return {
    type: Type.container,
    accent_color: data.theme.accent ?? config.accentColor,
    components: children.filter(Boolean),
  };
}

export function countComponents(input) {
  let count = 0;
  function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    if (node.type) count += 1;
    if (node.components) walk(node.components);
    if (node.accessory) walk(node.accessory);
  }
  walk(input);
  return count;
}
