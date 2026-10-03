import OpenAI from "openai";

let client: OpenAI | undefined;

/**
 * Returns a direct OpenAI client billed to the project's own OpenAI account.
 * The key is read only from Replit Secrets and is never logged or returned.
 */
export function getDirectOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in Replit Secrets.");
  }

  client ??= new OpenAI({ apiKey });
  return client;
}