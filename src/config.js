function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function id(name, { required: isRequired = false } = {}) {
  const value = isRequired ? required(name) : optional(name);
  if (!value) return null;
  if (!/^\d{17,20}$/.test(value)) throw new Error(`${name} must be a Discord snowflake ID.`);
  return value;
}

function flag(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`${name} must be true or false.`);
}

function integer(name, fallback, min, max) {
  const raw = process.env[name]?.trim();
  const value = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} through ${max}.`);
  }
  return value;
}

function color(name, fallback) {
  const raw = optional(name, fallback).replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(raw)) return Number.parseInt(raw, 16);
  if (/^\d+$/.test(raw)) {
    const value = Number.parseInt(raw, 10);
    if (value >= 0 && value <= 0xffffff) return value;
  }
  throw new Error(`${name} must be a #RRGGBB hex color or integer RGB value.`);
}

function timeZone(name, fallback) {
  const value = optional(name, fallback);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    throw new Error(`${name} is not a recognized IANA time zone.`);
  }
  return value;
}

export function loadConfig() {
  const liveApiTemplate = optional(
    "LIVE_STATUS_API_URL_TEMPLATE",
    "https://tiktok-live-api-0k0j.onrender.com/live/{username}",
  );
  if (!liveApiTemplate.includes("{username}")) {
    throw new Error("LIVE_STATUS_API_URL_TEMPLATE must contain {username}.");
  }

  return Object.freeze({
    token: required("DISCORD_TOKEN"),
    guildId: id("GUILD_ID", { required: true }),
    homeChannelId: id("HOME_CHANNEL_ID", { required: true }),
    homeMessageId: id("HOME_MESSAGE_ID"),
    displayTimeZone: timeZone("DISPLAY_TIME_ZONE", "America/Chicago"),
    refreshIntervalSeconds: integer("REFRESH_INTERVAL_SECONDS", 300, 60, 86400),
    eventRefreshDebounceMs: integer("EVENT_REFRESH_DEBOUNCE_MS", 2500, 250, 60000),
    messageScanLimit: integer("MESSAGE_SCAN_LIMIT", 50, 1, 100),
    tagline: optional("HOME_TAGLINE", "Your little corner of the internet."),
    syncDaykeeperTheme: flag("SYNC_DAYKEEPER_THEME", true),
    dynamicAccent: flag("DYNAMIC_ACCENT", true),
    accentColor: color("ACCENT_COLOR", "87A8B9"),
    readExternalBotMessages: flag("READ_EXTERNAL_BOT_MESSAGES", true),
    enableMemberStats: flag("ENABLE_MEMBER_STATS", true),
    enableVoiceActivity: flag("ENABLE_VOICE_ACTIVITY", true),
    enableLiveStatus: flag("ENABLE_LIVE_STATUS", true),
    showDeutschBuddy: flag("SHOW_DEUTSCH_BUDDY", true),
    showSuggestions: flag("SHOW_SUGGESTIONS", true),
    showLatestAnnouncement: flag("SHOW_LATEST_ANNOUNCEMENT", true),
    streamer: Object.freeze({
      username: optional("STREAMER_USERNAME", "twowhitaker").replace(/^@/, ""),
      name: optional("STREAMER_NAME", "twoWhit"),
      apiTemplate: liveApiTemplate,
      timeoutMs: integer("LIVE_STATUS_TIMEOUT_MS", 10000, 1000, 60000),
    }),
    limits: Object.freeze({
      playDeskPeople: integer("MAX_PLAY_DESK_PEOPLE", 3, 1, 10),
      todayTournaments: integer("MAX_TODAY_TOURNAMENTS", 2, 1, 5),
      liveBroadcasts: integer("MAX_LIVE_BROADCASTS", 2, 1, 5),
      topFighters: integer("MAX_TOP_FIGHTERS", 3, 1, 5),
      announcementChars: integer("MAX_ANNOUNCEMENT_CHARS", 220, 80, 500),
    }),
    channels: Object.freeze({
      rules: id("RULES_CHANNEL_ID"),
      announcements: id("ANNOUNCEMENTS_CHANNEL_ID"),
      suggestions: id("SUGGESTIONS_CHANNEL_ID"),
      general: id("GENERAL_CHANNEL_ID"),
      media: id("MEDIA_CHANNEL_ID"),
      lounge: id("LOUNGE_CHANNEL_ID"),
      gameRoom: id("GAME_ROOM_CHANNEL_ID"),
      memberUpdates: id("MEMBER_UPDATES_CHANNEL_ID"),
      streamAlerts: id("STREAM_ALERTS_CHANNEL_ID"),
      playAlerts: id("PLAY_ALERTS_CHANNEL_ID"),
      deutschBuddy: id("DEUTSCH_BUDDY_CHANNEL_ID"),
      tallGrass: id("TALL_GRASS_CHANNEL_ID"),
      playDesk: id("PLAY_DESK_CHANNEL_ID"),
      tournamentStreams: id("TOURNAMENT_STREAMS_CHANNEL_ID"),
      fighterGuides: id("FIGHTER_GUIDES_CHANNEL_ID"),
      ultimateGuide: id("ULTIMATE_GUIDE_CHANNEL_ID"),
    }),
    bots: Object.freeze({
      liveNotify: id("LIVE_NOTIFY_BOT_ID"),
      daykeeper: id("DAYKEEPER_BOT_ID"),
      deutschBuddy: id("DEUTSCH_BUDDY_BOT_ID"),
      streamGuide: id("STREAM_GUIDE_BOT_ID"),
      playDesk: id("PLAY_DESK_BOT_ID"),
      roleRecovery: id("ROLE_RECOVERY_BOT_ID"),
    }),
    roles: Object.freeze({
      tot: id("TOT_ROLE_ID"),
      smasher: id("SMASHER_ROLE_ID"),
      streamNotifications: id("STREAM_NOTIFICATIONS_ROLE_ID"),
      playNotifications: id("PLAY_NOTIFICATIONS_ROLE_ID"),
    }),
  });
}
