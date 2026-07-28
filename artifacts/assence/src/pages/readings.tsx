import { useState } from "react";
import { useListReadings, useDeleteReading, useUpdateReading, getListReadingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoonStar, Plus, Search, Trash2, ChevronRight, Star, Send, CheckCheck, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function AnalysisStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="border-primary/30 font-normal text-primary bg-[#f4af2533]">Concluído</Badge>;
    case "generating":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-normal animate-pulse">Gerando...</Badge>;
    case "pending":
      return <Badge className="border-amber-500/30 font-normal text-primary bg-[#fe9a0033]">Pendente</Badge>;
    case "error":
      return <Badge variant="destructive" className="font-normal">Erro</Badge>;
    default:
      return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}

function DeliveryBadge({ status }: { status: string }) {
  if (status === "delivered") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-normal gap-1">
        <CheckCheck className="h-3 w-3" />
        Entregue
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted/50 text-muted-foreground border-border/50 font-normal gap-1">
      <Send className="h-3 w-3" />
      Não entregue
    </Badge>
  );
}

type DeliveryFilter = "all" | "pending" | "delivered";

export default function Readings() {
  const { data: readings, isLoading } = useListReadings();
  const deleteReading = useDeleteReading();
  const updateReading = useUpdateReading();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [signFilter, setSignFilter] = useState("all");

  const getSunSign = (r: { birthChart: unknown }) =>
    ((r.birthChart as Record<string, { sign: string } | undefined>)?.sun?.sign) ?? null;

  const availableSigns = Array.from(
    new Set((readings ?? []).map(getSunSign).filter(Boolean) as string[])
  ).sort();

  const filtered = (readings ?? []).filter((r) => {
    const matchesSearch =
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.birthPlace?.toLowerCase().includes(search.toLowerCase());
    const matchesDelivery =
      deliveryFilter === "all" ||
      (deliveryFilter === "delivered" ? r.deliveryStatus === "delivered" : r.deliveryStatus !== "delivered");
    const matchesSign = signFilter === "all" || getSunSign(r) === signFilter;
    return matchesSearch && matchesDelivery && matchesSign;
  });

  const counts = {
    all: (readings ?? []).length,
    pending: (readings ?? []).filter((r) => r.deliveryStatus !== "delivered").length,
    delivered: (readings ?? []).filter((r) => r.deliveryStatus === "delivered").length,
  };

  async function handleDelete(e: React.MouseEvent, id: number, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remover o mapa de ${name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteReading.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getListReadingsQueryKey() });
      toast({ title: "Mapa removido" });
    } catch {
      toast({ title: "Erro ao remover mapa", variant: "destructive" });
    }
  }

  async function handleToggleDelivery(e: React.MouseEvent, id: number, current: string) {
    e.preventDefault();
    e.stopPropagation();
    const next = current === "delivered" ? "pending" : "delivered";
    try {
      await updateReading.mutateAsync({ id, data: { deliveryStatus: next } });
      await queryClient.invalidateQueries({ queryKey: getListReadingsQueryKey() });
      toast({ title: next === "delivered" ? "Marcado como entregue" : "Marcado como não entregue" });
    } catch {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  }

  const filterTabs: { key: DeliveryFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "pending", label: "Não entregues" },
    { key: "delivered", label: "Entregues" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-sans mb-1 text-primary">Mapas Natais</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Carregando…" : `${readings?.length ?? 0} mapa${readings?.length !== 1 ? "s" : ""} cadastrado${readings?.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link href="/novo">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Mapa
          </Button>
        </Link>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou local…"
              className="pl-9 bg-card/50 border-border/50"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Sign filter */}
            <Select value={signFilter} onValueChange={setSignFilter}>
              <SelectTrigger className="w-44 bg-card/50 border-border/50 h-10 text-sm gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Signo solar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os signos</SelectItem>
                {availableSigns.map((sign) => {
                  const count = (readings ?? []).filter((r) => getSunSign(r) === sign).length;
                  return (
                    <SelectItem key={sign} value={sign}>
                      {sign}
                      <span className="ml-auto text-muted-foreground text-xs pl-3">{count}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {/* Delivery filter tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card/50 p-1">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDeliveryFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    deliveryFilter === tab.key
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 ${
                    deliveryFilter === tab.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {counts[tab.key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Active sign filter pill */}
        {signFilter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrando por:</span>
            <button
              onClick={() => setSignFilter("all")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
            >
              ☀ Sol em {signFilter}
              <span className="ml-0.5 opacity-60">×</span>
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border-border/50 bg-card/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="py-16 flex flex-col items-center text-muted-foreground">
            <MoonStar className="h-14 w-14 mb-4 opacity-20" />
            {search || deliveryFilter !== "all" || signFilter !== "all" ? (
              <>
                <p className="text-lg font-sans">Nenhum resultado encontrado</p>
                <p className="text-sm mt-1">Tente ajustar os filtros de busca.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-sans">Nenhum mapa cadastrado ainda</p>
                <p className="text-sm mt-1">Comece criando a primeira análise astrológica.</p>
                <Link href="/novo" className="mt-6 text-primary hover:text-primary/80 transition-colors inline-block px-6 py-2 border border-primary/30 rounded-full text-sm">
                  Criar Primeiro Mapa
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((reading) => (
            <Link key={reading.id} href={`/mapa/${reading.id}`}>
              <Card className="border-border/50 bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
                      reading.deliveryStatus === "delivered"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                        : "text-primary bg-[#f4af251a] border-primary/40"
                    }`}>
                      {reading.deliveryStatus === "delivered"
                        ? <CheckCheck className="h-5 w-5" />
                        : <Star className="h-5 w-5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-sans text-lg font-medium group-hover:text-primary transition-colors truncate text-primary bg-[transparent]">
                        {reading.clientName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm text-muted-foreground">
                        <span>{format(new Date(reading.birthDate + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                        {reading.birthPlace && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline truncate max-w-40">{reading.birthPlace}</span>
                          </>
                        )}
                        {(reading.birthChart as Record<string, unknown>)?.sun && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">Sol em {(reading.birthChart as Record<string, {sign:string}>).sun.sign}</span>
                          </>
                        )}
                      </div>
                      {reading.notes && (
                        <p className="mt-1.5 text-xs text-muted-foreground/60 italic truncate max-w-md">
                          {reading.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden sm:flex items-center gap-2">
                        <AnalysisStatusBadge status={reading.analysisStatus} />
                        <DeliveryBadge status={reading.deliveryStatus ?? "pending"} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity ${
                          reading.deliveryStatus === "delivered"
                            ? "text-emerald-400 hover:text-muted-foreground"
                            : "text-muted-foreground hover:text-emerald-400"
                        }`}
                        onClick={(e) => handleToggleDelivery(e, reading.id, reading.deliveryStatus ?? "pending")}
                        title={reading.deliveryStatus === "delivered" ? "Marcar como não entregue" : "Marcar como entregue"}
                      >
                        {reading.deliveryStatus === "delivered"
                          ? <CheckCheck className="h-4 w-4" />
                          : <Send className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(e, reading.id, reading.clientName)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
