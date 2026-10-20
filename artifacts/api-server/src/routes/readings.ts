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
import { ASSENCE_SYSTEM_PROMPT, buildChartPrompt, sanitizeAnalysis } from "../lib/assence";
import {
  calculateAstrologicalCycles,
  calculateBirthChart,
  calculateMonthlyTransitForecast,
  calculateTodayTransits,
} from "../lib/ephemeris";
import { sendNewClientNotification } from "../lib/email";
import { streamGeminiText } from "../lib/gemini";

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
  const analysisType = parsed.data.analysisType ?? "natal";

  if (analysisType !== "natal" && !parsed.data.birthTime?.trim()) {
    res.status(400).json({ error: "Informe a hora de nascimento para calcular os ângulos e as casas dos mapas derivados." });
    return;
  }
  if (
    (analysisType === "solar-return" || analysisType === "integrated") &&
    !parsed.data.solarReturnLocation?.trim()
  ) {
    res.status(400).json({ error: "Informe o local onde a pessoa passará o aniversário para calcular a Revolução Solar." });
    return;
  }

  if (parsed.data.autoCalculate || analysisType !== "natal") {
    try {
      const calculated = analysisType === "solar-return" ||
        analysisType === "secondary-progression" ||
        analysisType === "integrated"
        ? await calculateAstrologicalCycles(
            parsed.data.birthDate,
            parsed.data.birthTime ?? null,
            parsed.data.birthPlace,
            parsed.data.solarReturnLocation ?? parsed.data.birthPlace,
            parsed.data.timezoneOverride ?? null,
            {
              includeSolarReturn: analysisType !== "secondary-progression",
              includeSecondaryProgression: analysisType !== "solar-return",
            },
          )
        : await calculateBirthChart(
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
      if (analysisType !== "natal") {
        req.log.error({ err, analysisType }, "Derived chart calculation failed");
        res.status(422).json({ error: "Não foi possível calcular os mapas solicitados com os dados informados." });
        return;
      }
      req.log.warn({ err }, "Ephemeris calculation failed, falling back to AI auto-calculate");
    }
  }
  birthChart = { ...birthChart, analysisType };

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

  generateAnalysis(reading.id, { ...parsed.data, analysisType, birthChart, autoCalculate, ephemerisCalculated }).catch((err) => {
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

const REQUIRED_ANALYSIS_SECTIONS = Array.from({ length: 28 }, (_, index) => index + 1);

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
  { start: 28, end: 28 },
] as const;

const TRANSIT_SYSTEM_PROMPT = `Você é a Assence, uma inteligência astrológica de elite.
Analise exclusivamente os trânsitos astrológicos atuais em relação ao mapa natal fornecido.
Escreva em português brasileiro, com linguagem psicológica, concreta e não determinista.
Não faça a análise natal completa novamente. Não inclua "O Poder do Verbo", afirmações,
"Conselho de Ouro" ou conselhos equivalentes. Organize a resposta com:
# Trânsitos Astrológicos do Dia
## Clima geral
## Trânsitos mais relevantes
## Áreas da vida ativadas
## Recomendações de integração
Use os planetas, signos, graus, casas e aspectos fornecidos nos dados, explicando
o que está sendo ativado, a qualidade da oportunidade ou tensão e como trabalhar
conscientemente com cada trânsito.`;

function missingSectionsInRange(markdown: string, start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index).filter(
    (number) => !new RegExp(`^#\\s+${number}\\.`, "m").test(markdown),
  );
}

function normalizeMainSectionHeadings(markdown: string, start: number, end: number): string {
  return markdown.replace(
    /^#{1,6}\s*(\d+)(?!\d|\.\d)(?:[ \t]*[.):\-–—][ \t]*|[ \t]+)([^\n]*)$/gm,
    (heading, numberText: string, title: string) => {
      const number = Number(numberText);
      if (number < start || number > end) return heading;
      return `# ${number}. ${title.trim()}`;
    },
  );
}

async function requestAnalysis(messages: AnalysisMessage[]): Promise<string> {
  let content = "";
  for await (const text of streamGeminiText(messages, 16000)) {
    content += text;
  }
  return content;
}

async function generateTransitAnalysis(readingId: number, reading: typeof readingsTable.$inferSelect) {
  try {
    await db
      .update(readingsTable)
      .set({ transitAnalysisStatus: "generating", updatedAt: new Date() })
      .where(eq(readingsTable.id, readingId));

    const allReadings = await db.select().from(readingsTable);
    const transitResult = calculateTodayTransits(
      allReadings.map((item) => ({
        id: item.id,
        clientName: item.clientName,
        birthChart: item.birthChart,
      })),
    );
    const clientTransit = transitResult.activatedClients.find((item) => item.readingId === readingId);
    const userPrompt = `MAPA NATAL:
${JSON.stringify(reading.birthChart, null, 2)}

DATA DOS TRÂNSITOS: ${transitResult.date}
POSIÇÕES DOS TRÂNSITOS:
${transitResult.planets.map((planet) => `${planet.name}: ${planet.sign} ${planet.degree.toFixed(1)}°${planet.retrograde ? " (retrógrado)" : ""}`).join("\n")}

ASPECTOS DOS TRÂNSITOS COM O MAPA NATAL:
${clientTransit?.transits?.length
  ? clientTransit.transits.map((item) => `${item.transitPlanet} ${item.type} ${item.natalPlanet} (orbe ${item.orb}°)`).join("\n")
  : "Nenhum aspecto dentro do orbe de 3° foi identificado hoje."}

Nome: ${reading.clientName}
Produza a análise separada dos trânsitos seguindo exatamente a estrutura indicada no sistema.`;

    const analysis = (await requestAnalysis([
      { role: "system", content: TRANSIT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ])).trim();

    if (!analysis || !analysis.includes("Trânsitos Astrológicos")) {
      throw new Error("Análise de trânsitos retornou conteúdo incompleto");
    }

    await db
      .update(readingsTable)
      .set({ transitAnalysis: analysis, transitAnalysisStatus: "completed", updatedAt: new Date() })
      .where(eq(readingsTable.id, readingId));
  } catch (err) {
    await db
      .update(readingsTable)
      .set({ transitAnalysisStatus: "error", updatedAt: new Date() })
      .where(eq(readingsTable.id, readingId));
    throw err;
  }
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
**🪞 Reflexão**
Não inclua "Poder do Verbo", afirmações, "Conselho de Ouro" ou conselhos equivalentes.
Não faça um resumo superficial e não finalize a resposta antes de concluir a última seção solicitada.${finalSynthesis}`;

  let result = normalizeMainSectionHeadings(await requestAnalysis([
    { role: "system", content: ASSENCE_SYSTEM_PROMPT },
    { role: "user", content: blockPrompt },
  ]), start, end);

  let missing = missingSectionsInRange(result, start, end);
  for (let attempt = 0; missing.length > 0 && attempt < 2; attempt += 1) {
    const requiredHeadings = missing
      .map((number) => {
        const title = ASSENCE_SYSTEM_PROMPT.match(
          new RegExp(`^###\\s+${number}\\.\\s+(.+)$`, "m"),
        )?.[1];
        return `# ${number}. ${title ?? `Seção ${number}`}`;
      })
      .join("\n");
    const synthesisInstruction =
      includeFinalSynthesis && missing.includes(27)
        ? "\nApós a seção 27, inclua também a Visão Integradora Final, com Eixos Principais da Personalidade, Caminho Evolutivo e uma síntese coerente com o mapa."
        : "";
    const completionPrompt = `${userPrompt}

Esta análise já tem algumas seções concluídas. Escreva SOMENTE as seções ainda ausentes: ${missing.join(", ")}.
Comece cada seção com exatamente um dos cabeçalhos abaixo, em nível principal (#), sem alterar a numeração:
${requiredHeadings}
Desenvolva cada seção com profundidade, usando os dados reais do mapa. Inclua **✨** Análise da alma, **🔬 Laboratório de Integração** e **🪞 Reflexão** quando aplicável.
Não inclua Poder do Verbo, afirmações, Conselho de Ouro ou equivalentes. Não repita nenhuma seção já concluída.${synthesisInstruction}`;
    const completion = normalizeMainSectionHeadings(
      await requestAnalysis([
        { role: "system", content: ASSENCE_SYSTEM_PROMPT },
        { role: "user", content: completionPrompt },
      ]),
      start,
      end,
    );
    result = `${result.trim()}\n\n${completion.trim()}`;
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
    analysisType?: "natal" | "solar-return" | "secondary-progression" | "integrated";
  }
) {
  try {
    await db
      .update(readingsTable)
      .set({ analysisStatus: "generating" })
      .where(eq(readingsTable.id, readingId));

    const currentChart = (data.birthChart as Record<string, unknown> | null) ?? {};
    const analysisType = data.analysisType ?? "natal";
    const userPrompt = buildChartPrompt({
      ...data,
      analysisType,
      monthlyTransits: analysisType === "integrated"
        ? calculateMonthlyTransitForecast(currentChart)
        : undefined,
    });

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
    const analysis = sanitizeAnalysis(blockResults.join("\n\n"));
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
    analysisType: ((reading.birthChart as Record<string, unknown>)?.analysisType as
      "natal" | "solar-return" | "secondary-progression" | "integrated" | undefined) ?? "natal",
  }).catch((err) => {
    req.log.error({ err, readingId: reading.id }, "Failed to regenerate analysis");
  });
});

router.post("/readings/:id/transits/regenerate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [reading] = await db.select().from(readingsTable).where(eq(readingsTable.id, id));
  if (!reading) {
    res.status(404).json({ error: "Reading not found" });
    return;
  }

  await db
    .update(readingsTable)
    .set({ transitAnalysisStatus: "generating", updatedAt: new Date() })
    .where(eq(readingsTable.id, id));

  res.json(GetReadingResponse.parse(serializeDates({
    ...reading,
    transitAnalysisStatus: "generating",
  })));

  generateTransitAnalysis(id, reading).catch((err) => {
    req.log.error({ err, readingId: id }, "Failed to generate transit analysis");
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
    const previousChart = reading.birthChart as Record<string, unknown>;
    const analysisType = previousChart.analysisType;
    const isDerived = analysisType === "solar-return" ||
      analysisType === "secondary-progression" ||
      analysisType === "integrated";
    const solarReturn = previousChart.solarReturn as { location?: string } | undefined;
    if ((analysisType === "solar-return" || analysisType === "integrated") && !solarReturn?.location) {
      res.status(422).json({ error: "O local do aniversário não está salvo. Crie uma nova leitura para recalcular a Revolução Solar." });
      return;
    }
    const newChart = isDerived
      ? await calculateAstrologicalCycles(
          reading.birthDate,
          reading.birthTime ?? null,
          reading.birthPlace,
          solarReturn?.location ?? reading.birthPlace,
          timezoneOverride,
          {
            includeSolarReturn: analysisType !== "secondary-progression",
            includeSecondaryProgression: analysisType !== "solar-return",
          },
        )
      : await calculateBirthChart(
          reading.birthDate,
          reading.birthTime ?? null,
          reading.birthPlace,
          timezoneOverride
        );
    newChart.analysisType = isDerived ? analysisType : "natal";
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
