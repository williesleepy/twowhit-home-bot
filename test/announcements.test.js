import test from "node:test";
import assert from "node:assert/strict";
import { flattenDiscordLinkables, summarizeAnnouncement } from "../src/services/announcements.js";

function collection(entries) {
  return new Map(entries);
}

const channelId = "1537098759660503180";
const userId = "111111111111111111";
const roleId = "222222222222222222";

const message = {
  mentions: {
    channels: collection([[channelId, { name: "fighter-labs" }]]),
    users: collection([[userId, { username: "Approacher", globalName: null }]]),
    roles: collection([[roleId, { name: "Smasher" }]]),
  },
  guild: {
    channels: { cache: new Map() },
    members: { cache: new Map() },
    roles: { cache: new Map() },
  },
};

test("announcement summary flattens channel mentions before using them as a link label", () => {
  const content = `@everyone\n\n**🧪 Fighter Labs → <#${channelId}>**`;
  assert.equal(
    summarizeAnnouncement(content, 220, message),
    "🧪 Fighter Labs → fighter-labs",
  );
});

test("announcement summary flattens Discord user and role mentions", () => {
  const content = `**Welcome <@${userId}> to <@&${roleId}>**`;
  assert.equal(
    summarizeAnnouncement(content, 220, message),
    "Welcome Approacher to Smasher",
  );
});

test("announcement summary cannot create a nested markdown link", () => {
  const content = "**Read [the guide](https://example.com/guide) [today]**";
  assert.equal(
    summarizeAnnouncement(content, 220, message),
    "Read the guide [today]",
  );
});

test("flattenDiscordLinkables converts other clickable Discord tokens to plain text", () => {
  const text = "<:bowser:123456789012345678> </play desk:333333333333333333> <https://example.com> <t:1786723200:D>";
  assert.equal(
    flattenDiscordLinkables(text, message),
    ":bowser: play desk external link 2026-08-14",
  );
});

import { markdownLink } from "../src/utils/text.js";

test("markdownLink safely escapes labels used by announcements and suggestions", () => {
  assert.equal(
    markdownLink("Idea [beta] *test*", "https://discord.com/channels/a/b", 120),
    "[Idea \\[beta\\] \\*test\\*](https://discord.com/channels/a/b)",
  );
});
