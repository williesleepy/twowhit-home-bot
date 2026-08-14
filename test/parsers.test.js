import test from "node:test";
import assert from "node:assert/strict";
import { parsePlayDeskPanel } from "../src/services/playDesk.js";
import { parseStreamGuidePanel } from "../src/services/streamGuide.js";
import { parseVocabularyDescription } from "../src/services/deutschBuddy.js";
import { stripGuideNumber } from "../src/utils/text.js";

function playDeskComponents(statusChildren) {
  return [{
    type: 17,
    components: [
      { type: 10, content: "# 🎮 Play Desk\nA quiet way to see who is around right now." },
      ...statusChildren,
    ],
  }];
}

test("parses an empty Play Desk panel", () => {
  const result = parsePlayDeskPanel(playDeskComponents([
    { type: 10, content: "**Nobody is currently looking.**\nMark yourself available and Play Desk will handle the rest." },
  ]));
  assert.equal(result.availableCount, 0);
  assert.deepEqual(result.people, []);
});

test("parses Play Desk people, intent, focus, and expiry", () => {
  const result = parsePlayDeskPanel(playDeskComponents([
    { type: 10, content: "**2 people are available**" },
    {
      type: 9,
      components: [{ type: 10, content: "**<@12345678901234567>** · Super Smash Bros. Ultimate\nMatchup practice · until <t:1786680000:t> · <t:1786680000:R>\n-# Bowser practice" }],
      accessory: { type: 2, custom_id: "pd:join:abc", label: "Join", style: 3 },
    },
    {
      type: 9,
      components: [{ type: 10, content: "**<@22345678901234567>** · Other game\nCasual games · until <t:1786680300:t> · <t:1786680300:R>" }],
      accessory: { type: 2, custom_id: "pd:join:def", label: "Join", style: 3 },
    },
  ]));
  assert.equal(result.availableCount, 2);
  assert.equal(result.people.length, 2);
  assert.equal(result.people[0].userId, "12345678901234567");
  assert.equal(result.people[0].game, "Super Smash Bros. Ultimate");
  assert.equal(result.people[0].intent, "Matchup practice");
  assert.equal(result.people[0].focus, "Bowser practice");
});

test("parses Stream Guide today/live/weekly state", () => {
  const components = [
    { type: 10, content: "# 📺 Stream Guide\n**Week of August 10–16**\n-# Last refreshed: 12:45 AM ET" },
    { type: 10, content: "## 🔥 Happening Today" },
    { type: 17, components: [{ type: 10, content: "### ATKO x CEO : THE PRE-GAME!\n🎮 Ultimate + Melee\n📅 Thursday, August 13\n📍 Orlando, FL\n👥 153 entrants\n🔗 [Tournament page](https://www.start.gg/tournament/example)\n\n**Broadcasts**\n🔴 **LIVE** — [HUNGRYBOX](https://www.twitch.tv/HUNGRYBOX)\nMelee · Winners Semi-Final\n**Player A vs Player B**\n⚫ **Offline** — [Other](https://www.twitch.tv/other)" }] },
    { type: 10, content: "## 📅 Also This Week" },
    { type: 17, components: [{ type: 10, content: "### Saturday Major\n🎮 Ultimate\n📅 Saturday, August 15\n📍 Chicago, IL\n👥 300 entrants\n🔗 [Tournament page](https://www.start.gg/tournament/example2)" }] },
  ];
  const result = parseStreamGuidePanel(components);
  assert.equal(result.week, "Week of August 10–16");
  assert.equal(result.today.length, 1);
  assert.equal(result.weekly.length, 1);
  assert.equal(result.liveBroadcasts.length, 1);
  assert.equal(result.liveBroadcasts[0].name, "HUNGRYBOX");
  assert.equal(result.liveBroadcasts[0].tournament, "ATKO x CEO : THE PRE-GAME!");
});

test("parses Deutsch Buddy word embeds", () => {
  const words = parseVocabularyDescription(
    "**1. die Dusche** — shower\n*Die Dusche ist frei.*\n↳ The shower is free.\n\n**2. die Schwester** — sister\n*Meine Schwester kommt.*\n↳ My sister is coming.",
  );
  assert.deepEqual(words, [
    { german: "die Dusche", english: "shower" },
    { german: "die Schwester", english: "sister" },
  ]);
});


test("strips single and ranged Fighter Guide numbering", () => {
  assert.equal(stripGuideNumber("01. 🍄 Mario"), "🍄 Mario");
  assert.equal(stripGuideNumber("33–35 ⚪ Pokémon Trainer"), "⚪ Pokémon Trainer");
  assert.equal(stripGuideNumber("79-80 🔥 Pyra / Mythra"), "🔥 Pyra / Mythra");
});
