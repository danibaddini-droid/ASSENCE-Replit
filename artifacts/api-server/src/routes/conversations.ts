import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import {
  CreateConversationBody,
  GetConversationParams,
  SendConversationMessageBody,
  SendConversationMessageParams,
  ListConversationsResponse,
  GetConversationResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ASSENCE_SYSTEM_PROMPT } from "../lib/assence";

const router: IRouter = Router();

function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
  ) as T;
}

router.get("/openai/conversations", async (req, res): Promise<void> => {
  const convs = await db.select().from(conversationsTable);
  res.json(ListConversationsResponse.parse(convs.map(serializeDates)));
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db
    .insert(conversationsTable)
    .values({
      title: parsed.data.title ?? null,
      readingId: parsed.data.readingId ?? null,
    })
    .returning();

  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.id));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.id))
    .orderBy(asc(messagesTable.createdAt));

  res.json(GetConversationResponse.parse({ ...conv, messages: msgs }));
});

router.post(
  "/openai/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const convId = parseInt(rawId, 10);

    const params = SendConversationMessageParams.safeParse({ id: convId });
    if (!params.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const body = SendConversationMessageBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, params.data.id));

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messagesTable).values({
      conversationId: convId,
      role: "user",
      content: body.data.content,
    });

    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(asc(messagesTable.createdAt));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: ASSENCE_SYSTEM_PROMPT },
        ...allMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({
      conversationId: convId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
);

export default router;
