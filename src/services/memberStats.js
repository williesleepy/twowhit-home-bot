import { matchGuideToRole } from "./forums.js";

const initializedGuilds = new Set();

async function ensureMemberCache(guild) {
  if (initializedGuilds.has(guild.id)) return;
  await guild.members.fetch();
  initializedGuilds.add(guild.id);
}

export async function collectMemberStats(guild, config, fighterGuideIndex) {
  const fallback = {
    available: false,
    memberCount: guild.memberCount,
    humanCount: null,
    botCount: null,
    totCount: null,
    smasherCount: null,
    streamNotificationCount: null,
    playNotificationCount: null,
    topFighters: [],
  };

  if (!config.enableMemberStats) return fallback;

  try {
    await ensureMemberCache(guild);
    const members = [...guild.members.cache.values()];
    const humans = members.filter((member) => !member.user.bot);
    const bots = members.length - humans.length;
    const countRole = (roleId) => roleId
      ? humans.filter((member) => member.roles.cache.has(roleId)).length
      : null;

    const fighterRoles = [];
    for (const role of guild.roles.cache.values()) {
      const guide = matchGuideToRole(role, fighterGuideIndex);
      if (!guide) continue;
      const count = humans.filter((member) => member.roles.cache.has(role.id)).length;
      fighterRoles.push({
        roleId: role.id,
        roleName: role.name,
        fighterName: guide.name,
        guideUrl: guide.url,
        count,
      });
    }

    fighterRoles.sort((a, b) => b.count - a.count || a.fighterName.localeCompare(b.fighterName));

    return {
      available: true,
      memberCount: guild.memberCount,
      humanCount: humans.length,
      botCount: bots,
      totCount: countRole(config.roles.tot),
      smasherCount: countRole(config.roles.smasher),
      streamNotificationCount: countRole(config.roles.streamNotifications),
      playNotificationCount: countRole(config.roles.playNotifications),
      topFighters: fighterRoles.filter((item) => item.count > 0).slice(0, config.limits.topFighters),
    };
  } catch (error) {
    console.warn("[home] Member stats unavailable:", error?.message ?? error);
    return fallback;
  }
}
