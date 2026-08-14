# TwoWhit Home Bot

A standalone, stateless Discord bot that maintains one live **Components V2 Home dashboard** for TwoWhit’s Tots.

It is designed to run as its own Render Background Worker and to observe the server’s existing services rather than replacing or tightly coupling to them.

## What Home shows

The dashboard can surface, in one message:

- current server member / Smasher / Tot counts;
- twoWhit live/offline status, using the same live-status API as Live Notify;
- current Play Desk availability, including game, intent, focus, and expiration;
- Stream Guide state: live broadcasts, today’s tournaments, or the current weekly count;
- live Ultimate Guide and Fighter Guide thread counts;
- the server’s most-selected fighters;
- personalized **My Fighter Guides** and **My Setup** buttons;
- latest human announcement;
- latest suggestion and workflow status;
- today’s Deutsch Buddy vocabulary / quiz readiness;
- current activity in the configured voice rooms;
- automatic Home title emoji/accent synchronization with Daykeeper-style channel/category changes.

The bot does **not** expose Role Recovery on the public Home page. Role Recovery is administrative migration/recovery machinery, not a community-facing service.

## Design goals

### No persistent storage

There is no database and no state file. Home can be restarted or redeployed at any time.

On startup it:

1. uses `HOME_MESSAGE_ID` if you explicitly configured one; otherwise
2. scans recent messages in `HOME_CHANNEL_ID` for a Components V2 message authored by itself containing `home:*` actions; then
3. edits that message in place, or creates a new one if no Home message exists.

If the message is deleted while the bot is running, Home recreates it.

### Live sources, not archive constants

The IDs in `.env.example` come from the supplied server archive, but the content of the page is resolved from live Discord/API state whenever possible. Channel names can change without breaking links because IDs are used.

Fighter roles are not hard-coded. Home builds a live index from Fighter Guide forum thread names, matches that index to guild roles, and derives both fighter popularity and a member’s personalized guide list from their current roles.

### Observe other bots; do not impersonate them

Home reads Play Desk and Stream Guide output, but it never copies their interactive `custom_id` buttons. Discord interactions belong to the application that created the message, so Home links members to those services instead.

### Event-driven + periodic

The five-minute interval is a safety refresh. Most visible server changes request a debounced refresh immediately:

- Play Desk / Stream Guide / Deutsch Buddy / Live Notify messages;
- announcements;
- guide or suggestion threads;
- member joins/leaves/role changes;
- Daykeeper channel/category renames;
- activity in the configured voice rooms;
- guild changes.

Home hashes the collected semantic data and skips the actual Discord edit when nothing meaningful changed.

## Requirements

- Node.js 24.17+
- a Discord bot application/token for the separate Home bot
- `discord.js` 14.27.0

For the richest dashboard, enable these intents in the Discord Developer Portal:

- **Message Content Intent** — required for reading Components V2/embed/message content authored by the other bots;
- **Server Members Intent** — required for live role counts, fighter popularity, and full member statistics.

`Guilds` and `GuildVoiceStates` are non-privileged gateway intents requested by the code as needed.

The dashboard still works with reduced data if the optional privileged enrichments are disabled in `.env`.

### Discord permissions

Give the Home bot access to the channels it observes. The practical minimum for this package is **View Channels**, **Read Message History**, and **Send Messages** in the Home channel, plus visibility/read-history access to Play Desk, Tournament Streams, Deutsch Buddy, Stream Alerts, Announcements, Suggestions, Fighter Guides, and Ultimate Guide. If the Home channel is intentionally read-only for members, add an explicit overwrite that lets the Home bot send there.

The bot does not need permission to manage roles, manage channels, moderate members, or administer the server.

## Local setup

```bash
cp .env.example .env
# Put the Home bot token in DISCORD_TOKEN.
npm install
npm start
```

For development:

```bash
npm run dev
```

Tests and syntax checks:

```bash
npm test
npm run check
```

## Render deployment

The included `render.yaml` defines a Node **background worker**. The only value intentionally not committed is `DISCORD_TOKEN`.

Typical flow:

1. push this directory to GitHub;
2. create a Render Blueprint from the repository, or create a Background Worker manually;
3. set `DISCORD_TOKEN` in Render;
4. deploy.

The existing channel IDs, bot IDs, and role IDs from the supplied archive are already represented in `render.yaml` and `.env.example`.

If `🌥️┃welcome` is renamed to `home`, **do not change `HOME_CHANNEL_ID`**. A rename does not change the channel ID.

## Important environment switches

| Variable | Default | Purpose |
| --- | --- | --- |
| `READ_EXTERNAL_BOT_MESSAGES` | `true` | Read Play Desk, Stream Guide, Live Notify, Deutsch Buddy and announcements. |
| `ENABLE_MEMBER_STATS` | `true` | Fetch members for human/bot counts, role counts, fighter popularity and personalized setup. |
| `ENABLE_VOICE_ACTIVITY` | `true` | Show occupied Lounge/Game Room voice channels and refresh on voice-state changes. |
| `ENABLE_LIVE_STATUS` | `true` | Query the same live-status endpoint used by Live Notify. |
| `SYNC_DAYKEEPER_THEME` | `true` | Use the current Home/category leading emoji. |
| `DYNAMIC_ACCENT` | `true` | Pick a phase/weather-friendly Components V2 container accent. |
| `SHOW_DEUTSCH_BUDDY` | `true` | Show today’s vocabulary/quiz state. |
| `SHOW_SUGGESTIONS` | `true` | Include suggestion forum state. |
| `SHOW_LATEST_ANNOUNCEMENT` | `true` | Surface the newest human-authored announcement. |

See `.env.example` for every limit and ID.

## Personalized buttons

### My Fighter Guides

Home reads the clicking member’s fighter roles and replies ephemerally with direct links to only those fighter-guide threads. If the member has no fighter roles, it points them to Channels & Roles / the full Fighter Guides forum.

### My Setup

Home replies ephemerally with the member’s current:

- TwoWhit / Smash interest roles;
- Stream and Play notification roles;
- selected fighters;
- display color role, when recognizable.

Nothing is saved by Home; every click uses the member’s current Discord roles.

## Failure behavior

Each external integration is isolated. If one service/API/channel cannot be read, Home renders a useful fallback instead of failing the entire dashboard. The periodic safety refresh gives transient failures another chance automatically.

Live Notify’s old alert message is never treated as proof that twoWhit is still live; the direct status API is authoritative for current live/offline state. The alert is only used as contextual “last go-live alert” metadata.

Forum thread reads are cached in memory for five minutes and invalidated on live thread events. Archived-thread collection is paginated, so future guide/suggestion growth beyond 100 archived threads does not silently disappear from counts.

## Repository map

```text
src/
  dashboard/
    buildHomeDashboard.js      # Components V2 presentation
    HomeDashboardManager.js    # discovery, refresh, edit/recreate lifecycle
  interactions/
    handleHomeInteraction.js   # Home-owned buttons
  services/
    playDesk.js
    streamGuide.js
    liveStatus.js
    deutschBuddy.js
    forums.js
    memberStats.js
    voiceActivity.js
    announcements.js
    theme.js
    homeData.js                # integration orchestration
  utils/
    discord.js
    text.js
  config.js
  index.js
```

For the audit of the six supplied services and the exact integration strategy, see [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md). For a compact server/channel map, see [`docs/SERVER_SURFACES.md`](docs/SERVER_SURFACES.md).

## Link-label safety

Home flattens Discord mentions and other clickable Discord tokens before placing announcement text inside Markdown links. For example, an announcement title containing `<#CHANNEL_ID>` is displayed as `#channel-name` inside the Home link instead of nesting a clickable channel mention inside another link. The same shared link builder safely escapes suggestion titles and other Markdown-sensitive link labels.
