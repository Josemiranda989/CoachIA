"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Bot, Check, RotateCcw, Send, Trash2, X } from "lucide-react";

const STORAGE_KEY = "coachia-coach-chat";

interface Proposal {
  id: string;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  /** estado local de la card */
  status?: "pending" | "applied" | "dismissed";
  changeLogId?: string;
  undone?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  proposals?: Proposal[];
}

export function CoachChatClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restaurar conversación (mismo patrón que coachia-gym-session)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
        if (saved.routineId) setRoutineId(saved.routineId);
      }
    } catch {
      // storage corrupto → empezar de cero
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, routineId }));
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, routineId]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error consultando al coach");
      setRoutineId(data.routineId ?? null);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          proposals: (data.proposals ?? []).map((p: Proposal) => ({
            ...p,
            status: "pending" as const,
          })),
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error consultando al coach");
      // devolver el input para no perder el mensaje
      setMessages(messages);
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const updateProposal = (msgIdx: number, propId: string, patch: Partial<Proposal>) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIdx
          ? {
              ...m,
              proposals: m.proposals?.map((p) => (p.id === propId ? { ...p, ...patch } : p)),
            }
          : m
      )
    );
  };

  const applyProposal = async (msgIdx: number, prop: Proposal) => {
    if (!routineId) {
      toast.error("No hay rutina activa esta semana");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/coach/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routineId,
          proposals: [{ name: prop.name, args: prop.args }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo aplicar");
      const changeLogId = data.applied?.[0]?.changeLogId;
      updateProposal(msgIdx, prop.id, { status: "applied", changeLogId });
      toast.success(`Aplicado: ${prop.summary}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aplicar");
    } finally {
      setLoading(false);
    }
  };

  const undoProposal = async (msgIdx: number, prop: Proposal) => {
    if (!prop.changeLogId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/coach/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeLogId: prop.changeLogId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo deshacer");
      updateProposal(msgIdx, prop.id, { undone: true });
      toast.success(`Deshecho: ${prop.summary}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo deshacer");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setRoutineId(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Hilo */}
      <div className="flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="card text-sm text-text-secondary">
            <p className="mb-2 font-semibold text-text-primary">Ejemplos:</p>
            <ul className="space-y-1">
              <li>· &ldquo;Vengo fundido, bajame el jueves a Z2&rdquo;</li>
              <li>· &ldquo;Hoy llueve, adaptá la salida al rodillo con 40 min&rdquo;</li>
              <li>· &ldquo;¿Cómo viene mi forma para el mesociclo?&rdquo;</li>
              <li>· &ldquo;Mové el gym de mañana al viernes&rdquo;</li>
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i}>
            <div
              className="card"
              style={{
                maxWidth: "85%",
                marginLeft: m.role === "user" ? "auto" : 0,
                background:
                  m.role === "user" ? "rgba(220, 38, 38, 0.08)" : "var(--bg-card)",
              }}
            >
              {m.role === "assistant" && (
                <div
                  className="flex items-center gap-1.5 mb-1 font-bold uppercase tracking-widest"
                  style={{ fontSize: 10, color: "var(--accent-primary)" }}
                >
                  <Bot size={12} aria-hidden="true" /> Coach
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap m-0">{m.content}</p>
            </div>

            {/* Cards de propuestas */}
            {m.proposals?.map((p) => (
              <div
                key={p.id}
                className="card mt-2"
                style={{
                  maxWidth: "85%",
                  border: "1px solid rgba(6,182,212,0.4)",
                  opacity: p.status === "dismissed" ? 0.5 : 1,
                }}
              >
                <p className="text-sm font-semibold m-0" style={{ color: "var(--accent-cycling)" }}>
                  {p.summary}
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {p.status === "pending" && (
                    <>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 13, padding: "6px 14px" }}
                        disabled={loading}
                        onClick={() => applyProposal(i, p)}
                      >
                        <Check size={14} aria-hidden="true" /> Aplicar
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          fontSize: 13,
                          padding: "6px 14px",
                          background: "transparent",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-secondary)",
                        }}
                        disabled={loading}
                        onClick={() => updateProposal(i, p.id, { status: "dismissed" })}
                      >
                        <X size={14} aria-hidden="true" /> Descartar
                      </button>
                    </>
                  )}
                  {p.status === "applied" && !p.undone && (
                    <>
                      <span className="text-xs" style={{ color: "var(--accent-cycling)" }}>
                        ✓ Aplicado
                      </span>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          fontSize: 13,
                          padding: "6px 14px",
                          background: "transparent",
                          border: "1px solid var(--glass-border)",
                          color: "var(--text-secondary)",
                        }}
                        disabled={loading}
                        onClick={() => undoProposal(i, p)}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Deshacer
                      </button>
                    </>
                  )}
                  {p.status === "applied" && p.undone && (
                    <span className="text-xs text-text-secondary">Deshecho</span>
                  )}
                  {p.status === "dismissed" && (
                    <span className="text-xs text-text-secondary">Descartado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}

        {loading && (
          <div className="card text-sm text-text-secondary" style={{ maxWidth: "85%" }}>
            El coach está pensando…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 items-end"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escribile a tu coach…"
          rows={2}
          aria-label="Mensaje para el coach"
          className="flex-1 text-sm"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--glass-border)",
            borderRadius: 12,
            padding: "10px 12px",
            resize: "none",
          }}
        />
        <button
          type="submit"
          className="btn"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          style={{ padding: "10px 14px" }}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </form>

      {messages.length > 0 && (
        <button
          type="button"
          onClick={clearChat}
          className="flex items-center gap-1.5 text-xs text-text-secondary self-end"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Trash2 size={12} aria-hidden="true" /> Limpiar conversación
        </button>
      )}
    </div>
  );
}
