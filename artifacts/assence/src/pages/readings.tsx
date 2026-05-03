import { useState } from "react";
import { useListReadings, useDeleteReading, getListReadingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoonStar, Plus, Search, Trash2, ChevronRight, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="border-primary/30 font-normal text-[#25f4e3] bg-[#f4af2533]">Concluído</Badge>;
    case "generating":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-normal animate-pulse">Gerando...</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-normal">Pendente</Badge>;
    case "error":
      return <Badge variant="destructive" className="font-normal">Erro</Badge>;
    default:
      return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}

export default function Readings() {
  const { data: readings, isLoading } = useListReadings();
  const deleteReading = useDeleteReading();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const filtered = (readings ?? []).filter((r) =>
    r.clientName.toLowerCase().includes(search.toLowerCase()) ||
    r.birthPlace?.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif mb-1 text-[#25f4e3]">Mapas Natais</h1>
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou local…"
          className="pl-9 bg-card/50 border-border/50"
        />
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
            {search ? (
              <>
                <p className="text-lg font-serif">Nenhum resultado para "{search}"</p>
                <p className="text-sm mt-1">Tente outro nome ou local.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-serif">Nenhum mapa cadastrado ainda</p>
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
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#25f4e3] bg-[#f4af251a] border-t-[#25f4e3] border-r-[#25f4e3] border-b-[#25f4e3] border-l-[#25f4e3]">
                      <Star className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg font-medium group-hover:text-primary transition-colors truncate text-[#25f4e3] bg-[transparent]">
                        {reading.clientName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm text-muted-foreground">
                        <span>{format(new Date(reading.birthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                        {reading.birthPlace && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline truncate max-w-40">{reading.birthPlace}</span>
                          </>
                        )}
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">Sol em {reading.birthChart.sun.sign}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={reading.analysisStatus} />
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
