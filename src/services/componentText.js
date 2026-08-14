import { componentJson, walkComponents } from "../utils/discord.js";

export function extractTextDisplays(input) {
  const output = [];
  walkComponents(input, (node) => {
    if (node.type === 10 && typeof node.content === "string") output.push(node.content);
  });
  return output;
}

export function orderedTopLevelTextBlocks(input) {
  const components = Array.isArray(input) ? input : [];
  const output = [];

  for (const value of components) {
    const node = componentJson(value);
    if (!node || typeof node !== "object") continue;

    if (node.type === 10 && typeof node.content === "string") {
      output.push({ kind: "text", content: node.content, node });
      continue;
    }

    if (node.type === 17) {
      const texts = extractTextDisplays(node.components ?? []);
      output.push({ kind: "container", content: texts.join("\n"), texts, node });
    }
  }

  return output;
}
