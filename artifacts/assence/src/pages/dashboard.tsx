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
import { MoonStar, Users, Clock, CheckCircle2, ChevronRight, Sparkles, Cake, Globe, Sun, Orbit, Brain } from "lucide-react";
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
    <div className="-m-6 min-h-full space-y-8 bg-[#f8f6ef] p-6 text-[#233032] animate-in fade-in duration-500 md:-m-8 md:p-8 lg:-m-10 lg:p-10">
      <header className="relative isolate overflow-hidden rounded-2xl border border-[#e7e2d4] bg-[#f8f6ef] px-6 py-8 sm:px-9 sm:py-10">
        <div className="absolute inset-y-0 right-0 -z-10 w-2/3 overflow-hidden sm:w-1/2" aria-hidden="true">
          <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full bg-[#ebeee5]" />
          <div className="absolute -right-8 -top-16 h-64 w-64 rounded-full bg-[#e2ebe7]" />
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#d8e6e7]" />
          <div className="absolute right-8 top-10 h-40 w-64 -rotate-12 rounded-[50%] border border-[#d5c191]/80" />
          <div className="absolute right-0 top-4 h-52 w-72 -rotate-12 rounded-[50%] border border-[#d5c191]/70" />
          <div className="absolute right-12 top-14 h-32 w-32 rounded-full bg-[#6c9da5]/80" />
          <div className="absolute right-16 top-10 h-28 w-28 rounded-full bg-[#7daeb3]/75" />
        </div>
        <div className="relative max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#696f6c]">Assence · Astrologia para a vida</p>
          <h1 className="font-serif text-4xl font-medium leading-tight text-[#234852] sm:text-5xl">Visão Geral</h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-[#696f6c]">
            O pulso das estrelas sob sua orientação.
          </p>
          <div className="mt-6 h-px w-20 bg-[#b48c3c]" />
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Mapas" value={stats?.total} icon={Users} loading={isStatsLoading} />
        <StatCard title="Mapas Concluídos" value={stats?.completed} icon={CheckCircle2} loading={isStatsLoading} />
        <StatCard title="Este Mês" value={stats?.thisMonth} icon={Clock} loading={isStatsLoading} />
        <Card className="border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#696f6c]">Signo mais frequente</CardTitle>
            <MoonStar className="h-4 w-4 text-[#b48c3c]" />
          </CardHeader>
          <CardContent>
            {isStatsLoading ? <Skeleton className="h-8 w-20 bg-[#e8e4d9]" /> : (
              <div className="font-serif text-2xl font-semibold text-[#234852]">{stats?.mostCommonSunSign || "N/A"}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#b48c3c]">Leituras</p>
          <h2 className="font-serif text-2xl font-semibold text-[#234852]">Mapas e ciclos</h2>
          <p className="mt-1 text-sm text-[#696f6c]">
            Escolha uma leitura calculada a partir do mapa natal.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AnalysisOffer
            href="/novo?tipo=natal"
            title="Mapa Natal"
            description="A base da leitura: posições, casas, aspectos e dinâmica pessoal."
            icon={MoonStar}
            action="Criar mapa natal"
          />
          <AnalysisOffer
            href="/novo?tipo=solar-return"
            title="Revolução Solar"
            description="O ciclo anual calculado para o local onde a pessoa passará o aniversário."
            icon={Sun}
            action="Calcular revolução"
          />
          <AnalysisOffer
            href="/novo?tipo=secondary-progression"
            title="Progressão Secundária"
            description="A evolução interna do mapa, com destaque para a Lua progressada."
            icon={Orbit}
            action="Calcular progressões"
          />
          <AnalysisOffer
            href="/novo?tipo=integrated"
            title="Leitura Integrada"
            description="Mapa natal, Revolução Solar, Progressão Secundária e previsões mensais."
            icon={Brain}
            action="Gerar leitura completa"
            featured
          />
        </div>
      </section>

      {/* Daily Transits */}
      <Card className="border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm">
        <CardHeader className="border-b border-[#e9e4d8] pb-3">
          <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#234852]">
            <Globe className="h-5 w-5 text-[#b48c3c]" />
            Trânsitos do Dia
            {transits?.date && (
              <span className="ml-auto text-xs font-normal text-[#696f6c]">
                {format(new Date(transits.date + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {isTransitsLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {[...Array(11)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg bg-[#e8e4d9]" />)}
            </div>
          ) : (
            <>
              {/* Planet grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {(transits?.planets ?? []).map((p) => (
                  <div key={p.name} className="flex flex-col items-center gap-1 rounded-lg border border-[#e9e4d8] bg-[#fbfaf6] px-2 py-2.5 text-center">
                    <span className="text-lg leading-none text-[#b48c3c]">{PLANET_SYMBOLS[p.name] ?? "✦"}</span>
                    <span className="text-[10px] font-medium leading-tight text-[#696f6c]">{p.name}</span>
                    <span className="text-xs font-medium leading-tight text-[#234852]">{p.sign}</span>
                    <span className="text-[10px] text-[#8b8f89]">
                      {Math.floor(p.degree)}°{p.retrograde ? " ℞" : ""}
                    </span>
                  </div>
                ))}
              </div>

              {/* Activated clients */}
              {(transits?.activatedClients?.length ?? 0) > 0 ? (
                <div>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#696f6c]">
                    <Sparkles className="h-3 w-3 text-[#b48c3c]" />
                    Clientes mais ativados hoje
                  </p>
                  <div className="space-y-2">
                    {(transits?.activatedClients ?? []).map((client) => (
                      <Link key={client.readingId} href={`/mapa/${client.readingId}`}>
                        <div className="group flex cursor-pointer items-start gap-3 rounded-lg border border-[#e9e4d8] bg-[#fbfaf6] p-3 transition-all hover:border-[#b48c3c]/50 hover:bg-white">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d5c191] bg-[#f3eee0] text-xs font-bold text-[#234852]">
                            {client.score}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#234852] transition-colors group-hover:text-[#b48c3c]">
                              {client.clientName}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {client.transits.slice(0, 3).map((t, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${ASPECT_COLORS[t.type] ?? "text-[#696f6c] bg-[#f2f0e9] border-[#e5dfcf]"}`}
                                >
                                  {PLANET_SYMBOLS[t.transitPlanet] ?? t.transitPlanet} {t.type} {PLANET_SYMBOLS[t.natalPlanet] ?? t.natalPlanet} natal
                                  <span className="opacity-60">({t.orb}°)</span>
                                </span>
                              ))}
                              {client.transits.length > 3 && (
                                <span className="px-1 text-[10px] text-[#8b8f89]">+{client.transits.length - 3}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8b8f89] opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-2 text-center text-xs italic text-[#8b8f89]">
                  Nenhum cliente com trânsitos exatos hoje (orbe ≤ 3°).
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Birthdays */}
      {!isReadingsLoading && upcomingBirthdays.length > 0 && (
        <Card className="border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm">
          <CardHeader className="border-b border-[#e9e4d8] pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#234852]">
              <Cake className="h-5 w-5 text-[#b48c3c]" />
              Aniversários nos próximos {BIRTHDAY_WINDOW} dias
              <Badge className="ml-1 border-[#d5c191] bg-[#f3eee0] text-xs font-normal text-[#234852]">
                {upcomingBirthdays.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#e9e4d8]">
              {upcomingBirthdays.map((reading) => {
                const birth = new Date(reading.birthDate + "T00:00:00");
                const sunSign = reading.birthChart.sun?.sign;
                const isToday = reading.daysUntil === 0;
                const isTomorrow = reading.daysUntil === 1;
                return (
                  <Link key={reading.id} href={`/mapa/${reading.id}`}
                    className="group flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[#fbfaf6]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${
                        isToday ? "animate-pulse border border-[#b48c3c]/60 bg-[#f3eee0]" : "border border-[#e5dfcf] bg-[#fbfaf6]"
                      }`}>
                        {isToday ? "🎂" : "🎁"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#234852] transition-colors group-hover:text-[#b48c3c]">{reading.clientName}</p>
                        <p className="text-xs text-[#696f6c]">
                          {format(birth, "dd 'de' MMMM", { locale: ptBR })}
                          {sunSign && <span className="ml-2 opacity-70">• Sol em {sunSign}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {isToday ? (
                        <span className="animate-pulse rounded-full border border-[#d5c191] bg-[#f3eee0] px-2.5 py-1 text-xs font-semibold text-[#234852]">Hoje! 🎉</span>
                      ) : isTomorrow ? (
                        <span className="rounded-full border border-[#e5dfcf] bg-[#fbfaf6] px-2.5 py-1 text-xs font-medium text-[#234852]">Amanhã</span>
                      ) : (
                        <span className="rounded-full border border-[#e5dfcf] bg-[#fbfaf6] px-2.5 py-1 text-xs text-[#696f6c]">em {reading.daysUntil} dias</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-[#8b8f89] opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent analyses */}
      <Card className="border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm">
        <CardHeader className="border-b border-[#e9e4d8] bg-white/70">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-serif text-xl text-[#234852]">
              <Sparkles className="h-5 w-5 text-[#b48c3c]" />
              Análises Recentes
            </CardTitle>
            <Link href="/mapas" className="flex items-center gap-1 text-sm font-medium text-[#234852] hover:text-[#b48c3c]">
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isReadingsLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full bg-[#e8e4d9]" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4 bg-[#e8e4d9]" />
                    <Skeleton className="h-3 w-1/3 bg-[#e8e4d9]" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentReadings.length === 0 ? (
            <div className="flex flex-col items-center p-12 text-center text-[#696f6c]">
              <MoonStar className="mb-4 h-12 w-12 text-[#b48c3c] opacity-30" />
              <p>O céu está limpo.</p>
              <p className="text-sm mt-1">Gere sua primeira análise astrológica.</p>
              <Link href="/novo" className="mt-6 inline-block rounded-full border border-[#b48c3c]/50 px-6 py-2 text-sm text-[#234852] transition-colors hover:bg-[#f3eee0]">
                Criar Novo Mapa
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#e9e4d8]">
              {recentReadings.map((reading) => (
                <Link key={reading.id} href={`/mapa/${reading.id}`}
                  className="group flex items-center justify-between p-4 transition-colors hover:bg-[#fbfaf6] md:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-medium text-[#234852] transition-colors group-hover:text-[#b48c3c]">{reading.clientName}</h3>
                      <Badge variant="outline" className="border-[#e5dfcf] text-[10px] font-normal text-[#696f6c]">
                        {analysisTypeLabel(reading.birthChart)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-[#696f6c]">
                      <span>{format(new Date(reading.birthDate + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      <span>•</span>
                      <span>
                        {reading.birthChart.sun?.sign
                          ? `Sol em ${reading.birthChart.sun.sign}`
                          : reading.birthDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={reading.analysisStatus} />
                    <ChevronRight className="h-5 w-5 text-[#8b8f89] opacity-0 transition-opacity group-hover:opacity-100" />
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

function analysisTypeLabel(birthChart: unknown): string {
  const type = (birthChart as { analysisType?: string } | null)?.analysisType;
  switch (type) {
    case "solar-return": return "Revolução Solar";
    case "secondary-progression": return "Progressão Secundária";
    case "integrated": return "Leitura Integrada";
    default: return "Mapa Natal";
  }
}

function AnalysisOffer({
  href,
  title,
  description,
  icon: Icon,
  action,
  featured = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action: string;
  featured?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={`group h-full border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#b48c3c]/60 hover:shadow-md ${featured ? "bg-[#f3eee0]" : ""}`}>
        <CardContent className="flex h-full flex-col items-start p-5">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5dfcf] bg-[#fbfaf6] text-[#b48c3c] transition-colors group-hover:border-[#d5c191] group-hover:bg-[#f3eee0]">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-[#234852]">{title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[#696f6c]">{description}</p>
          <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[#234852] transition-colors group-hover:text-[#b48c3c]">
            {action}
            <ChevronRight className="h-4 w-4" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: number | undefined; icon: React.ElementType; loading: boolean }) {
  return (
    <Card className="border-[#e5dfcf] bg-white/90 text-[#233032] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-[#696f6c]">{title}</CardTitle>
        <Icon className="h-4 w-4 text-[#b48c3c]" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16 bg-[#e8e4d9]" /> : (
          <div className="font-serif text-2xl font-semibold text-[#234852]">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <Badge className="border-[#d5c191] bg-[#f3eee0] font-normal text-[#234852]">Concluído</Badge>;
    case 'generating': return <Badge className="animate-pulse border-[#a8c9cc] bg-[#e8f0ee] font-normal text-[#234852]">Gerando...</Badge>;
    case 'pending':    return <Badge className="border-[#e4c98c] bg-[#faf3df] font-normal text-[#765b22]">Pendente</Badge>;
    case 'error':      return <Badge variant="destructive" className="font-normal">Erro</Badge>;
    default:           return <Badge variant="outline" className="font-normal">{status}</Badge>;
  }
}
