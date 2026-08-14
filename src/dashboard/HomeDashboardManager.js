import { createHash } from "node:crypto";
import { MessageFlags } from "discord.js";
import { buildHomeDashboard, countComponents } from "./buildHomeDashboard.js";
import { collectHomeData } from "../services/homeData.js";
import { containsCustomId } from "../utils/discord.js";

const UNKNOWN_MESSAGE = 10008;

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function semanticHash(data) {
  return createHash("sha256").update(JSON.stringify(canonical(data))).digest("hex");
}

export class HomeDashboardManager {
  #client;
  #config;
  #message = null;
  #timer = null;
  #debounceTimer = null;
  #refreshing = false;
  #refreshAgain = false;
  #lastHash = null;
  #lastData = null;
  #lastChangedAt = null;

  constructor(client, config) {
    this.#client = client;
    this.#config = config;
  }

  get lastData() {
    return this.#lastData;
  }

  async start() {
    await this.refresh("startup", { force: true });
    this.#timer = setInterval(
      () => void this.refresh("periodic"),
      this.#config.refreshIntervalSeconds * 1000,
    );
    this.#timer.unref?.();
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#timer = null;
    this.#debounceTimer = null;
  }

  requestRefresh(reason = "event") {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      void this.refresh(reason);
    }, this.#config.eventRefreshDebounceMs);
    this.#debounceTimer.unref?.();
  }

  noteMessageDeleted(messageId) {
    if (this.#message?.id === messageId || this.#config.homeMessageId === messageId) {
      this.#message = null;
      this.requestRefresh("dashboard-deleted");
    }
  }

  async refresh(reason = "manual", { force = false } = {}) {
    if (this.#refreshing) {
      this.#refreshAgain = true;
      return;
    }

    this.#refreshing = true;
    try {
      const channel = await this.#getHomeChannel();
      const data = await collectHomeData(this.#client, this.#config);
      const hash = semanticHash(data);
      this.#lastData = data;

      if (!this.#message) this.#message = await this.#findExistingMessage(channel);

      const changed = force || hash !== this.#lastHash || !this.#message;
      if (!changed) {
        console.log(`[home] ${reason}: no dashboard data changed.`);
        return;
      }

      this.#lastHash = hash;
      this.#lastChangedAt = new Date();
      const payload = this.#buildPayload(data);
      const componentCount = countComponents(payload.components);
      if (componentCount > 40) throw new Error(`Dashboard would use ${componentCount} components; Discord allows at most 40.`);

      if (this.#message) {
        try {
          this.#message = await this.#message.edit(payload);
          console.log(`[home] ${reason}: updated dashboard ${this.#message.id} (${componentCount} components).`);
          return;
        } catch (error) {
          if (error?.code !== UNKNOWN_MESSAGE) throw error;
          console.warn("[home] Dashboard message disappeared; recreating it.");
          this.#message = null;
        }
      }

      this.#message = await channel.send(payload);
      console.log(`[home] ${reason}: created dashboard ${this.#message.id} (${componentCount} components).`);
    } catch (error) {
      console.error(`[home] ${reason}: refresh failed:`, error);
    } finally {
      this.#refreshing = false;
      if (this.#refreshAgain) {
        this.#refreshAgain = false;
        this.requestRefresh("queued-change");
      }
    }
  }

  #buildPayload(data) {
    return {
      components: [buildHomeDashboard(data, this.#config, { changedAt: this.#lastChangedAt })],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    };
  }

  async #getHomeChannel() {
    const channel = await this.#client.channels.fetch(this.#config.homeChannelId);
    if (!channel?.isTextBased() || !channel.messages || !("send" in channel)) {
      throw new Error(`HOME_CHANNEL_ID ${this.#config.homeChannelId} is not a sendable text channel.`);
    }
    return channel;
  }

  async #findExistingMessage(channel) {
    if (this.#config.homeMessageId) {
      try {
        const configured = await channel.messages.fetch(this.#config.homeMessageId);
        if (configured.author.id !== this.#client.user.id) throw new Error("HOME_MESSAGE_ID belongs to another author.");
        if (!configured.flags.has(MessageFlags.IsComponentsV2)) throw new Error("HOME_MESSAGE_ID is not a Components V2 message.");
        return configured;
      } catch (error) {
        console.warn(`[home] HOME_MESSAGE_ID could not be used; falling back to discovery: ${error?.message ?? error}`);
      }
    }

    const recent = await channel.messages.fetch({ limit: this.#config.messageScanLimit });
    return recent.find((message) =>
      message.author.id === this.#client.user.id &&
      message.flags.has(MessageFlags.IsComponentsV2) &&
      containsCustomId(message.components, "home:"),
    ) ?? null;
  }
}
