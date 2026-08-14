import { fetchRecentMessagesByAuthor } from "./discordRead.js";

export async function fetchLiveStatus(config) {
  if (!config.enableLiveStatus) return { status: "disabled", isLive: null };
  const url = config.streamer.apiTemplate.replace(
    "{username}",
    encodeURIComponent(config.streamer.username),
  );

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(config.streamer.timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (typeof data?.isLive !== "boolean") throw new Error("Response did not contain boolean isLive.");
    return {
      status: "ok",
      isLive: data.isLive,
      username: config.streamer.username,
      name: config.streamer.name,
      liveUrl: `https://www.tiktok.com/@${config.streamer.username}/live`,
    };
  } catch (error) {
    return {
      status: "error",
      isLive: null,
      error: error instanceof Error ? error.message : String(error),
      username: config.streamer.username,
      name: config.streamer.name,
      liveUrl: `https://www.tiktok.com/@${config.streamer.username}/live`,
    };
  }
}

export async function readLatestLiveAlert(client, config) {
  if (!config.readExternalBotMessages || !config.channels.streamAlerts || !config.bots.liveNotify) {
    return null;
  }
  try {
    const messages = await fetchRecentMessagesByAuthor(
      client,
      config.channels.streamAlerts,
      config.bots.liveNotify,
      config.messageScanLimit,
    );
    const message = messages.find((item) => /is LIVE!/i.test(item.content ?? ""));
    return message ? { messageId: message.id, createdAt: message.createdAt } : null;
  } catch {
    return null;
  }
}
