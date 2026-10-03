import { GoogleGenAI } from "@google/genai";

type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let client: GoogleGenAI | undefined;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Replit Secrets.");
  }

  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export async function* streamGeminiText(
  messages: GeminiMessage[],
  maxOutputTokens: number,
): AsyncGenerator<string> {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: message.content }],
    }));

  const stream = await getGeminiClient().models.generateContentStream({
    model: "gemini-2.5-flash",
    contents,
    config: {
      ...(systemInstruction ? { systemInstruction } : {}),
      maxOutputTokens,
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}