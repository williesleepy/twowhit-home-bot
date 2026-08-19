import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeDashboard, countComponents } from "../src/dashboard/buildHomeDashboard.js";

const config = {
  guildId: "1533152480328941778",
  tagline: "Your little corner of the internet.",
  accentColor: 0x87a8b9,
  streamer: { name: "twoWhit" },
  limits: { playDeskPeople: 3, todayTournaments: 2, liveBroadcasts: 2 },
  channels: {
    rules: "1", announcements: "2", general: "3", media: "4", tallGrass: "5", suggestions: "6",
    playDesk: "7", tournamentStreams: "8", ultimateGuide: "9", fighterGuides: "10",
    streamAlerts: "11", playAlerts: "12", deutschBuddy: "13",
  },
};

const data = {
  guild: { name: "TwoWhit’s Tots", memberCount: 53 },
  theme: { emoji: "☁️", accent: 0x87a8b9 },
  channelIcons: { general: "🌤️", announcements: "📯", suggestions: "🌱" },
  members: {
    available: true,
    smasherCount: 32,
    totCount: 37,
    topFighters: [
      { fighterName: "Bowser", count: 12 },
      { fighterName: "Kirby", count: 8 },
      { fighterName: "Joker", count: 7 },
    ],
  },
  live: { isLive: true, liveUrl: "https://www.tiktok.com/@twowhitaker/live" },
  latestLiveAlert: null,
  playDesk: {
    data: {
      availableCount: 2,
      people: [
        { userId: "12345678901234567", game: "Super Smash Bros. Ultimate", intent: "Casual games", focus: "Bowser", expiresAt: Date.now() + 3600000 },
        { userId: "22345678901234567", game: "Super Smash Bros. Ultimate", intent: "Matchup practice", focus: null, expiresAt: Date.now() + 3600000 },
      ],
    },
  },
  streamGuide: {
    data: {
      week: "Week of August 10–16",
      today: [{ name: "ATKO x CEO", games: "Ultimate + Melee", entrants: "153 entrants" }],
      weekly: [],
      liveBroadcasts: [{ name: "HUNGRYBOX", url: "https://twitch.tv/hungrybox", tournament: "ATKO x CEO", context: ["Melee · Winners Semi-Final"] }],
    },
  },
  ultimateGuide: { count: 20 },
  fighterGuides: { count: 86 },
  announcement: { summary: "Fighter Labs and Ultimate Guide are live", url: "https://discord.com/channels/a/b/c" },
  suggestions: { count: 1, latest: { name: "Chat tournament", url: "https://discord.com/channels/a/b/c", tags: ["🎉 Event"] } },
  deutsch: { status: "ok", data: { postedToday: true, quizReady: true, words: [{ german: "kommen" }, { german: "die Dusche" }, { german: "die Schwester" }] } },
};

test("full Home dashboard stays below Discord's 40 component limit", () => {
  const dashboard = buildHomeDashboard(data, config, { changedAt: new Date() });
  assert.ok(countComponents(dashboard) <= 40);
  assert.equal(dashboard.type, 17);
  assert.ok(dashboard.components.some((component) => component.type === 1 && component.components.some((button) => button.custom_id === "home:my-fighters")));
  const dashboardText = dashboard.components
    .flatMap((component) => component.components ?? [component])
    .filter((component) => component?.type === 10)
    .map((component) => component.content)
    .join("\n");
  assert.match(dashboardText, /## 🔴 Live Tournament Streams/);
  assert.doesNotMatch(dashboardText, /Smash is live/);
});


test("dynamic community titles are never used as Markdown link labels", () => {
  const riskyData = {
    ...data,
    announcement: {
      summary: "🧪 Fighter Labs → fighter-labs",
      url: "https://discord.com/channels/a/b/announcement",
    },
    suggestions: {
      count: 1,
      latest: {
        name: "Idea [beta] #fighter-labs",
        url: "https://discord.com/channels/a/b/suggestion",
        tags: [],
      },
    },
  };

  const dashboard = buildHomeDashboard(riskyData, config, { changedAt: new Date() });
  const renderedText = dashboard.components
    .flatMap((component) => component.components ?? [component])
    .filter((component) => component?.type === 10)
    .map((component) => component.content)
    .join("\n");

  assert.match(
    renderedText,
    /📯 \*\*Latest update:\*\* 🧪 Fighter Labs → fighter-labs · \[Open\]\(https:\/\/discord\.com\/channels\/a\/b\/announcement\)/,
  );
  assert.doesNotMatch(renderedText, /\[🧪 Fighter Labs/);

  assert.match(
    renderedText,
    /🌱 \*\*Latest suggestion:\*\* Idea \[beta\] #fighter-labs · \[Open\]\(https:\/\/discord\.com\/channels\/a\/b\/suggestion\)/,
  );
  assert.doesNotMatch(renderedText, /\[Idea/);
});

test("community icons follow the current channel-name emojis with safe fallbacks", () => {
  const dynamicDashboard = buildHomeDashboard(data, config, { changedAt: new Date() });
  const dynamicText = dynamicDashboard.components
    .flatMap((component) => component.components ?? [component])
    .filter((component) => component?.type === 10)
    .map((component) => component.content)
    .join("\n");

  assert.match(dynamicText, /## 🌤️ Around the server/);
  assert.match(dynamicText, /📯 \*\*Latest update:/);
  assert.match(dynamicText, /🌱 \*\*Latest suggestion:/);

  const fallbackDashboard = buildHomeDashboard(
    { ...data, channelIcons: { general: null, announcements: null, suggestions: null } },
    config,
    { changedAt: new Date() },
  );
  const fallbackText = fallbackDashboard.components
    .flatMap((component) => component.components ?? [component])
    .filter((component) => component?.type === 10)
    .map((component) => component.content)
    .join("\n");

  assert.match(fallbackText, /## ☁️ Around the server/);
  assert.match(fallbackText, /🛰️ \*\*Latest update:/);
  assert.match(fallbackText, /💫 \*\*Latest suggestion:/);
});

test("dashboard uses roomy section spacing without bloating list items", () => {
  const dashboard = buildHomeDashboard(data, config, { changedAt: new Date() });

  const separators = dashboard.components.filter((component) => component.type === 14);
  assert.ok(separators.length >= 5);
  assert.ok(separators.every((component) => component.spacing === 2));

  const dashboardText = dashboard.components
    .flatMap((component) => component.components ?? [component])
    .filter((component) => component?.type === 10)
    .map((component) => component.content)
    .join("\n");

  assert.match(dashboardText, /👥 \*\*53 members\*\* · 🎮 \*\*32 Smashers\*\* · 🥔 \*\*37 Tots\*\*\n\n🔴 \*\*twoWhit is live\*\*/);
  assert.match(dashboardText, /## 🟢 Play Desk\n\n\*\*2 people are available right now\*\*\n\n•/);
  assert.match(dashboardText, /## 📚 Learn Smash\n\n\*\*20\*\* Ultimate chapters · \*\*86\*\* fighter guides\n\nMost played here:/);
  assert.match(dashboardText, /## 🌤️ Around the server\n\n📯 \*\*Latest update:/);
  assert.match(dashboardText, /🌱 \*\*Latest suggestion:/);
  assert.match(dashboardText, /### 👋 New here\?\n\nRead the rules/);
});

