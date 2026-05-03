import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetConversation, getGetConversationQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Send, Sparkles, User, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Message = {
  id?: number;
  role: string;
  content: string;
  streaming?: boolean;
};

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id ?? "0", 10);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: conv, isLoading } = useGetConversation(convId, {
    query: { queryKey: getGetConversationQueryKey(convId) },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conv?.messages) {
      setMessages(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    }
  }, [conv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/openai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) throw new Error("Erro ao enviar mensagem");
      if (!res.body) throw new Error("Sem stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.content) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.streaming) {
                  copy[copy.length - 1] = { ...last, content: last.content + parsed.content };
                }
                return copy;
              });
            }
            if (parsed.done) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.streaming) {
                  copy[copy.length - 1] = { ...last, streaming: false };
                }
                return copy;
              });
              await queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId) });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.streaming) {
          copy[copy.length - 1] = { ...last, content: "Erro ao obter resposta. Tente novamente.", streaming: false };
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-300">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="flex-1" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-30" />
        <p className="font-sans text-lg">Conversa não encontrada</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/mapas")}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar aos mapas
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-500">
      <div className="mb-4 shrink-0">
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </button>
        <h1 className="text-2xl font-sans text-primary">{conv.title ?? "Consulta Astrológica"}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Faça perguntas sobre o mapa natal e receba respostas baseadas no método Assence.
        </p>
      </div>

      <Card className="flex-1 border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <Sparkles className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-sans text-lg text-center">Inicie a conversa</p>
              <p className="text-sm mt-1 text-center max-w-xs opacity-70">
                Faça perguntas sobre aspectos, trânsitos, propósito de alma, padrões psicológicos e muito mais.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary/15 text-foreground rounded-tr-sm"
                      : "bg-card border border-border/50 text-foreground/90 rounded-tl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className={cn(
                      "prose prose-sm prose-invert prose-headings:font-sans prose-headings:text-primary prose-p:my-1 prose-headings:my-2 max-w-none",
                      msg.streaming && "after:content-['▋'] after:animate-pulse after:text-primary after:ml-0.5"
                    )}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || " "}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground mt-1">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/50 p-3 md:p-4 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre o mapa natal… (Enter para enviar, Shift+Enter para nova linha)"
              className="resize-none min-h-[52px] max-h-40 bg-background/50 border-border/50 text-sm"
              rows={2}
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              size="icon"
              className="h-[52px] w-12 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {sending ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Assence usa IA para análise astrológica psicológica e evolutiva.
          </p>
        </div>
      </Card>
    </div>
  );
}
