import { readLatestAnnouncement } from "./announcements.js";
import { readDeutschBuddy } from "./deutschBuddy.js";
import { collectForumData } from "./forums.js";
import { fetchLiveStatus, readLatestLiveAlert } from "./liveStatus.js";
import { collectMemberStats } from "./memberStats.js";
import { readPlayDesk } from "./playDesk.js";
import { readStreamGuide } from "./streamGuide.js";
import { collectTheme } from "./theme.js";
import { collectVoiceActivity } from "./voiceActivity.js";

function settled(label, result, fallback) {
  if (result.status === "fulfilled") return result.value;
  console.warn(`[home] ${label} integration failed:`, result.reason?.message ?? result.reason);
  return fallback;
}

export async function collectHomeData(client, config) {
  const guild = await client.guilds.fetch(config.guildId);
  await guild.roles.fetch().catch(() => null);

  const forumsPromise = collectForumData(client, config);
  const [themeResult, playDeskResult, streamGuideResult, liveResult, liveAlertResult, deutschResult, forumResult, announcementResult, voiceResult] = await Promise.allSettled([
    collectTheme(client, config, guild),
    readPlayDesk(client, config),
    readStreamGuide(client, config),
    fetchLiveStatus(config),
    readLatestLiveAlert(client, config),
    readDeutschBuddy(client, config),
    forumsPromise,
    readLatestAnnouncement(client, config),
    collectVoiceActivity(client, config),
  ]);

  const forums = settled("Forum", forumResult, {
    suggestions: { count: 0, activeCount: 0, statusCounts: {}, latest: null },
    fighterGuides: { count: 0, index: {} },
    ultimateGuide: { count: 0 },
  });

  const memberStats = await collectMemberStats(guild, config, forums.fighterGuides.index);

  return {
    guild: {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      boostCount: guild.premiumSubscriptionCount ?? 0,
    },
    theme: settled("Theme", themeResult, { emoji: "☁️", accent: config.accentColor, phase: null, guildName: guild.name }),
    playDesk: settled("Play Desk", playDeskResult, { status: "error", data: null }),
    streamGuide: settled("Stream Guide", streamGuideResult, { status: "error", data: null }),
    live: settled("Live status", liveResult, { status: "error", isLive: null, name: config.streamer.name, username: config.streamer.username }),
    latestLiveAlert: settled("Live alert", liveAlertResult, null),
    deutsch: settled("Deutsch Buddy", deutschResult, { status: "error", data: null }),
    suggestions: forums.suggestions,
    fighterGuides: forums.fighterGuides,
    ultimateGuide: forums.ultimateGuide,
    members: memberStats,
    announcement: settled("Announcement", announcementResult, null),
    voice: settled("Voice activity", voiceResult, { enabled: false, totalHumans: 0, rooms: [] }),
  };
}
