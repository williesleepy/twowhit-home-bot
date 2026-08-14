export async function fetchTextChannel(client, channelId) {
  if (!channelId) return null;
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.messages) return null;
  return channel;
}

export async function fetchLatestMessageByAuthor(client, channelId, authorId, scanLimit = 50) {
  if (!channelId || !authorId) return null;
  const channel = await fetchTextChannel(client, channelId);
  if (!channel) return null;
  const messages = await channel.messages.fetch({ limit: scanLimit });
  return messages.find((message) => message.author?.id === authorId) ?? null;
}

export async function fetchRecentMessagesByAuthor(client, channelId, authorId, scanLimit = 50) {
  if (!channelId || !authorId) return [];
  const channel = await fetchTextChannel(client, channelId);
  if (!channel) return [];
  const messages = await channel.messages.fetch({ limit: scanLimit });
  return [...messages.values()]
    .filter((message) => message.author?.id === authorId)
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}
