export function channelUrl(guildId, channelId) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

export function messageUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function discordTimestamp(value, style = "R") {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor(date.getTime() / 1000);
  return `<t:${seconds}:${style}>`;
}

export function snowflakeTimestamp(id) {
  if (!id || !/^\d+$/.test(String(id))) return null;
  const discordEpoch = 1420070400000n;
  return Number((BigInt(id) >> 22n) + discordEpoch);
}

export function componentJson(value) {
  if (!value) return value;
  return typeof value.toJSON === "function" ? value.toJSON() : value;
}

export function walkComponents(input, visitor) {
  function walk(value) {
    if (!value) return;
    const node = componentJson(value);
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    visitor(node);
    if (Array.isArray(node.components)) walk(node.components);
    if (node.accessory) walk(node.accessory);
    if (node.component) walk(node.component);
  }
  walk(input);
}

export function containsCustomId(input, prefix = "home:") {
  let found = false;
  walkComponents(input, (node) => {
    if (typeof node.custom_id === "string" && node.custom_id.startsWith(prefix)) found = true;
  });
  return found;
}
