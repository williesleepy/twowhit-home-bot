import { firstEmoji } from "../utils/text.js";

async function leadingChannelEmoji(client, channelId) {
  if (!channelId) return null;

  const cached = client.channels.cache.get(channelId);
  const channel = cached ?? await client.channels.fetch(channelId);

  return firstEmoji(channel?.name);
}

export async function collectChannelIcons(client, config) {
  const entries = [
    ["general", config.channels.general],
    ["announcements", config.channels.announcements],
    ["suggestions", config.channels.suggestions],
  ];

  const results = await Promise.allSettled(
    entries.map(([, channelId]) => leadingChannelEmoji(client, channelId)),
  );

  return Object.fromEntries(entries.map(([key], index) => [
    key,
    results[index].status === "fulfilled" ? results[index].value : null,
  ]));
}
