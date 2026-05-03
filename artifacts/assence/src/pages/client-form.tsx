import { useState } from "react";
import { useCreateReading } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Star, MapPin, Clock, Calendar, Mail, User, CheckCircle2 } from "lucide-react";

export default function ClientForm() {
  const { toast } = useToast();
  const createReading = useCreateReading();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !birthDate || !birthPlace) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    try {
      await createReading.mutateAsync({
        data: {
          clientName: name,
          birthDate,
          birthTime: birthTime || null,
          birthPlace,
          clientEmail: email || null,
          autoCalculate: true,
        },
      });
      setSubmitted(true);
    } catch {
      toast({ title: "Erro ao enviar solicitação. Tente novamente.", variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background stars */}
      <div className="absolute inset-0 stars-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 constellation-lines opacity-15 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-center py-8 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-sans text-2xl font-medium tracking-wide text-foreground">
            Assence
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-lg">
          {submitted ? (
            <SuccessScreen name={name} />
          ) : (
            <>
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-5">
                  <Star className="h-3 w-3" />
                  Inteligência Astrológica Profunda
                </div>
                <h1 className="font-sans text-3xl md:text-4xl font-semibold text-foreground mb-3 leading-tight">
                  Solicite seu<br />
                  <span className="text-primary">Mapa Natal</span>
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto">
                  Preencha seus dados de nascimento e receba uma análise astrológica profunda pelo método Assence.
                </p>
              </div>

              {/* Form card */}
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-7 shadow-[0_0_40px_rgba(0,0,0,0.3)] space-y-5"
              >
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nome completo *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="bg-background/50 border-border/60 focus:border-primary/60 h-11"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    E-mail para contato
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-background/50 border-border/60 focus:border-primary/60 h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Birth date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate" className="flex items-center gap-1.5 text-sm font-medium">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      Data de nascimento *
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="bg-background/50 border-border/60 focus:border-primary/60 h-11"
                      required
                    />
                  </div>

                  {/* Birth time */}
                  <div className="space-y-1.5">
                    <Label htmlFor="birthTime" className="flex items-center gap-1.5 text-sm font-medium">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Hora de nascimento
                    </Label>
                    <Input
                      id="birthTime"
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      className="bg-background/50 border-border/60 focus:border-primary/60 h-11"
                    />
                  </div>
                </div>

                {/* Birth place */}
                <div className="space-y-1.5">
                  <Label htmlFor="birthPlace" className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Cidade de nascimento *
                  </Label>
                  <Input
                    id="birthPlace"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="Ex: São Paulo, SP, Brasil"
                    className="bg-background/50 border-border/60 focus:border-primary/60 h-11"
                    required
                  />
                </div>

                <p className="text-xs text-muted-foreground/70 leading-relaxed pt-1">
                  A hora de nascimento é recomendada para maior precisão do Ascendente e das Casas Astrológicas.
                  Se não souber, pode deixar em branco.
                </p>

                <Button
                  type="submit"
                  disabled={createReading.isPending}
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-base font-medium shadow-[0_0_20px_rgba(var(--primary-rgb),0.25)] transition-all"
                >
                  {createReading.isPending ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 animate-spin" />
                      Enviando…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Solicitar Mapa Natal
                    </span>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-8 px-4">
        <p className="text-xs text-muted-foreground/50 font-sans italic">
          "As estrelas inclinam, não obrigam."
        </p>
      </footer>
    </div>
  );
}

function SuccessScreen({ name }: { name: string }) {
  const firstName = name.split(" ")[0];
  return (
    <div className="text-center py-8 animate-in fade-in duration-700">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center">
            <Star className="h-3 w-3 text-primary" />
          </div>
        </div>
      </div>
      <h2 className="font-sans text-3xl font-semibold text-foreground mb-3">
        Obrigada, {firstName}!
      </h2>
      <p className="text-muted-foreground text-base leading-relaxed max-w-sm mx-auto mb-8">
        Sua solicitação foi recebida com sucesso. Em breve você receberá sua análise astrológica profunda pelo método Assence.
      </p>
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-5 max-w-sm mx-auto">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>Suas posições planetárias já foram calculadas e a análise está sendo preparada.</span>
        </div>
      </div>
    </div>
  );
}
