# Integration audit

This Home implementation was designed after inspecting all six supplied bot services, not just their rendered Discord messages.

## 1. Play Desk

**Home source:** the current Components V2 panel in the configured Play Desk channel.

Home extracts:

- number of available people;
- each visible member ID;
- game;
- intent;
- optional focus;
- availability expiration.

Home deliberately does **not** copy Play Desk’s `pd:*` buttons. Those interactions belong to the Play Desk application. Home uses an **Open Play Desk** link instead.

This makes the Play Desk panel the cross-service contract and avoids coupling Home to Play Desk’s SQLite database or in-memory session implementation.

## 2. Stream Guide

**Home source:** the current Components V2 Stream Guide message.

Home extracts:

- displayed week;
- tournaments in “Happening Today”;
- tournaments in “Also This Week”;
- any broadcasts marked live, including stream URLs and visible context.

When a broadcast is live, Home gives that state visual priority. Otherwise it falls back to today’s events, then the weekly count.

Home does not need start.gg or Twitch credentials because Stream Guide remains the authority for the curated tournament set.

## 3. Live Notify

**Home source for current state:** the same public live-status API endpoint configured in the Live Notify service.

**Secondary context:** the newest Live Notify message containing `is LIVE!` in the stream-alerts channel.

The direct API determines current live/offline state. A historical Discord alert is never used to claim the stream is still live.

## 4. Deutsch Buddy

**Home source:** today’s Discord output authored by Deutsch Buddy.

Home recognizes:

- `🇩🇪 German Words of the Day` and parses the numbered German/English pairs;
- `🧠 German Review Time` and uses its presence to report that the quiz is ready.

Home does not duplicate Deutsch Buddy’s deterministic lesson-plan data or scheduling logic.

## 5. Daykeeper / day-night-weather

**Home source:** current live Discord channel/category names plus local display time.

The existing Daykeeper service owns the actual server renames/weather theme. Home observes the current leading emoji on its own channel/category and uses it in the dashboard title. When dynamic accents are enabled, it maps common weather emojis and day phases to a compatible accent.

This avoids importing Daykeeper’s bundled theme configuration, which may point at historical server IDs.

## 6. Role Recovery

Role Recovery was inspected for server/bot/ownership context, but it is intentionally **not displayed** on the public Home page.

Its role restoration and migration state is administrative infrastructure. Surfacing that state would add clutter and could expose implementation details that are irrelevant to normal members.

## Additional live server integrations

### Fighter Guides + roles

Home reads the live Fighter Guides forum and constructs a fighter-name index from thread titles. It then normalizes guild role names and matches roles to guide threads.

That single index powers:

- live Fighter Guide count;
- top-fighter popularity among human members;
- **My Fighter Guides**;
- fighter names inside **My Setup**.

This was validated against the supplied archive: all **86 guide threads mapped to all 86 fighter roles**, including numbered ranges such as Pokémon Trainer and Pyra / Mythra.

### Ultimate Guide

Home counts live forum threads. The supplied archive contained **20 chapters**, but the number is not hard-coded.

### Suggestions

Home reads all active/archived suggestion threads, their forum tags, latest thread, and status tags. Recognized workflow statuses are:

- 🟡 Under Review
- 🟢 Planned
- 🔵 In Progress
- ✅ Completed
- ❌ Declined

The dashboard surfaces the latest suggestion and, when present, counts of ideas currently Under Review / Planned / In Progress.

### Announcements

Home finds the latest non-bot text announcement and creates a direct message link. Bot-generated/system output is ignored.

### Voice rooms

Home can watch the configured Lounge and Game Room and surface them only while human members are present. `GuildVoiceStates` also triggers a debounced refresh when someone joins, leaves, or moves between those rooms.

## Cross-service failure policy

All integrations are gathered independently with `Promise.allSettled`. A failure in one service does not block the dashboard.

Examples:

- Play Desk unreadable → generic Play Desk invitation.
- Stream Guide unreadable → generic tournament-guide invitation.
- live API unavailable → explicit “live status unavailable,” never a false offline claim.
- Deutsch not posted yet → says the lesson has not posted yet.
- member intent disabled/fails → uses guild member count and hides enriched role/fighter stats.
- forum failure → guide counts degrade to zero/fallback rather than aborting Home.

The periodic refresh is a recovery mechanism for transient failures; event-driven refreshes handle normal changes quickly.
