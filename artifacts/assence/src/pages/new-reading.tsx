import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateReading } from "@workspace/api-client-react";
import { SIGNS, PLANETS, ASPECT_TYPES, HOUSES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2, Sparkles, ChevronDown, ChevronUp, User, Star, Home, Wand2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type PlanetEntry = {
  sign: string;
  house: number;
  degrees: number;
  minutes: number;
  retrograde: boolean;
};

type HouseCuspEntry = {
  sign: string;
  degrees: number;
  minutes: number;
};

type AspectEntry = {
  planet1: string;
  planet2: string;
  type: string;
  orb: number;
};

const defaultPlanet = (): PlanetEntry => ({ sign: "Áries", house: 1, degrees: 0, minutes: 0, retrograde: false });
const defaultCusp = (): HouseCuspEntry => ({ sign: "Áries", degrees: 0, minutes: 0 });

function toDecimal(degrees: number, minutes: number): number {
  return degrees + minutes / 60;
}

function DegMinInput({
  degrees,
  minutes,
  onDegrees,
  onMinutes,
}: {
  degrees: number;
  minutes: number;
  onDegrees: (v: number) => void;
  onMinutes: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Input
        type="number"
        min={0}
        max={29}
        value={degrees}
        onChange={(e) => {
          const v = Math.min(29, Math.max(0, parseInt(e.target.value) || 0));
          onDegrees(v);
        }}
        className="h-8 text-xs bg-background/50 w-10 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="°"
      />
      <span className="text-muted-foreground text-xs select-none">°</span>
      <Input
        type="number"
        min={0}
        max={59}
        value={minutes}
        onChange={(e) => {
          const v = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
          onMinutes(v);
        }}
        className="h-8 text-xs bg-background/50 w-10 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        placeholder="'"
      />
      <span className="text-muted-foreground text-xs select-none">'</span>
    </div>
  );
}

export default function NewReading() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const createReading = useCreateReading();

  const [mode, setMode] = useState<"auto" | "manual">("auto");

  const [clientName, setClientName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [clientAge, setClientAge] = useState("");

  const [ascendant, setAscendant] = useState("Áries");
  const [midheaven, setMidheaven] = useState("Capricórnio");

  const [planets, setPlanets] = useState<Record<string, PlanetEntry>>(() =>
    Object.fromEntries(PLANETS.map((p) => [p.id, defaultPlanet()]))
  );

  const [houseCusps, setHouseCusps] = useState<HouseCuspEntry[]>(() =>
    Array.from({ length: 12 }, defaultCusp)
  );

  const [aspects, setAspects] = useState<AspectEntry[]>([]);
  const [showPlanets, setShowPlanets] = useState(true);
  const [showCusps, setShowCusps] = useState(false);
  const [showAspects, setShowAspects] = useState(false);

  function updatePlanet(id: string, field: keyof PlanetEntry, value: string | number | boolean) {
    setPlanets((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function updateCusp(i: number, field: keyof HouseCuspEntry, value: string | number) {
    setHouseCusps((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  }

  function addAspect() {
    setAspects((prev) => [...prev, { planet1: "Sol", planet2: "Lua", type: "Conjunção", orb: 0 }]);
  }

  function removeAspect(i: number) {
    setAspects((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateAspect(i: number, field: keyof AspectEntry, value: string | number) {
    setAspects((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName || !birthDate || !birthPlace) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    try {
      if (mode === "auto") {
        const result = await createReading.mutateAsync({
          clientName,
          birthDate,
          birthTime: birthTime || undefined,
          birthPlace,
          clientAge: clientAge ? parseInt(clientAge) : undefined,
          autoCalculate: true,
        });
        toast({ title: "Mapa criado!", description: "A IA está calculando as posições e gerando a análise…" });
        navigate(`/mapa/${result.id}`);
      } else {
        const result = await createReading.mutateAsync({
          clientName,
          birthDate,
          birthTime: birthTime || undefined,
          birthPlace,
          clientAge: clientAge ? parseInt(clientAge) : undefined,
          birthChart: {
            ascendant,
            midheaven,
            ...Object.fromEntries(
              PLANETS.map((p) => [
                p.id,
                {
                  sign: planets[p.id].sign,
                  house: planets[p.id].house,
                  degree: toDecimal(planets[p.id].degrees, planets[p.id].minutes),
                  retrograde: planets[p.id].retrograde,
                },
              ])
            ),
            houseCusps: houseCusps.map((c, i) => ({
              house: i + 1,
              sign: c.sign,
              degrees: c.degrees,
              minutes: c.minutes,
            })),
            aspects,
          },
        });
        toast({ title: "Mapa criado com sucesso!", description: "A análise está sendo gerada…" });
        navigate(`/mapa/${result.id}`);
      }
    } catch {
      toast({ title: "Erro ao criar mapa", variant: "destructive" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-3xl font-serif text-primary mb-2">Novo Mapa Natal</h1>
        <p className="text-muted-foreground">Insira os dados para gerar a análise astrológica profunda pelo método Assence.</p>
      </div>

      {/* Modo: Auto / Manual */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-5 text-left transition-all",
            mode === "auto"
              ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]"
              : "border-border/40 bg-card/30 text-muted-foreground hover:border-border/60 hover:bg-card/50"
          )}
        >
          <Wand2 className={cn("h-6 w-6", mode === "auto" ? "text-primary" : "text-muted-foreground")} />
          <div>
            <p className={cn("font-semibold text-sm", mode === "auto" ? "text-foreground" : "")}>Automático</p>
            <p className="text-xs text-muted-foreground mt-0.5">A IA calcula as posições a partir dos dados de nascimento</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-5 text-left transition-all",
            mode === "manual"
              ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]"
              : "border-border/40 bg-card/30 text-muted-foreground hover:border-border/60 hover:bg-card/50"
          )}
        >
          <SlidersHorizontal className={cn("h-6 w-6", mode === "manual" ? "text-primary" : "text-muted-foreground")} />
          <div>
            <p className={cn("font-semibold text-sm", mode === "manual" ? "text-foreground" : "")}>Manual</p>
            <p className="text-xs text-muted-foreground mt-0.5">Insira as posições planetárias manualmente para maior precisão</p>
          </div>
        </button>
      </div>

      {/* Dados da pessoa */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Dados da Pessoa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="clientName">Nome completo *</Label>
            <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)}
              placeholder="Ana Carolina Silva" className="bg-background/50" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birthDate">Data de nascimento *</Label>
            <Input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
              className="bg-background/50" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birthTime">Hora de nascimento</Label>
            <Input id="birthTime" type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)}
              className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birthPlace">Local de nascimento *</Label>
            <Input id="birthPlace" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)}
              placeholder="São Paulo, SP, Brasil" className="bg-background/50" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clientAge">Idade</Label>
            <Input id="clientAge" type="number" min={1} max={120} value={clientAge}
              onChange={(e) => setClientAge(e.target.value)} placeholder="35" className="bg-background/50" />
          </div>
        </CardContent>
      </Card>

      {/* Seções manuais — visíveis apenas no modo manual */}
      {mode === "manual" && (
        <>
          {/* Posições planetárias */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader
              className="border-b border-border/50 cursor-pointer select-none"
              onClick={() => setShowPlanets((v) => !v)}
            >
              <CardTitle className="font-serif text-xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Posições Planetárias
                </span>
                {showPlanets ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            {showPlanets && (
              <CardContent className="pt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Ascendente</Label>
                    <Select value={ascendant} onValueChange={setAscendant}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{SIGNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meio-do-Céu (MC)</Label>
                    <Select value={midheaven} onValueChange={setMidheaven}>
                      <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{SIGNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-[80px_1fr_90px_110px_36px] gap-2 px-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Planeta</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Signo</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Casa</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Grau °&nbsp;&nbsp; Min '</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">Rx</span>
                </div>

                <div className="space-y-1.5">
                  {PLANETS.map((planet) => (
                    <div key={planet.id} className="grid grid-cols-[80px_1fr_90px_110px_36px] gap-2 items-center px-3 py-2.5 rounded-lg bg-background/30 border border-border/30">
                      <span className="text-sm font-medium text-muted-foreground truncate">{planet.label}</span>

                      <Select value={planets[planet.id].sign} onValueChange={(v) => updatePlanet(planet.id, "sign", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{SIGNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>

                      <Select value={String(planets[planet.id].house)} onValueChange={(v) => updatePlanet(planet.id, "house", parseInt(v))}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{HOUSES.map((h) => <SelectItem key={h} value={String(h)}>Casa {h}</SelectItem>)}</SelectContent>
                      </Select>

                      <DegMinInput
                        degrees={planets[planet.id].degrees}
                        minutes={planets[planet.id].minutes}
                        onDegrees={(v) => updatePlanet(planet.id, "degrees", v)}
                        onMinutes={(v) => updatePlanet(planet.id, "minutes", v)}
                      />

                      <button
                        type="button"
                        onClick={() => updatePlanet(planet.id, "retrograde", !planets[planet.id].retrograde)}
                        className={cn(
                          "h-8 w-8 flex items-center justify-center text-xs rounded border transition-colors",
                          planets[planet.id].retrograde
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "bg-transparent text-muted-foreground border-border/40 hover:border-border"
                        )}
                      >
                        Rx
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Cúspides das casas */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader
              className="border-b border-border/50 cursor-pointer select-none"
              onClick={() => setShowCusps((v) => !v)}
            >
              <CardTitle className="font-serif text-xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  Cúspides das Casas
                </span>
                {showCusps ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            {showCusps && (
              <CardContent className="pt-6 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Graus e minutos do início de cada casa no mapa natal.
                </p>
                <div className="grid grid-cols-[70px_1fr_110px] gap-3 px-3">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Casa</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Signo</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Grau °&nbsp;&nbsp; Min '</span>
                </div>
                <div className="grid md:grid-cols-2 gap-1.5">
                  {houseCusps.map((cusp, i) => (
                    <div key={i} className="grid grid-cols-[70px_1fr_110px] gap-3 items-center px-3 py-2 rounded-lg bg-background/30 border border-border/30">
                      <span className="text-sm font-medium text-primary">Casa {i + 1}</span>
                      <Select value={cusp.sign} onValueChange={(v) => updateCusp(i, "sign", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{SIGNS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <DegMinInput
                        degrees={cusp.degrees}
                        minutes={cusp.minutes}
                        onDegrees={(v) => updateCusp(i, "degrees", v)}
                        onMinutes={(v) => updateCusp(i, "minutes", v)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Aspectos */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader
              className="border-b border-border/50 cursor-pointer select-none"
              onClick={() => setShowAspects((v) => !v)}
            >
              <CardTitle className="font-serif text-xl flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Aspectos Planetários
                </span>
                {showAspects ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            {showAspects && (
              <CardContent className="pt-6 space-y-3">
                {aspects.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum aspecto adicionado. Os aspectos são opcionais mas enriquecem a análise.
                  </p>
                )}
                {aspects.map((aspect, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-background/30 border border-border/30">
                    <div className="col-span-3">
                      <Select value={aspect.planet1} onValueChange={(v) => updateAspect(i, "planet1", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{PLANETS.map((p) => <SelectItem key={p.id} value={p.label}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <Select value={aspect.type} onValueChange={(v) => updateAspect(i, "type", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{ASPECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Select value={aspect.planet2} onValueChange={(v) => updateAspect(i, "planet2", v)}>
                        <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                        <SelectContent>{PLANETS.map((p) => <SelectItem key={p.id} value={p.label}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Input type="number" min={0} max={10} step={0.1} value={aspect.orb}
                        onChange={(e) => updateAspect(i, "orb", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs bg-background/50 px-1 text-center" placeholder="orbe" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAspect(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addAspect}
                  className="w-full border-dashed border-border/50 text-muted-foreground hover:text-foreground">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Adicionar Aspecto
                </Button>
              </CardContent>
            )}
          </Card>
        </>
      )}

      <div className="flex justify-end gap-3 pb-8">
        <Button type="button" variant="outline" onClick={() => navigate("/mapas")}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createReading.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-36">
          {createReading.isPending ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin" />
              Criando…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {mode === "auto" ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {mode === "auto" ? "Gerar Automaticamente" : "Gerar Análise"}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
