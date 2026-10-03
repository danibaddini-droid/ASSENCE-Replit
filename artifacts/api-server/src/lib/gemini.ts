import { GoogleGenAI } from "@google/genai";

type GeminiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let client: GoogleGenAI | undefined;
const MAX_CONCURRENT_STREAMS = 2;
const MAX_RETRIES = 5;
let activeStreams = 0;
const waitingStreams: Array<() => void> = [];

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Replit Secrets.");
  }

  client ??= new GoogleGenAI({ apiKey });
  return client;
}

async function acquireStreamSlot(): Promise<void> {
  if (activeStreams < MAX_CONCURRENT_STREAMS) {
    activeStreams += 1;
    return;
  }

  await new Promise<void>((resolve) => waitingStreams.push(resolve));
}

function releaseStreamSlot(): void {
  const next = waitingStreams.shift();
  if (next) {
    next();
  } else {
    activeStreams -= 1;
  }
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = "status" in error ? error.status : undefined;
  if (typeof status === "number") {
    if (status === 429) {
      const message = error.message.toLowerCase();
      return !/\bper day\b|\bdaily\b|retry in \d+\s*h/.test(message);
    }
    return status >= 500;
  }
  return ["TypeError", "FetchError", "TimeoutError"].includes(error.name);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function* streamGeminiText(
  messages: GeminiMessage[],
  maxOutputTokens: number,
): AsyncGenerator<string> {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const input = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      type: message.role === "assistant" ? "model_output" as const : "user_input" as const,
      content: [{ type: "text" as const, text: message.content }],
    }));

  await acquireStreamSlot();
  try {
    for (let attempt = 0; ; attempt += 1) {
      let hasYieldedText = false;
      try {
        const stream = await getGeminiClient().interactions.create({
          model: "gemini-3.8-flash",
          input,
          ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
          generation_config: { max_output_tokens: maxOutputTokens },
          store: false,
          stream: true,
        });

        for await (const event of stream) {
          if (event.event_type !== "step.delta" || event.delta.type !== "text") continue;
          if (event.delta.text) {
            hasYieldedText = true;
            yield event.delta.text;
          }
        }
        return;
      } catch (error) {
        if (hasYieldedText || attempt >= MAX_RETRIES || !isRetryable(error)) {
          throw error;
        }
        await delay(Math.min(500 * 2 ** attempt, 8000));
      }
    }
  } finally {
    releaseStreamSlot();
  }
}