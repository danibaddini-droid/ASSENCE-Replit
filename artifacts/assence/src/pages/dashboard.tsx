import { useGetReadingsStats, useListReadings, getGetReadingsStatsQueryKey, getListReadingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoonStar, Users, Clock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetReadingsStats({
    query: { queryKey: getGetReadingsStatsQueryKey() }
  });
  
  const { data: readings, isLoading: isReadingsLoading } = useListReadings({
    query: { queryKey: getListReadingsQueryKey() }
  });

  const recentReadings = readings?.slice(0, 5) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-primary mb-2">Visão Geral</h1>
        <p className="text-muted-foreground">O pulso das estrelas sob sua orientação.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total de Mapas" 
          value={stats?.total} 
          icon={Users} 
          loading={isStatsLoading} 
        />
        <StatCard 
          title="Mapas Concluídos" 
          value={stats?.completed} 
          icon={CheckCircle2} 
          loading={isStatsLoading} 
        />
        <StatCard 
          title="Este Mês" 
          value={stats?.thisMonth} 
          icon={Clock} 
          loading={isStatsLoading} 
        />
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Signo mais frequente</CardTitle>
            <MoonStar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-serif font-bold text-primary">
                {stats?.mostCommonSunSign || "N/A"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Análises Recentes
            </CardTitle>
            <Link href="/mapas" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isReadingsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentReadings.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <MoonStar className="h-12 w-12 mb-4 opacity-20" />
              <p>O céu está limpo.</p>
              <p className="text-sm mt-1">Gere sua primeira análise astrológica.</p>
              <Link href="/novo" className="mt-6 text-primary hover:text-primary/80 transition-colors inline-block px-6 py-2 border border-primary/30 rounded-full text-sm">
                Criar Novo Mapa
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {recentReadings.map((reading) => (
                <Link 
                  key={reading.id} 
                  href={`/mapa/${reading.id}`}
                  className="flex items-center justify-between p-4 md:p-6 hover:bg-white/5 transition-colors group"
                >
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-lg">
                      {reading.clientName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{format(new Date(reading.birthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        Sol em {reading.birthChart.sun.sign}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={reading.analysisStatus} />
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading }: any) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-serif font-bold text-foreground">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 font-normal">Concluído</Badge>;
    case 'generating':
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 font-normal animate-pulse">Gerando...</Badge>;
    case 'pending':
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 font-normal">Pendente</Badge>;
    case 'error':
      return <Badge variant="destructive" className="font-normal">Erro</Badge>;
    default:
      return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}
