import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetReading,
  getGetReadingQueryKey,
  useGetDailyTransits,
  getGetDailyTransitsQueryKey,
  useCreateConversation,
  useDeleteReading,
  useUpdateReading,
  useRecalculateReading,
  useRegenerateReading,
  useRegenerateTransitAnalysis,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, ChevronLeft, Star, MoonStar, Sparkles, RefreshCw, AlertCircle, Download, NotebookPen, Save, Globe, Send, CheckCheck, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PLANETS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/hooks/use-toast";
import { exportReadingPDF } from "@/lib/export-pdf";

const TZ_AUTO = "__auto__";
const RECALC_TIMEZONES = [
  { label: "Detectar automaticamente pelas coordenadas", value: TZ_AUTO },
  { label: "UTC (Tempo Universal)", value: "UTC" },
  { label: "America/Sao_Paulo — Brasil (BRT/BRST)", value: "America/Sao_Paulo" },
  { label: "America/Manaus — Brasil Oeste (AMT)", value: "America/Manaus" },
  { label: "America/Noronha — Fernando de Noronha", value: "America/Noronha" },
  { label: "America/New_York — EUA Leste (ET)", value: "America/New_York" },
  { label: "America/Chicago — EUA Central (CT)", value: "America/Chicago" },
  { label: "America/Los_Angeles — EUA Oeste (PT)", value: "America/Los_Angeles" },
  { label: "America/Mexico_City — México", value: "America/Mexico_City" },
  { label: "America/Buenos_Aires — Argentina", value: "America/Argentina/Buenos_Aires" },
  { label: "America/Santiago — Chile", value: "America/Santiago" },
  { label: "America/Bogota — Colômbia", value: "America/Bogota" },
  { label: "America/Lima — Peru", value: "America/Lima" },
  { label: "Europe/Lisbon — Portugal", value: "Europe/Lisbon" },
  { label: "Europe/London — Reino Unido (GMT/BST)", value: "Europe/London" },
  { label: "Europe/Madrid — Espanha (CET)", value: "Europe/Madrid" },
  { label: "Europe/Paris — França (CET)", value: "Europe/Paris" },
  { label: "Europe/Moscow — Rússia (MSK)", value: "Europe/Moscow" },
  { label: "Asia/Tokyo — Japão (JST)", value: "Asia/Tokyo" },
  { label: "Asia/Shanghai — China (CST)", value: "Asia/Shanghai" },
  { label: "Asia/Kolkata — Índia (IST)", value: "Asia/Kolkata" },
  { label: "Asia/Dubai — EAU (GST)", value: "Asia/Dubai" },
  { label: "Australia/Sydney — Austrália (AET)", value: "Australia/Sydney" },
  { label: "Africa/Johannesburg — África do Sul (SAST)", value: "Africa/Johannesburg" },
];

function formatDegMin(decimal?: number | null): string {
  if (decimal === undefined || decimal === null) return "—";
  const d = Math.floor(decimal);
  const m = Math.round((decimal - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}'`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-primary/20 text-primary border-primary/30 font-normal">Concluído</Badge>;
    case "generating":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-normal animate-pulse">Gerando análise…</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-normal">Pendente</Badge>;
    case "error":
      return <Badge variant="destructive" className="font-normal">Erro na geração</Badge>;
    default:
      return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}

function withoutAffirmationAndAdvice(markdown: string): string {
  return markdown
    .replace(/\n*\*\*💬 O Poder do Verbo\*\*[\s\S]*?(?=\n+\*\*🪞 Reflexão\*\*|\n+#{1,6}\s|$)/g, "")
    .replace(/\n*\*\*💛 Conselho de Ouro\*\*[\s\S]*?(?=\n+#{1,6}\s|$)/g, "");
}

export default function ReadingView() {
  const { id } = useParams<{ id: string }>();
  const readingId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createConversation = useCreateConversation();
  const deleteReading = useDeleteReading();
  const updateReading = useUpdateReading();
  const recalculateReading = useRecalculateReading();
  const regenerateReading = useRegenerateReading();
  const regenerateTransitAnalysis = useRegenerateTransitAnalysis();
  const [exporting, setExporting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [togglingDelivery, setTogglingDelivery] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [recalcDialogOpen, setRecalcDialogOpen] = useState(false);
  const [recalcTz, setRecalcTz] = useState(TZ_AUTO);
  const [recalculating, setRecalculating] = useState(false);
  const [generatingTransits, setGeneratingTransits] = useState(false);
  const [activeMap, setActiveMap] = useState("natal");

  const { data: reading, isLoading } = useGetReading(readingId, {
    query: {
      queryKey: getGetReadingQueryKey(readingId),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return false;
         if (
           data.analysisStatus === "generating" ||
           data.analysisStatus === "pending" ||
           data.transitAnalysisStatus === "generating"
         ) return 3000;
        return false;
      },
    },
  });
  const {
    data: dailyTransits,
    isLoading: isTransitMapLoading,
    isError: isTransitMapError,
    refetch: refetchDailyTransits,
  } = useGetDailyTransits({
    query: {
      queryKey: getGetDailyTransitsQueryKey(),
      enabled: activeMap !== "natal",
      staleTime: 5 * 60 * 1000,
      refetchInterval: activeMap !== "natal" ? 5 * 60 * 1000 : false,
    },
  });

  useEffect(() => {
    if (reading?.notes !== undefined) {
      setNotes(reading.notes ?? "");
      setNotesDirty(false);
    }
  }, [reading?.notes]);

  async function handleSaveNotes() {
    if (!reading) return;
    setSavingNotes(true);
    try {
      await updateReading.mutateAsync({ id: reading.id, data: { notes: notes || null } });
      await queryClient.invalidateQueries({ queryKey: getGetReadingQueryKey(readingId) });
      setNotesDirty(false);
      toast({ title: "Notas salvas" });
    } catch {
      toast({ title: "Erro ao salvar notas", variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleStartChat() {
    if (!reading) return;
    try {
      const conv = await createConversation.mutateAsync({
        data: {
          title: `Conversa sobre ${reading.clientName}`,
          readingId: reading.id,
        },
      });
      navigate(`/conversar/${conv.id}`);
    } catch {
      toast({ title: "Erro ao iniciar conversa", variant: "destructive" });
    }
  }

  async function handleExportPDF() {
    if (!reading) return;
    setExporting(true);
    try {
      await exportReadingPDF(reading);
      toast({ title: "PDF exportado com sucesso" });
    } catch {
      toast({ title: "Erro ao exportar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function handleToggleDelivery() {
    if (!reading) return;
    setTogglingDelivery(true);
    const next = reading.deliveryStatus === "delivered" ? "pending" : "delivered";
    try {
      await updateReading.mutateAsync({ id: reading.id, data: { deliveryStatus: next } });
      await queryClient.invalidateQueries({ queryKey: getGetReadingQueryKey(readingId) });
      toast({ title: next === "delivered" ? "Análise marcada como entregue" : "Marcado como não entregue" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } finally {
      setTogglingDelivery(false);
    }
  }

  async function handleRegenerate() {
    if (!reading) return;
    setRegenerating(true);
    try {
      await regenerateReading.mutateAsync({ id: reading.id });
      await queryClient.invalidateQueries({ queryKey: getGetReadingQueryKey(readingId) });
      toast({ title: "Análise em geração", description: "A IA está gerando uma nova análise com as posições atuais." });
    } catch {
      toast({ title: "Erro ao regerar análise", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleGenerateTransitAnalysis() {
    if (!reading) return;
    setGeneratingTransits(true);
    try {
      await regenerateTransitAnalysis.mutateAsync({ id: reading.id });
      await queryClient.invalidateQueries({ queryKey: getGetReadingQueryKey(readingId) });
      toast({
        title: "Análise dos trânsitos em geração",
        description: "A leitura dos trânsitos atuais será exibida nesta página quando terminar.",
      });
    } catch {
      toast({ title: "Erro ao gerar análise dos trânsitos", variant: "destructive" });
    } finally {
      setGeneratingTransits(false);
    }
  }

  async function handleDeleteReading() {
    if (!reading) return;
    if (!confirm(`Excluir definitivamente o mapa de ${reading.clientName}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteReading.mutateAsync({ id: reading.id });
      toast({ title: "Mapa excluído" });
      navigate("/mapas");
    } catch {
      toast({ title: "Erro ao excluir o mapa", variant: "destructive" });
    }
  }

  async function handleRecalculate() {
    if (!reading) return;
    setRecalculating(true);
    try {
      const tzOverride = recalcTz && recalcTz !== TZ_AUTO ? recalcTz : null;
      await recalculateReading.mutateAsync({
        id: reading.id,
        data: { timezoneOverride: tzOverride },
      });
      await queryClient.invalidateQueries({ queryKey: getGetReadingQueryKey(readingId) });
      setRecalcDialogOpen(false);
      toast({
        title: "Mapa recalculado",
        description: tzOverride
          ? `Posições atualizadas com fuso ${tzOverride}.`
          : "Posições atualizadas com detecção automática de fuso.",
      });
    } catch {
      toast({ title: "Erro ao recalcular mapa", variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!reading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-30" />
        <p className="font-sans text-lg">Mapa não encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/mapas")}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar aos mapas
        </Button>
      </div>
    );
  }

  const chart = reading.birthChart;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/mapas")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            Mapas
          </button>
          <h1 className="text-3xl font-sans text-primary">{reading.clientName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span>{format(new Date(reading.birthDate + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {reading.birthTime && <><span>•</span><span>{reading.birthTime}</span></>}
            {reading.birthPlace && <><span>•</span><span>{reading.birthPlace}</span></>}
            {reading.clientEmail && <><span>•</span><span className="text-xs opacity-70">{reading.clientEmail}</span></>}
            {(reading.birthChart as Record<string,unknown>)?.timezone && (() => {
              const tz = (reading.birthChart as Record<string,unknown>).timezone as {name:string;utcOffsetMin:number};
              const h = tz.utcOffsetMin / 60;
              return <><span>•</span><span className="text-xs opacity-70">{tz.name} (UTC{h >= 0 ? "+" : ""}{h})</span></>;
            })()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-8 justify-end">
          <StatusBadge status={activeMap === "transits" ? (reading.transitAnalysisStatus ?? reading.analysisStatus) : reading.analysisStatus} />
          {reading.deliveryStatus === "delivered" ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-normal gap-1">
              <CheckCheck className="h-3 w-3" />
              Entregue
            </Badge>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleDelivery}
            disabled={togglingDelivery}
            className={`border h-8 px-2.5 text-xs transition-colors ${
              reading.deliveryStatus === "delivered"
                ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                : "text-muted-foreground border-border/40 hover:text-emerald-400 hover:border-emerald-500/30"
            }`}
            title={reading.deliveryStatus === "delivered" ? "Marcar como não entregue" : "Marcar análise como entregue ao cliente"}
          >
            {reading.deliveryStatus === "delivered"
              ? <><CheckCheck className="h-3.5 w-3.5 mr-1.5" />Entregue</>
              : <><Send className="h-3.5 w-3.5 mr-1.5" />Marcar como Entregue</>
            }
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setRecalcTz(TZ_AUTO); setRecalcDialogOpen(true); }}
            className="text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/70 h-8 px-2.5 text-xs"
            title="Recalcular posições via efemérides"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Recalcular Mapa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating || reading.analysisStatus === "generating"}
            className="text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/70 h-8 px-2.5 text-xs"
            title="Regerar a análise natal com as posições atuais"
          >
            {regenerating || reading.analysisStatus === "generating" ? (
              <Sparkles className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            {regenerating || reading.analysisStatus === "generating" ? "Gerando…" : "Regerar Análise Natal"}
          </Button>
          {reading.analysisStatus === "completed" && (
            <>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={exporting}
                className="border-primary/40 text-primary hover:bg-primary/10"
              >
                {exporting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {exporting ? "Gerando…" : "Exportar PDF"}
              </Button>
              <Button
                onClick={handleStartChat}
                disabled={createConversation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Conversar sobre este Mapa
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteReading}
            disabled={deleteReading.isPending}
            className="h-8 px-2.5 text-xs text-destructive border border-destructive/30 hover:bg-destructive/10"
            title="Excluir este mapa definitivamente"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir mapa
          </Button>
        </div>
      </div>

      <Tabs value={activeMap} onValueChange={setActiveMap} className="space-y-6">
        <TabsList aria-label="Opções de mapa" className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="natal" data-testid="tab-map-natal" className="px-1.5 text-xs sm:px-3 sm:text-sm">Mapa natal</TabsTrigger>
          <TabsTrigger value="transits" data-testid="tab-map-transits" className="px-1.5 text-xs sm:px-3 sm:text-sm">Trânsitos</TabsTrigger>
          <TabsTrigger value="combined" data-testid="tab-map-combined" className="px-1.5 text-xs sm:px-3 sm:text-sm">Natal + trânsitos</TabsTrigger>
        </TabsList>

        <TabsContent value="natal" className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard icon={Star} label="Ascendente" value={chart.ascendant} />
            <InfoCard icon={MoonStar} label="Meio-do-Céu" value={chart.midheaven} />
            <InfoCard icon={Sparkles} label="Sol" value={`${chart.sun.sign} • Casa ${chart.sun.house}`} />
            <InfoCard icon={MoonStar} label="Lua" value={`${chart.moon.sign} • Casa ${chart.moon.house}`} />
          </div>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="font-sans text-xl flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Planetas natais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {PLANETS.map((planet) => {
                  const pos = (chart as Record<string, {sign?: string; house?: number; degree?: number; retrograde?: boolean}>)[planet.id];
                  if (!pos?.sign) return null;
                  return (
                    <div key={planet.id} data-testid={`row-natal-planet-${planet.id}`} className="flex items-center justify-between px-5 py-3 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0">{planet.label}</span>
                      <span className="font-medium flex-1">{pos.sign}</span>
                      <span className="text-muted-foreground">Casa {pos.house}</span>
                      {pos.degree !== undefined && (
                        <span className="text-muted-foreground ml-4 w-16 text-right font-mono text-xs">
                          {formatDegMin(pos.degree)}
                        </span>
                      )}
                      {pos.retrograde && (
                        <span className="ml-3 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rx</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {chart.houseCusps && (chart.houseCusps as unknown[]).length > 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="font-sans text-xl flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Cúspides das Casas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 md:grid-cols-3 divide-border/30">
                  {(chart.houseCusps as { house: number; sign: string; degrees?: number; minutes?: number }[]).map((cusp) => (
                    <div key={cusp.house} className="flex items-center justify-between px-5 py-3 text-sm border-b border-r border-border/20">
                      <span className="text-primary font-medium w-16 shrink-0">Casa {cusp.house}</span>
                      <span className="flex-1 font-medium">{cusp.sign}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {cusp.degrees ?? 0}°{String(cusp.minutes ?? 0).padStart(2, "0")}'
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {chart.aspects && (chart.aspects as unknown[]).length > 0 && (
            <AspectsSection aspects={chart.aspects as { planet1: string; planet2: string; type: string; orb: number }[]} />
          )}

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="font-sans text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Análise Astrológica Assence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              {reading.analysisStatus === "pending" || reading.analysisStatus === "generating" ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <RefreshCw className="h-10 w-10 mb-4 animate-spin opacity-40" />
                  <p className="font-sans text-lg text-center">
                    {reading.analysisStatus === "generating"
                      ? "A inteligência astrológica está tecendo a análise…"
                      : "Aguardando início da geração…"}
                  </p>
                  <p className="text-sm mt-2 text-center opacity-70">
                    Isso pode levar alguns minutos. A página atualiza automaticamente.
                  </p>
                </div>
              ) : reading.analysisStatus === "error" ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mb-4 opacity-40 text-destructive" />
                  <p className="font-sans text-lg">Erro ao gerar a análise</p>
                  <p className="text-sm mt-2">Tente novamente ou entre em contato com o suporte.</p>
                </div>
              ) : reading.analysis ? (
                <div className="prose prose-invert prose-headings:font-sans prose-headings:text-primary prose-p:text-foreground/90 prose-p:leading-relaxed prose-code:text-primary prose-code:bg-primary/10 prose-pre:bg-background/50 prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {withoutAffirmationAndAdvice(reading.analysis)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <p>Análise não disponível.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transits" className="space-y-8">
          <Card className="border-primary/25 bg-card/50 backdrop-blur-sm" data-testid="card-transit-map">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-sans text-xl flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Posições planetárias atuais
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Planetas em trânsito sobre o zodíaco.
                  </p>
                </div>
                {dailyTransits?.date && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(`${dailyTransits.date}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 md:p-6">
              {isTransitMapLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="status-transit-map-loading">
                  {Array.from({ length: 11 }, (_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : isTransitMapError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert" data-testid="status-transit-map-error">
                  <AlertCircle className="h-8 w-8 text-destructive opacity-70" />
                  <p className="text-sm text-muted-foreground">Não foi possível carregar as posições dos trânsitos.</p>
                  <Button variant="outline" size="sm" onClick={() => void refetchDailyTransits()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : dailyTransits?.planets.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="grid-transit-planets">
                  {dailyTransits.planets.map((planet) => (
                    <div
                      key={planet.name}
                      data-testid={`card-transit-planet-${planet.name.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-lg border border-border/40 bg-background/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{planet.name}</span>
                        {planet.retrograde && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rx</span>
                        )}
                      </div>
                      <p className="mt-2 text-primary font-sans text-lg">{planet.sign}</p>
                      <p className="text-xs text-muted-foreground font-mono">{formatDegMin(planet.degree)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground" data-testid="status-transit-map-empty">
                  Posições de trânsito indisponíveis no momento.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/25 bg-card/50 backdrop-blur-sm">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-sans text-xl flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Análise dos Trânsitos Astrológicos
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Leitura das ativações atuais sobre o mapa natal.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleGenerateTransitAnalysis}
                  disabled={generatingTransits || reading.transitAnalysisStatus === "generating"}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${(generatingTransits || reading.transitAnalysisStatus === "generating") ? "animate-spin" : ""}`} />
                  {generatingTransits || reading.transitAnalysisStatus === "generating"
                    ? "Gerando trânsitos…"
                    : reading.transitAnalysisStatus === "completed"
                      ? "Atualizar trânsitos"
                      : "Gerar análise dos trânsitos"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
              {reading.transitAnalysisStatus === "generating" ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 mb-3 animate-spin opacity-50" />
                  <p>A inteligência astrológica está analisando os trânsitos atuais…</p>
                </div>
              ) : reading.transitAnalysisStatus === "error" ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-3 text-destructive opacity-70" />
                  <p>Não foi possível gerar a análise dos trânsitos.</p>
                  <p className="text-sm mt-1">Clique novamente para tentar.</p>
                </div>
              ) : reading.transitAnalysis ? (
                <div className="prose prose-invert prose-headings:font-sans prose-headings:text-primary prose-p:text-foreground/90 prose-p:leading-relaxed max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {withoutAffirmationAndAdvice(reading.transitAnalysis)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <p>A análise dos trânsitos ainda não foi gerada.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="combined" className="space-y-8">
          <Card className="border-primary/25 bg-card/50 backdrop-blur-sm" data-testid="card-combined-map">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-sans text-xl flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Visão combinada
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compare as posições natais com as posições atuais dos trânsitos. Casas são exibidas apenas no mapa natal.
                  </p>
                </div>
                {dailyTransits?.date && (
                  <span className="text-xs text-muted-foreground">
                    Trânsitos de {format(new Date(`${dailyTransits.date}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isTransitMapLoading ? (
                <div className="space-y-3 p-5" data-testid="status-combined-map-loading">
                  {Array.from({ length: 11 }, (_, index) => (
                    <Skeleton key={index} className="h-11 w-full rounded-lg" />
                  ))}
                </div>
              ) : isTransitMapError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center" role="alert" data-testid="status-combined-map-error">
                  <AlertCircle className="h-8 w-8 text-destructive opacity-70" />
                  <p className="text-sm text-muted-foreground">Não foi possível carregar as posições dos trânsitos para a comparação.</p>
                  <Button variant="outline" size="sm" onClick={() => void refetchDailyTransits()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : dailyTransits?.planets.length ? (
                <div className="overflow-x-auto" data-testid="table-combined-map">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-muted-foreground">
                        <th scope="col" className="px-5 py-3 font-medium">Planeta</th>
                        <th scope="col" className="px-5 py-3 font-medium">Mapa natal</th>
                        <th scope="col" className="px-5 py-3 font-medium">Trânsito atual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {PLANETS.map((planet) => {
                        const natalPosition = (chart as Record<string, {sign?: string; house?: number; degree?: number; retrograde?: boolean}>)[planet.id];
                        const transitPosition = dailyTransits.planets.find(({ name }) => name === planet.label);
                        if (!natalPosition?.sign && !transitPosition) return null;

                        return (
                          <tr key={planet.id} data-testid={`row-combined-map-${planet.id}`}>
                            <th scope="row" className="px-5 py-3 font-medium">{planet.label}</th>
                            <td className="px-5 py-3">
                              {natalPosition?.sign ? (
                                <div>
                                  <span className="font-medium">{natalPosition.sign}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {natalPosition.house !== undefined ? `Casa ${natalPosition.house}` : ""}
                                    {natalPosition.degree !== undefined ? ` · ${formatDegMin(natalPosition.degree)}` : ""}
                                  </span>
                                  {natalPosition.retrograde && (
                                    <span className="ml-2 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rx</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              {transitPosition ? (
                                <div>
                                  <span className="font-medium">{transitPosition.sign}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{formatDegMin(transitPosition.degree)}</span>
                                  {transitPosition.retrograde && (
                                    <span className="ml-2 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">Rx</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground" data-testid="status-combined-map-empty">
                  Posições de trânsito indisponíveis para a comparação.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-sans text-xl flex items-center gap-2">
              <NotebookPen className="h-5 w-5 text-primary" />
              Notas do Cliente
            </CardTitle>
            {notesDirty && (
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
              >
                {savingNotes ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                {savingNotes ? "Salvando…" : "Salvar"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <Textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
            placeholder="Adicione observações sobre o cliente, contexto de vida, pontos importantes da consulta…"
            className="min-h-[120px] resize-y bg-background/50 border-border/50 focus:border-primary/50 text-sm leading-relaxed placeholder:text-muted-foreground/50"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {notes.length > 0
              ? `${notes.length} caracteres • `
              : ""}
            {notesDirty ? "Alterações não salvas" : reading?.notes ? "Salvo" : "Nenhuma nota"}
          </p>
        </CardContent>
      </Card>

      <Dialog open={recalcDialogOpen} onOpenChange={setRecalcDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-sans flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Recalcular Posições Planetárias
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              As posições serão recalculadas via efemérides astronômicas (sistema de casas Placidus).
              Escolha o fuso horário da hora de nascimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              Fuso horário
            </Label>
            <Select value={recalcTz} onValueChange={setRecalcTz}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECALC_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {recalcTz && recalcTz !== TZ_AUTO
                ? `Fuso manual: ${recalcTz}. A hora de nascimento será tratada como hora local neste fuso.`
                : "O fuso será detectado automaticamente pelas coordenadas do local de nascimento."}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecalcDialogOpen(false)} disabled={recalculating}>
              Cancelar
            </Button>
            <Button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {recalculating ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Recalculando…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Recalcular</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ASPECT_TYPES = ["Todos", "Conjunção", "Oposição", "Trígono", "Quadratura", "Sextil"] as const;

function AspectsSection({ aspects }: { aspects: { planet1: string; planet2: string; type: string; orb: number }[] }) {
  const [active, setActive] = useState<string>("Todos");

  const counts = ASPECT_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = t === "Todos" ? aspects.length : aspects.filter((a) => a.type === t).length;
    return acc;
  }, {});

  const filtered = active === "Todos" ? aspects : aspects.filter((a) => a.type === active);

  const filterStyle = (type: string) => {
    if (type === "Todos") return active === "Todos"
      ? "bg-primary/20 text-primary border-primary/40"
      : "text-muted-foreground border-border/40 hover:border-primary/30 hover:text-foreground";
    const s = ASPECT_STYLES[type];
    if (!s) return "";
    return active === type
      ? `${s.bg} ${s.color} ${s.border}`
      : "text-muted-foreground border-border/40 hover:border-primary/30 hover:text-foreground";
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="font-sans text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Aspectos
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({filtered.length}{active !== "Todos" ? ` de ${aspects.length}` : ""})
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {ASPECT_TYPES.map((type) => {
              const count = counts[type];
              if (type !== "Todos" && count === 0) return null;
              const sym = type !== "Todos" ? (ASPECT_STYLES[type]?.symbol ?? "") : null;
              return (
                <button
                  key={type}
                  onClick={() => setActive(type)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterStyle(type)}`}
                >
                  {sym && <span className="text-sm leading-none">{sym}</span>}
                  {type}
                  <span className="opacity-60 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((aspect, i) => (
            <AspectRow key={`${active}-${i}`} aspect={aspect} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">Nenhum aspecto deste tipo encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
}

const ASPECT_STYLES: Record<string, { symbol: string; color: string; bg: string; border: string }> = {
  "Conjunção":  { symbol: "☌", color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30" },
  "Oposição":   { symbol: "☍", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"   },
  "Trígono":    { symbol: "△", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  "Quadratura": { symbol: "□", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  "Sextil":     { symbol: "✶", color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30"   },
};

function AspectRow({ aspect }: { aspect: { planet1: string; planet2: string; type: string; orb: number } }) {
  const style = ASPECT_STYLES[aspect.type] ?? { symbol: "·", color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border/40" };
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/30 border border-border/20 text-sm">
      <span className="w-24 shrink-0 text-foreground/80 truncate">{aspect.planet1}</span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${style.bg} ${style.color} ${style.border}`}>
        <span className="text-base leading-none">{style.symbol}</span>
        {aspect.type}
      </span>
      <span className="w-24 shrink-0 text-foreground/80 truncate">{aspect.planet2}</span>
      <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0">{aspect.orb.toFixed(1)}°</span>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="font-sans text-lg font-medium text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
