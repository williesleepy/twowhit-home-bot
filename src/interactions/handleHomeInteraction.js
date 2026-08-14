import { MessageFlags } from "discord.js";
import { channelUrl } from "../utils/discord.js";
import { humanizeRoleName, normalizeLookupName } from "../utils/text.js";

const COLOR_NAMES = new Set([
  "red", "pink", "orange", "yellow", "green", "cyan", "blue", "purple", "brown", "gray", "white", "black",
]);

function roleIdsFromInteraction(interaction) {
  const member = interaction.member;
  if (!member) return [];
  if (member.roles?.cache) return [...member.roles.cache.keys()];
  if (Array.isArray(member.roles)) return member.roles;
  if (Array.isArray(member._roles)) return member._roles;
  return [];
}

async function reply(interaction, content) {
  const payload = {
    content,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function roleMap(interaction) {
  const guild = interaction.guild;
  if (!guild) return new Map();
  await guild.roles.fetch().catch(() => null);
  return guild.roles.cache;
}

function selectedFighterGuides(roleIds, roles, guideIndex) {
  const selected = [];
  for (const roleId of roleIds) {
    const role = roles.get(roleId);
    if (!role) continue;
    const key = normalizeLookupName(humanizeRoleName(role.name));
    const guide = guideIndex?.[key];
    if (guide) selected.push({ role, guide });
  }
  return selected.sort((a, b) => a.guide.threadName.localeCompare(b.guide.threadName, undefined, { numeric: true }));
}

async function showMyFighters(interaction, data, config) {
  const roles = await roleMap(interaction);
  const selected = selectedFighterGuides(
    roleIdsFromInteraction(interaction),
    roles,
    data?.fighterGuides?.index ?? {},
  );

  if (!data?.fighterGuides?.count) {
    return reply(interaction, `🎮 **Fighter guides are temporarily unavailable.**\nOpen <#${config.channels.fighterGuides}> directly.`);
  }

  if (!selected.length) {
    return reply(
      interaction,
      `🎮 **You don’t currently have any fighter roles selected.**\nChoose your fighters in **Channels & Roles**, or browse all **${data.fighterGuides.count}** guides in <#${config.channels.fighterGuides}>.`,
    );
  }

  const visible = selected.slice(0, 15);
  const lines = [
    "## 🎮 Your Fighter Guides",
    ...visible.map(({ guide }) => `• [${guide.name}](${guide.url})`),
  ];
  if (selected.length > visible.length) {
    lines.push(`-# +${selected.length - visible.length} more selected fighters — browse the full forum in <#${config.channels.fighterGuides}>.`);
  }
  return reply(interaction, lines.join("\n"));
}

async function showMySetup(interaction, data, config) {
  const roles = await roleMap(interaction);
  const ids = new Set(roleIdsFromInteraction(interaction));
  const selected = selectedFighterGuides([...ids], roles, data?.fighterGuides?.index ?? {});

  const interest = [];
  if (config.roles.tot && ids.has(config.roles.tot)) interest.push("📺 TwoWhit / community");
  if (config.roles.smasher && ids.has(config.roles.smasher)) interest.push("🎮 Super Smash Bros. Ultimate");

  const notifications = [
    `${config.roles.streamNotifications && ids.has(config.roles.streamNotifications) ? "✅" : "➖"} Stream notifications`,
    `${config.roles.playNotifications && ids.has(config.roles.playNotifications) ? "✅" : "➖"} Play notifications`,
  ];

  const colorRole = [...ids]
    .map((id) => roles.get(id))
    .find((role) => role && COLOR_NAMES.has(humanizeRoleName(role.name).toLowerCase()));

  const fighterNames = selected.map(({ guide }) => guide.name);
  const fighters = fighterNames.length
    ? `${fighterNames.slice(0, 12).join(" · ")}${fighterNames.length > 12 ? ` · +${fighterNames.length - 12} more` : ""}`
    : "None selected";

  const lines = [
    "## 👤 Your Server Setup",
    `**Here for:** ${interest.length ? interest.join(" · ") : "No interest roles selected"}`,
    `**Notifications:** ${notifications.join(" · ")}`,
    `**Fighters:** ${fighters}`,
    `**Display color:** ${colorRole?.name ?? "Default / fighter role"}`,
    "",
    "Use **Channels & Roles** in Discord whenever you want to change these.",
  ];

  if (config.channels.fighterGuides && fighterNames.length) {
    lines.push(`Browse your character resources in <#${config.channels.fighterGuides}>.`);
  }
  return reply(interaction, lines.join("\n"));
}

export async function handleHomeInteraction(interaction, dashboard, config) {
  if (!interaction.isButton() || !interaction.customId.startsWith("home:")) return false;
  if (interaction.guildId !== config.guildId) {
    await reply(interaction, "This Home button only works in TwoWhit’s Tots.");
    return true;
  }

  const data = dashboard.lastData;
  if (!data) {
    await reply(interaction, "Home is still loading its server data. Try the button again in a moment.");
    return true;
  }

  try {
    if (interaction.customId === "home:my-fighters") {
      await showMyFighters(interaction, data, config);
      return true;
    }
    if (interaction.customId === "home:my-setup") {
      await showMySetup(interaction, data, config);
      return true;
    }
    await reply(interaction, "That Home action is no longer available.");
  } catch (error) {
    console.error("[home] Interaction failed:", error);
    await reply(interaction, "Something went wrong while opening that Home action.").catch(() => null);
  }
  return true;
}
