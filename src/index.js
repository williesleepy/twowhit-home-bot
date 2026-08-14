import { loadEnvFile } from "node:process";
import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { loadConfig } from "./config.js";
import { HomeDashboardManager } from "./dashboard/HomeDashboardManager.js";
import { handleHomeInteraction } from "./interactions/handleHomeInteraction.js";
import { invalidateForumCache } from "./services/forums.js";

try {
  loadEnvFile();
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const config = loadConfig();
const intents = [GatewayIntentBits.Guilds];
if (config.readExternalBotMessages) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}
if (config.enableMemberStats) intents.push(GatewayIntentBits.GuildMembers);
if (config.enableVoiceActivity) intents.push(GatewayIntentBits.GuildVoiceStates);

const client = new Client({ intents });
const dashboard = new HomeDashboardManager(client, config);
let shuttingDown = false;

const watchedMessageChannels = new Set([
  config.channels.announcements,
  config.channels.streamAlerts,
  config.channels.playDesk,
  config.channels.tournamentStreams,
  config.channels.deutschBuddy,
].filter(Boolean));
const watchedForumChannels = new Set([
  config.channels.suggestions,
  config.channels.fighterGuides,
  config.channels.ultimateGuide,
].filter(Boolean));

function sameGuild(entity) {
  return entity?.guildId === config.guildId || entity?.guild?.id === config.guildId;
}

function watchedMessage(message) {
  return sameGuild(message) && watchedMessageChannels.has(message.channelId);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[home] Logged in as ${readyClient.user.tag}.`);
  console.log(`[home] Server: ${config.guildId}`);
  console.log(`[home] Home channel: ${config.homeChannelId}`);
  console.log(`[home] Periodic safety refresh: every ${config.refreshIntervalSeconds}s`);
  console.log(`[home] External bot reads: ${config.readExternalBotMessages ? "enabled" : "disabled"}`);
  console.log(`[home] Member/fighter stats: ${config.enableMemberStats ? "enabled" : "disabled"}`);
  console.log(`[home] Voice activity: ${config.enableVoiceActivity ? "enabled" : "disabled"}`);
  await dashboard.start();
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleHomeInteraction(interaction, dashboard, config);
});

if (config.readExternalBotMessages) {
  client.on(Events.MessageCreate, (message) => {
    if (watchedMessage(message)) dashboard.requestRefresh(`message-create:${message.channelId}`);
  });
  client.on(Events.MessageUpdate, (_oldMessage, newMessage) => {
    if (watchedMessage(newMessage)) dashboard.requestRefresh(`message-update:${newMessage.channelId}`);
  });
  client.on(Events.MessageDelete, (message) => {
    dashboard.noteMessageDeleted(message.id);
    if (watchedMessage(message)) dashboard.requestRefresh(`message-delete:${message.channelId}`);
  });
}

client.on(Events.ThreadCreate, (thread) => {
  if (sameGuild(thread) && watchedForumChannels.has(thread.parentId)) {
    invalidateForumCache();
    dashboard.requestRefresh(`thread-create:${thread.parentId}`);
  }
});
client.on(Events.ThreadUpdate, (_oldThread, newThread) => {
  if (sameGuild(newThread) && watchedForumChannels.has(newThread.parentId)) {
    invalidateForumCache();
    dashboard.requestRefresh(`thread-update:${newThread.parentId}`);
  }
});
client.on(Events.ThreadDelete, (thread) => {
  if (sameGuild(thread) && watchedForumChannels.has(thread.parentId)) {
    invalidateForumCache();
    dashboard.requestRefresh(`thread-delete:${thread.parentId}`);
  }
});

// Daykeeper changes channel/category names to reflect time/weather. A short debounce
// collapses its batch of edits into one Home refresh.
client.on(Events.ChannelUpdate, (_oldChannel, newChannel) => {
  if (sameGuild(newChannel)) dashboard.requestRefresh("channel-theme-update");
});

if (config.enableMemberStats) {
  client.on(Events.GuildMemberAdd, (member) => {
    if (sameGuild(member)) dashboard.requestRefresh("member-join");
  });
  client.on(Events.GuildMemberRemove, (member) => {
    if (sameGuild(member)) dashboard.requestRefresh("member-leave");
  });
  client.on(Events.GuildMemberUpdate, (_oldMember, newMember) => {
    if (sameGuild(newMember)) dashboard.requestRefresh("member-role-update");
  });
}

if (config.enableVoiceActivity) {
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const relevant = [oldState.channelId, newState.channelId].some((id) =>
      id === config.channels.lounge || id === config.channels.gameRoom,
    );
    if (relevant && (sameGuild(oldState) || sameGuild(newState))) {
      dashboard.requestRefresh("voice-activity");
    }
  });
}

client.on(Events.GuildUpdate, (_oldGuild, newGuild) => {
  if (newGuild.id === config.guildId) dashboard.requestRefresh("guild-update");
});
client.on(Events.Error, (error) => console.error("[discord] Client error:", error));
client.on(Events.Warn, (warning) => console.warn("[discord]", warning));

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[home] Received ${signal}; shutting down.`);
  dashboard.stop();
  client.destroy();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => console.error("[home] Unhandled rejection:", error));
process.on("uncaughtException", (error) => {
  console.error("[home] Uncaught exception:", error);
  void shutdown("uncaughtException");
});

await client.login(config.token);
