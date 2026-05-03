import {
  useGetReadingsStats,
  useListReadings,
  useGetDailyTransits,
  getGetReadingsStatsQueryKey,
  getListReadingsQueryKey,
  getGetDailyTransitsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MoonStar, Users, Clock, CheckCircle2, ChevronRight, Sparkles, Cake, Globe } from "lucide-react";
import { Link } from "wouter";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const BIRTHDAY_WINDOW = 30;

const PLANET_SYMBOLS: Record<string, string> = {
  "Sol": "☉", "Lua": "☽", "Mercúrio": "☿", "Vênus": "♀", "Marte": "♂",
  "Júpiter": "♃", "Saturno": "♄", "Urano": "♅", "Netuno": "♆", "Plutão": "♇",
  "Nodo Norte": "☊",
};

const ASPECT_COLORS: Record<string, string> = {
  "Conjunção":  "text-primary bg-primary/15 border-primary/30",
  "Trígono":    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  "Sextil":     "text-sky-400 bg-sky-500/10 border-sky-500/25",
  "Quadratura": "text-rose-400 bg-rose-500/10 border-rose-500/25",
  "Oposição":   "text-orange-400 bg-orange-500/10 border-orange-500/25",
};

function daysUntilBirthday(birthDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(birthDateStr + "T00:00:00");
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  return differenceInCalendarDays(next, today);
}

export default function Dashboard() {
  const { data: stats, isLoading: isStatsLoading } = useGetReadingsStats({
    query: { queryKey: getGetReadingsStatsQueryKey() }
  });
  const { data: readings, isLoading: isReadingsLoading } = useListReadings({
    query: { queryKey: getListReadingsQueryKey() }
  });
  const { data: transits, isLoading: isTransitsLoading } = useGetDailyTransits({
    query: { queryKey: getGetDailyTransitsQueryKey(), staleTime: 1000 * 60 * 30 }
  });

  const recentReadings = readings?.slice(0, 5) || [];

  const upcomingBirthdays = (readings ?? [])
    .map((r) => ({ ...r, daysUntil: daysUntilBirthday(r.birthDate) }))
    .filter((r) => r.daysUntil <= BIRTHDAY_WINDOW)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-sans text-primary mb-2">Visão Geral</h1>
        <p className="text-muted-foreground">O pulso das estrelas sob sua orientação.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Mapas" value={stats?.total} icon={Users} loading={isStatsLoading} />
        <StatCard title="Mapas Concluídos" value={stats?.completed} icon={CheckCircle2} loading={isStatsLoading} />
        <StatCard title="Este Mês" value={stats?.thisMonth} icon={Clock} loading={isStatsLoading} />
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Signo mais frequente</CardTitle>
            <MoonStar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-sans font-bold text-primary">{stats?.mostCommonSunSign || "N/A"}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Transits */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="font-sans text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Trânsitos do Dia
            {transits?.date && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {format(new Date(transits.date + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {isTransitsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {[...Array(11)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* Planet grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {(transits?.planets ?? []).map((p) => (
                  <div key={p.name} className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-background/50 px-2 py-2.5 text-center">
                    <span className="text-lg text-primary leading-none">{PLANET_SYMBOLS[p.name] ?? "✦"}</span>
                    <span className="text-[10px] font-medium text-muted-foreground leading-tight">{p.name}</span>
                    <span className="text-xs font-medium text-foreground leading-tight">{p.sign}</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {Math.floor(p.degree)}°{p.retrograde ? " ℞" : ""}
                    </span>
                  </div>
                ))}
              </div>

              {/* Activated clients */}
              {(transits?.activatedClients?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                    Clientes mais ativados hoje
                  </p>
                  <div className="space-y-2">
                    {(transits?.activatedClients ?? []).map((client) => (
                      <Link key={client.readingId} href={`/mapa/${client.readingId}`}>
                        <div className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 p-3 hover:bg-background/60 hover:border-primary/25 transition-all group cursor-pointer">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
                            {client.score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                              {client.clientName}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {client.transits.slice(0, 3).map((t, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${ASPECT_COLORS[t.type] ?? "text-muted-foreground bg-muted/30 border-border/40"}`}
                                >
                                  {PLANET_SYMBOLS[t.transitPlanet] ?? t.transitPlanet} {t.type} {PLANET_SYMBOLS[t.natalPlanet] ?? t.natalPlanet} natal
                                  <span className="opacity-60">({t.orb}°)</span>
                                </span>
                              ))}
                              {client.transits.length > 3 && (
                                <span className="text-[10px] text-muted-foreground/60 px-1">+{client.transits.length - 3}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic text-center py-2">
                  Nenhum cliente com trânsitos exatos hoje (orbe ≤ 3°).
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Birthdays */}
      {!isReadingsLoading && upcomingBirthdays.length > 0 && (
        <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
          <CardHeader className="border-b border-primary/15 pb-3">
            <CardTitle className="font-sans text-lg flex items-center gap-2 text-primary">
              <Cake className="h-5 w-5 text-primary" />
              Aniversários nos próximos {BIRTHDAY_WINDOW} dias
              <Badge className="ml-1 bg-primary/20 text-primary border-primary/30 font-normal text-xs">
                {upcomingBirthdays.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-primary/10">
              {upcomingBirthdays.map((reading) => {
                const birth = new Date(reading.birthDate + "T00:00:00");
                const sunSign = (reading.birthChart as Record<string, {sign:string}> | null)?.sun?.sign;
                const isToday = reading.daysUntil === 0;
                const isTomorrow = reading.daysUntil === 1;
                return (
                  <Link key={reading.id} href={`/mapa/${reading.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-primary/5 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
                        isToday ? "bg-primary/25 border border-primary/50 animate-pulse" : "bg-primary/10 border border-primary/20"
                      }`}>
                        {isToday ? "🎂" : "🎁"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">{reading.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(birth, "dd 'de' MMMM", { locale: ptBR })}
                          {sunSign && <span className="ml-2 opacity-70">• Sol em {sunSign}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {isToday ? (
                        <span className="text-xs font-semibold text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded-full animate-pulse">Hoje! 🎉</span>
                      ) : isTomorrow ? (
                        <span className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">Amanhã</span>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted/50 border border-border/40 px-2.5 py-1 rounded-full">em {reading.daysUntil} dias</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent analyses */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <CardTitle className="font-sans text-xl flex items-center gap-2">
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
                <Link key={reading.id} href={`/mapa/${reading.id}`}
                  className="flex items-center justify-between p-4 md:p-6 hover:bg-white/5 transition-colors group">
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-lg">{reading.clientName}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{format(new Date(reading.birthDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      <span>•</span>
                      <span>
                        {(reading.birthChart as Record<string, unknown> | null)?.sun
                          ? `Sol em ${(reading.birthChart as Record<string, {sign:string}>).sun.sign}`
                          : reading.birthDate}
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

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: number | undefined; icon: React.ElementType; loading: boolean }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : (
          <div className="text-2xl font-sans font-bold text-foreground">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <Badge className="bg-primary/20 text-primary border-primary/30 font-normal">Concluído</Badge>;
    case 'generating': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-normal animate-pulse">Gerando...</Badge>;
    case 'pending':    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-normal">Pendente</Badge>;
    case 'error':      return <Badge variant="destructive" className="font-normal">Erro</Badge>;
    default:           return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}
