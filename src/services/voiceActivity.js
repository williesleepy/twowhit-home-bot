export async function collectVoiceActivity(client, config) {
  const fallback = { enabled: false, totalHumans: 0, rooms: [] };
  if (!config.enableVoiceActivity) return fallback;

  const roomIds = [config.channels.lounge, config.channels.gameRoom].filter(Boolean);
  if (!roomIds.length) return { enabled: true, totalHumans: 0, rooms: [] };

  const rooms = [];
  for (const channelId of roomIds) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isVoiceBased?.()) continue;
      const humans = [...channel.members.values()].filter((member) => !member.user.bot);
      rooms.push({
        channelId,
        name: channel.name,
        count: humans.length,
      });
    } catch (error) {
      console.warn(`[home] Voice room ${channelId} unavailable:`, error?.message ?? error);
    }
  }

  return {
    enabled: true,
    totalHumans: rooms.reduce((sum, room) => sum + room.count, 0),
    rooms,
  };
}
