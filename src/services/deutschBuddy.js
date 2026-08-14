import { fetchRecentMessagesByAuthor } from "./discordRead.js";

function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parseVocabularyDescription(description) {
  const text = String(description ?? "");
  const matches = [...text.matchAll(/\*\*\d+\.\s+(.+?)\*\*\s+—\s+([^\n]+)/g)];
  return matches.map((match) => ({ german: match[1].trim(), english: match[2].trim() }));
}

export async function readDeutschBuddy(client, config) {
  if (!config.showDeutschBuddy) return { status: "disabled", data: null };
  if (!config.readExternalBotMessages) return { status: "unavailable", data: null };

  const messages = await fetchRecentMessagesByAuthor(
    client,
    config.channels.deutschBuddy,
    config.bots.deutschBuddy,
    Math.min(config.messageScanLimit, 100),
  );
  if (!messages.length) return { status: "missing", data: null };

  const today = localDateKey(new Date(), config.displayTimeZone);
  const vocabularyMessage = messages.find((message) =>
    localDateKey(message.createdAt, config.displayTimeZone) === today &&
    message.embeds?.some((embed) => embed.title === "🇩🇪 German Words of the Day"),
  );
  const quizMessage = messages.find((message) =>
    localDateKey(message.createdAt, config.displayTimeZone) === today &&
    message.embeds?.some((embed) => embed.title === "🧠 German Review Time"),
  );

  if (!vocabularyMessage) {
    return { status: "ok", data: { postedToday: false, quizReady: Boolean(quizMessage), words: [] } };
  }

  const embed = vocabularyMessage.embeds.find((item) => item.title === "🇩🇪 German Words of the Day");
  return {
    status: "ok",
    data: {
      postedToday: true,
      quizReady: Boolean(quizMessage),
      words: parseVocabularyDescription(embed?.description),
      messageId: vocabularyMessage.id,
    },
  };
}
