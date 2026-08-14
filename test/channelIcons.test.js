import test from "node:test";
import assert from "node:assert/strict";
import { collectChannelIcons } from "../src/services/channelIcons.js";

const config = {
  channels: {
    general: "general-id",
    announcements: "announcements-id",
    suggestions: "suggestions-id",
  },
};

test("collectChannelIcons reads the live leading emoji from each configured channel name", async () => {
  const channels = new Map([
    ["general-id", { name: "🌤️┃general" }],
    ["announcements-id", { name: "📯┃announcements" }],
    ["suggestions-id", { name: "🌱┃suggestions" }],
  ]);
  const client = {
    channels: {
      cache: channels,
      fetch: async (id) => channels.get(id) ?? null,
    },
  };

  assert.deepEqual(await collectChannelIcons(client, config), {
    general: "🌤️",
    announcements: "📯",
    suggestions: "🌱",
  });
});

test("collectChannelIcons isolates channel lookup failures", async () => {
  const channels = new Map([
    ["general-id", { name: "☀️┃general" }],
    ["suggestions-id", { name: "✨┃suggestions" }],
  ]);
  const client = {
    channels: {
      cache: channels,
      fetch: async (id) => {
        if (id === "announcements-id") throw new Error("missing channel");
        return channels.get(id) ?? null;
      },
    },
  };

  assert.deepEqual(await collectChannelIcons(client, config), {
    general: "☀️",
    announcements: null,
    suggestions: "✨",
  });
});
