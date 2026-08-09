import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, readingsTable } from "@workspace/db";
import {
  CreateReadingBody,
  UpdateReadingBody,
  RecalculateReadingBody,
  GetReadingParams,
  DeleteReadingParams,
  ListReadingsResponse,
  GetReadingResponse,
  GetReadingsStatsResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ASSENCE_SYSTEM_PROMPT, buildChartPrompt } from "../lib/assence";
import { calculateBirthChart, calculateTodayTransits } from "../lib/ephemeris";
import { sendNewClientNotification } from "../lib/email";

const router: IRouter = Router();

router.get("/readings/stats", async (req, res): Promise<void> => {
  const allReadings = await db.select().from(readingsTable);
  const total = allReadings.length;
  const completed = allReadings.filter((r) => r.analysisStatus === "completed").length;
  const pending = allReadings.filter((r) => r.analysisStatus === "pending").length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = allReadings.filter((r) => new Date(r.createdAt) >= startOfMonth).length;

  const sunSignCounts: Record<string, number> = {};
  const ascendantCounts: Record<string, number> = {};
  for (const r of allReadings) {
    const chart = r.birthChart as Record<string, unknown>;
    const sunSign = (chart?.sun as Record<string, string>)?.sign;
    const asc = chart?.ascendant as string;
    if (sunSign) sunSignCounts[sunSign] = (sunSignCounts[sunSign] ?? 0) + 1;
    if (asc) ascendantCounts[asc] = (ascendantCounts[asc] ?? 0) + 1;
  }
  const mostCommonSunSign =
    Object.entries(sunSignCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostCommonAscendant =
    Object.entries(ascendantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  res.json(
    GetReadingsStatsResponse.parse({
      total,
      completed,
      pending,
      thisMonth,
      mostCommonSunSign,
      mostCommonAscendant,
    })
  );
});

function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
  ) as T;
}

router.get("/readings/transits/today", async (req, res): Promise<void> => {
  const readings = await db.select().from(readingsTable);
  const result = calculateTodayTransits(
    readings.map((r) => ({ id: r.id, clientName: r.clientName, birthChart: r.birthChart }))
  );
  res.json(result);
});

router.get("/readings", async (req, res): Promise<void> => {
  const readings = await db
    .select()
    .from(readingsTable)
    .orderBy(desc(readingsTable.createdAt));
  res.json(ListReadingsResponse.parse(readings.map(serializeDates)));
});

router.post("/readings", async (req, res): Promise<void> => {
  const parsed = CreateReadingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let birthChart: Record<string, unknown> = (parsed.data.birthChart as Record<string, unknown>) ?? {};
  let autoCalculate = parsed.data.autoCalculate ?? false;
  let ephemerisCalculated = false;

  if (parsed.data.autoCalculate) {
    try {
      const calculated = await calculateBirthChart(
        parsed.data.birthDate,
        parsed.data.birthTime ?? null,
        parsed.data.birthPlace,
        parsed.data.timezoneOverride ?? null
      );
      birthChart = calculated;
      autoCalculate = false;
      ephemerisCalculated = true;
      req.log.info({ birthPlace: parsed.data.birthPlace }, "Ephemeris calculation succeeded");
    } catch (err) {
      req.log.warn({ err }, "Ephemeris calculation failed, falling back to AI auto-calculate");
    }
  }

  const [reading] = await db
    .insert(readingsTable)
    .values({
      clientName: parsed.data.clientName,
      birthDate: parsed.data.birthDate,
      birthTime: parsed.data.birthTime ?? null,
      birthPlace: parsed.data.birthPlace,
      birthChart,
      clientAge: parsed.data.clientAge ?? null,
      clientEmail: parsed.data.clientEmail ?? null,
      notes: parsed.data.notes ?? null,
      analysisStatus: "pending",
    })
    .returning();

  res.status(201).json(GetReadingResponse.parse(serializeDates(reading)));

  generateAnalysis(reading.id, { ...parsed.data, birthChart, autoCalculate, ephemerisCalculated }).catch((err) => {
    req.log.error({ err, readingId: reading.id }, "Failed to generate analysis");
  });

  sendNewClientNotification({
    clientName: reading.clientName,
    birthDate: reading.birthDate,
    birthTime: reading.birthTime,
    birthPlace: reading.birthPlace,
    clientEmail: reading.clientEmail,
    readingId: reading.id,
  }).catch((err) => {
    req.log.warn({ err }, "Failed to send notification email");
  });
});

const REQUIRED_ANALYSIS_SECTIONS = Array.from({ length: 27 }, (_, index) => index + 1);

type AnalysisMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function missingAnalysisSections(markdown: string): number[] {
  return REQUIRED_ANALYSIS_SECTIONS.filter(
    (number) => !new RegExp(`^#\\s+${number}\\.`, "m").test(markdown),
  );
}

const ANALYSIS_BLOCKS = [
  { start: 1, end: 10 },
  { start: 11, end: 20 },
  { start: 21, end: 27 },
] as const;

function missingSectionsInRange(markdown: string, start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index).filter(
    (number) => !new RegExp(`^#\\s+${number}\\.`, "m").test(markdown),
  );
}

async function requestAnalysis(messages: AnalysisMessage[]): Promise<string> {
  const stream = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 16000,
    stream: true,
    messages,
  });

  let content = "";
  for await (const chunk of stream) {
    content += chunk.choices[0]?.delta?.content ?? "";
  }
  return content;
}

async function generateAnalysisBlock(
  userPrompt: string,
  start: number,
  end: number,
  includeFinalSynthesis: boolean,
): Promise<string> {
  const finalSynthesis = includeFinalSynthesis
    ? `

Depois da seção 27, inclua também a **Visão Integradora Final**, com:
### Eixos Principais da Personalidade
### Caminho Evolutivo
e uma síntese final consistente com o mapa.`
    : "";

  const blockPrompt = `${userPrompt}

Esta é uma entrega dividida em blocos. Escreva SOMENTE as seções principais ${start} a ${end}, nesta ordem, sem pular nenhuma e sem reescrever outras seções.
Use exatamente headings Markdown no formato "# N. Título" para cada seção principal.
Cada seção deve ser desenvolvida com profundidade, usando os dados reais do mapa fornecido.
Para cada seção aplicável, inclua o Combo de Entrega completo:
**✨** Análise da alma
**🔬 Laboratório de Integração**
**💬 O Poder do Verbo**
**🪞 Reflexão**
**💛 Conselho de Ouro**
Não faça um resumo superficial e não finalize a resposta antes de concluir a última seção solicitada.${finalSynthesis}`;

  let result = await requestAnalysis([
    { role: "system", content: ASSENCE_SYSTEM_PROMPT },
    { role: "user", content: blockPrompt },
  ]);

  let missing = missingSectionsInRange(result, start, end);
  if (missing.length > 0) {
    result += await requestAnalysis([
      { role: "system", content: ASSENCE_SYSTEM_PROMPT },
      { role: "user", content: blockPrompt },
      { role: "assistant", content: result },
      {
        role: "user",
        content: `Complete agora somente as seções ausentes ${missing.join(", ")}. Comece cada uma exatamente com "# N. Título", desenvolva a análise e inclua o Combo de Entrega completo. Não repita as seções já concluídas.`,
      },
    ]);
    missing = missingSectionsInRange(result, start, end);
  }

  if (missing.length > 0) {
    throw new Error(`Bloco ${start}-${end} incompleto: faltam as seções ${missing.join(", ")}`);
  }

  return result;
}

async function generateAnalysis(
  readingId: number,
  data: {
    clientName: string;
    birthDate: string;
    birthTime?: string | null;
    birthPlace: string;
    clientAge?: number | null;
    autoCalculate?: boolean | null;
    birthChart?: unknown;
    ephemerisCalculated?: boolean;
  }
) {
  try {
    await db
      .update(readingsTable)
      .set({ analysisStatus: "generating" })
      .where(eq(readingsTable.id, readingId));

    const userPrompt = buildChartPrompt(data);

    const blockResults = await Promise.all(
      ANALYSIS_BLOCKS.map((block, index) =>
        generateAnalysisBlock(
          userPrompt,
          block.start,
          block.end,
          index === ANALYSIS_BLOCKS.length - 1,
        ),
      ),
    );
    const analysis = blockResults.join("\n\n");
    const missingSections = missingAnalysisSections(analysis);

    if (missingSections.length > 0) {
      throw new Error(`Análise incompleta: faltam as seções ${missingSections.join(", ")}`);
    }

    await db
      .update(readingsTable)
      .set({ analysis, analysisStatus: "completed" })
      .where(eq(readingsTable.id, readingId));
  } catch (err) {
    await db
      .update(readingsTable)
      .set({ analysisStatus: "error" })
      .where(eq(readingsTable.id, readingId));
    throw err;
  }
}

router.get("/readings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [reading] = await db
    .select()
    .from(readingsTable)
    .where(eq(readingsTable.id, params.data.id));

  if (!reading) {
    res.status(404).json({ error: "Reading not found" });
    return;
  }

  res.json(GetReadingResponse.parse(serializeDates(reading)));
});

router.patch("/readings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateReadingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  if ("notes" in parsed.data) setFields.notes = parsed.data.notes ?? null;
  if ("deliveryStatus" in parsed.data && parsed.data.deliveryStatus !== undefined) {
    setFields.deliveryStatus = parsed.data.deliveryStatus;
  }

  const [updated] = await db
    .update(readingsTable)
    .set(setFields)
    .where(eq(readingsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Reading not found" }); return; }

  res.json(GetReadingResponse.parse(serializeDates(updated)));
});

router.post("/readings/:id/regenerate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [reading] = await db.select().from(readingsTable).where(eq(readingsTable.id, id));
  if (!reading) { res.status(404).json({ error: "Reading not found" }); return; }

  res.json(GetReadingResponse.parse(serializeDates(reading)));

  generateAnalysis(reading.id, {
    clientName: reading.clientName,
    birthDate: reading.birthDate,
    birthTime: reading.birthTime,
    birthPlace: reading.birthPlace,
    clientAge: reading.clientAge,
    birthChart: reading.birthChart,
    ephemerisCalculated: !!(reading.birthChart as Record<string, unknown>)?.ascendant,
  }).catch((err) => {
    req.log.error({ err, readingId: reading.id }, "Failed to regenerate analysis");
  });
});

router.post("/readings/:id/recalculate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [reading] = await db.select().from(readingsTable).where(eq(readingsTable.id, id));
  if (!reading) { res.status(404).json({ error: "Reading not found" }); return; }

  const body = RecalculateReadingBody.safeParse(req.body ?? {});
  const timezoneOverride = body.success ? (body.data.timezoneOverride ?? null) : null;

  try {
    const newChart = await calculateBirthChart(
      reading.birthDate,
      reading.birthTime ?? null,
      reading.birthPlace,
      timezoneOverride
    );
    req.log.info({ id, birthPlace: reading.birthPlace, timezoneOverride }, "Ephemeris recalculation succeeded");

    const [updated] = await db
      .update(readingsTable)
      .set({ birthChart: newChart, updatedAt: new Date() })
      .where(eq(readingsTable.id, id))
      .returning();

    res.json(GetReadingResponse.parse(serializeDates(updated)));
  } catch (err) {
    req.log.error({ err, id }, "Ephemeris recalculation failed");
    res.status(500).json({ error: "Ephemeris recalculation failed" });
  }
});

router.delete("/readings/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteReadingParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [deleted] = await db
    .delete(readingsTable)
    .where(eq(readingsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Reading not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
