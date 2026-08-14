import { ChannelType } from "discord.js";
import { channelUrl, snowflakeTimestamp } from "../utils/discord.js";
import { humanizeRoleName, normalizeLookupName, stripGuideNumber } from "../utils/text.js";

const FORUM_CACHE_TTL_MS = 5 * 60_000;
let forumCache = null;

export function invalidateForumCache() {
  forumCache = null;
}

function forumCacheKey(config) {
  return [config.guildId, config.channels.suggestions, config.channels.fighterGuides, config.channels.ultimateGuide, config.showSuggestions].join(":");
}

async function fetchForumChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildForum) return null;
  return channel;
}

export async function fetchForumThreads(client, channelId) {
  const channel = await fetchForumChannel(client, channelId);
  if (!channel) return { channel: null, threads: [] };

  const seen = new Map();
  try {
    const active = await channel.threads.fetchActive();
    for (const thread of active.threads.values()) seen.set(thread.id, thread);
  } catch (error) {
    console.warn(`[home] Could not fetch active threads for #${channel.name}:`, error?.message ?? error);
  }

  try {
    let before;
    let pages = 0;
    while (pages < 10) {
      const archived = await channel.threads.fetchArchived({ limit: 100, ...(before ? { before } : {}) });
      const batch = [...archived.threads.values()];
      for (const thread of batch) seen.set(thread.id, thread);
      pages += 1;
      if (!archived.hasMore || !batch.length) break;
      const archiveTimes = batch
        .map((thread) => thread.archiveTimestamp)
        .filter((value) => Number.isFinite(value));
      if (!archiveTimes.length) break;
      before = new Date(Math.min(...archiveTimes));
    }
  } catch (error) {
    console.warn(`[home] Could not fetch archived threads for #${channel.name}:`, error?.message ?? error);
  }

  return { channel, threads: [...seen.values()] };
}

function threadCreatedAt(thread) {
  return thread.createdTimestamp ?? snowflakeTimestamp(thread.id) ?? 0;
}

export function fighterNameFromGuideTitle(name) {
  const withoutNumber = stripGuideNumber(name);
  return humanizeRoleName(withoutNumber);
}

export function buildFighterGuideIndex(guildId, forumChannelId, threads) {
  const byKey = {};
  for (const thread of threads) {
    const fighterName = fighterNameFromGuideTitle(thread.name);
    const key = normalizeLookupName(fighterName);
    if (!key) continue;
    byKey[key] = {
      key,
      name: fighterName,
      threadName: thread.name,
      threadId: thread.id,
      url: channelUrl(guildId, thread.id),
    };
  }
  return byKey;
}

export function matchGuideToRole(role, guideIndex) {
  if (!role || role.managed || role.name === "@everyone") return null;
  const key = normalizeLookupName(humanizeRoleName(role.name));
  return guideIndex[key] ?? null;
}

export async function collectForumData(client, config) {
  const cacheKey = forumCacheKey(config);
  if (forumCache && forumCache.key === cacheKey && Date.now() - forumCache.at < FORUM_CACHE_TTL_MS) {
    return forumCache.data;
  }

  const [suggestionsResult, fightersResult, ultimateResult] = await Promise.allSettled([
    config.showSuggestions ? fetchForumThreads(client, config.channels.suggestions) : null,
    fetchForumThreads(client, config.channels.fighterGuides),
    fetchForumThreads(client, config.channels.ultimateGuide),
  ]);

  const suggestionsSource = suggestionsResult.status === "fulfilled" ? suggestionsResult.value : null;
  const fightersSource = fightersResult.status === "fulfilled" ? fightersResult.value : null;
  const ultimateSource = ultimateResult.status === "fulfilled" ? ultimateResult.value : null;

  const suggestionThreads = suggestionsSource?.threads ?? [];
  const tagNames = new Map((suggestionsSource?.channel?.availableTags ?? []).map((tag) => [tag.id, tag.name]));
  const statusTags = new Set(["🟡 Under Review", "🟢 Planned", "🔵 In Progress", "✅ Completed", "❌ Declined"]);
  const suggestionStatusCounts = {};
  for (const thread of suggestionThreads) {
    const names = (thread.appliedTags ?? []).map((id) => tagNames.get(id)).filter(Boolean);
    const status = names.find((name) => statusTags.has(name)) ?? "Unlabeled";
    suggestionStatusCounts[status] = (suggestionStatusCounts[status] ?? 0) + 1;
  }
  const latestSuggestion = [...suggestionThreads]
    .sort((a, b) => threadCreatedAt(b) - threadCreatedAt(a))[0] ?? null;

  const fighterThreads = fightersSource?.threads ?? [];
  const ultimateThreads = ultimateSource?.threads ?? [];

  const data = {
    suggestions: {
      count: suggestionThreads.length,
      activeCount: suggestionThreads.filter((thread) => !thread.archived).length,
      statusCounts: suggestionStatusCounts,
      latest: latestSuggestion
        ? {
            name: latestSuggestion.name,
            threadId: latestSuggestion.id,
            url: channelUrl(config.guildId, latestSuggestion.id),
            createdAt: new Date(threadCreatedAt(latestSuggestion)),
            tags: (latestSuggestion.appliedTags ?? []).map((id) => tagNames.get(id)).filter(Boolean),
          }
        : null,
    },
    fighterGuides: {
      count: fighterThreads.length,
      index: buildFighterGuideIndex(config.guildId, config.channels.fighterGuides, fighterThreads),
    },
    ultimateGuide: {
      count: ultimateThreads.length,
    },
  };

  forumCache = { key: cacheKey, at: Date.now(), data };
  return data;
}
