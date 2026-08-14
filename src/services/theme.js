import { firstEmoji } from "../utils/text.js";

function phaseForHour(hour) {
  if (hour < 6) return "lateNight";
  if (hour < 11) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 20) return "sunset";
  return "evening";
}

function localHour(timeZone, date = new Date()) {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number.parseInt(value, 10);
}

const PHASE_COLORS = Object.freeze({
  lateNight: 0x53657d,
  morning: 0xe6b65d,
  afternoon: 0x87a8b9,
  sunset: 0xd8846c,
  evening: 0x68759b,
});

const WEATHER_COLORS = new Map([
  ["⛈️", 0x58627a],
  ["⚡", 0x6a6685],
  ["🌧️", 0x66879b],
  ["☔", 0x66879b],
  ["🌨️", 0xa6b9c7],
  ["❄️", 0xa6b9c7],
  ["☃️", 0xa6b9c7],
  ["🌫️", 0x8c989e],
  ["💨", 0x7897a3],
  ["🍃", 0x789b7a],
  ["☁️", 0x87a8b9],
  ["🌥️", 0x91a9b3],
]);

export async function collectTheme(client, config, guild) {
  const homeChannel = await client.channels.fetch(config.homeChannelId);
  const parent = homeChannel?.parent ?? (homeChannel?.parentId ? await client.channels.fetch(homeChannel.parentId) : null);
  const channelEmoji = firstEmoji(homeChannel?.name);
  const categoryEmoji = firstEmoji(parent?.name);
  const emoji = config.syncDaykeeperTheme ? (channelEmoji ?? categoryEmoji ?? "☁️") : "☁️";
  const phase = phaseForHour(localHour(config.displayTimeZone));
  const accent = config.dynamicAccent
    ? WEATHER_COLORS.get(emoji) ?? PHASE_COLORS[phase] ?? config.accentColor
    : config.accentColor;

  return {
    emoji,
    accent,
    phase,
    homeChannelName: homeChannel?.name ?? null,
    categoryName: parent?.name ?? null,
    guildName: guild.name,
  };
}
