import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetReading,
  getGetReadingQueryKey,
  useCreateConversation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, ChevronLeft, Star, MoonStar, Sparkles, RefreshCw, AlertCircle, Download } from "lucide-react";
import { PLANETS } from "@/lib/constants";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useToast } from "@/hooks/use-toast";
import { exportReadingPDF } from "@/lib/export-pdf";

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

export default function ReadingView() {
  const { id } = useParams<{ id: string }>();
  const readingId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createConversation = useCreateConversation();
  const [exporting, setExporting] = useState(false);

  const { data: reading, isLoading } = useGetReading(readingId, {
    query: {
      queryKey: getGetReadingQueryKey(readingId),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return false;
        if (data.analysisStatus === "generating" || data.analysisStatus === "pending") return 3000;
        return false;
      },
    },
  });

  async function handleStartChat() {
    if (!reading) return;
    try {
      const conv = await createConversation.mutateAsync({
        title: `Conversa sobre ${reading.clientName}`,
        readingId: reading.id,
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
        <p className="font-serif text-lg">Mapa não encontrado</p>
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
          <h1 className="text-3xl font-serif text-primary">{reading.clientName}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-muted-foreground">
            <span>{format(new Date(reading.birthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {reading.birthTime && <><span>•</span><span>{reading.birthTime}</span></>}
            {reading.birthPlace && <><span>•</span><span>{reading.birthPlace}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-8">
          <StatusBadge status={reading.analysisStatus} />
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
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard icon={Star} label="Ascendente" value={chart.ascendant} />
        <InfoCard icon={MoonStar} label="Meio-do-Céu" value={chart.midheaven} />
        <InfoCard icon={Sparkles} label="Sol" value={`${chart.sun.sign} • Casa ${chart.sun.house}`} />
        <InfoCard icon={MoonStar} label="Lua" value={`${chart.moon.sign} • Casa ${chart.moon.house}`} />
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Planetas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {PLANETS.map((planet) => {
              const pos = (chart as Record<string, {sign?: string; house?: number; degree?: number; retrograde?: boolean}>)[planet.id];
              if (!pos?.sign) return null;
              return (
                <div key={planet.id} className="flex items-center justify-between px-5 py-3 text-sm">
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
            <CardTitle className="font-serif text-xl flex items-center gap-2">
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

      {chart.aspects && chart.aspects.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Aspectos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {chart.aspects.map((aspect: {planet1: string; planet2: string; type: string; orb: number}, i: number) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{aspect.planet1}</span>
                  <Badge variant="outline" className="text-xs font-normal">{aspect.type}</Badge>
                  <span className="font-medium">{aspect.planet2}</span>
                  <span className="text-muted-foreground text-xs w-16 text-right">orbe {aspect.orb.toFixed(1)}°</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análise Astrológica Assence
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          {reading.analysisStatus === "pending" || reading.analysisStatus === "generating" ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-10 w-10 mb-4 animate-spin opacity-40" />
              <p className="font-serif text-lg text-center">
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
              <p className="font-serif text-lg">Erro ao gerar a análise</p>
              <p className="text-sm mt-2">Tente novamente ou entre em contato com o suporte.</p>
            </div>
          ) : reading.analysis ? (
            <div className="prose prose-invert prose-headings:font-serif prose-headings:text-primary prose-p:text-foreground/90 prose-p:leading-relaxed prose-code:text-primary prose-code:bg-primary/10 prose-pre:bg-background/50 prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reading.analysis}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>Análise não disponível.</p>
            </div>
          )}
        </CardContent>
      </Card>
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
        <p className="font-serif text-lg font-medium text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
