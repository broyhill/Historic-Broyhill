"use client";

import React, { useEffect, useRef, useState } from "react";

interface Pending {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  state?: "idle" | "working" | "done" | "cancelled" | "error";
  result?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
  pending?: Pending[];
}

const SUGGESTIONS = [
  "How many leads do we have, and what's waiting for review?",
  "Find leads with no name and tell me how to clean them up",
  "Draft a follow-up email to our newest lead",
];

// Staff assistant. It looks things up and stages drafts on its own; any change
// to existing data shows up as a card the user must Confirm. It cannot send
// or approve outreach: that stays on the Review Queue page.
export default function AskPanel({ onChanged, seed }: { onChanged?: () => void; seed?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the text goes back to the server; proposed actions are re-derived by the model if still relevant.
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.answer) throw new Error(data.error || "No answer came back.");
      setMessages([...next, {
        role: "assistant",
        content: data.answer,
        actions: data.actions,
        pending: (data.pending || []).map((p: Pending) => ({ ...p, state: "idle" })),
      }]);
      if (data.actions?.length) onChanged?.();
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // A question typed on the Dashboard is sent once when this page opens.
  const seeded = useRef(false);
  useEffect(() => {
    if (seed && !seeded.current) { seeded.current = true; send(seed); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const updatePending = (msgIndex: number, id: string, patch: Partial<Pending>) =>
    setMessages((prev) => prev.map((m, i) =>
      i !== msgIndex ? m : { ...m, pending: m.pending?.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
    ));

  const confirm = async (msgIndex: number, p: Pending) => {
    updatePending(msgIndex, p.id, { state: "working" });
    try {
      const res = await fetch("/api/admin/ask/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: p.tool, input: p.input }),
      });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not do that.");
      updatePending(msgIndex, p.id, { state: "done", result: data.message });
      onChanged?.();
    } catch (e: any) {
      updatePending(msgIndex, p.id, { state: "error", result: e.message });
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <section className="ibox">
        <div className="ibox-title">
          <h3 className="text-sm font-semibold text-[#323a46]">Ask Devin</h3>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null); }} className="text-[12px] text-[#6c757d] hover:text-[#1ab394]">
              New conversation
            </button>
          )}
        </div>
        <div className="ibox-content">
          <p className="text-[13px] text-[#6c757d] leading-relaxed">
            Devin can look up leads and counts, and write email drafts into the Review Queue. Changes to existing
            records wait for your Confirm. It cannot send or approve outreach — you do that in the Review Queue. It can be wrong; check anything important.
          </p>

          <div className="mt-4 space-y-3 max-h-[30rem] overflow-y-auto" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-[12.5px] px-3 py-2 rounded-md border border-[#e7e9eb] text-[#4c4c5c] hover:border-[#1ab394]/50 hover:text-[#1ab394]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
                {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                  <ul className="text-[11.5px] text-[#9ba6b7] space-y-0.5 pl-1">
                    {m.actions.map((a, k) => <li key={k}>✓ {a}</li>)}
                  </ul>
                )}
                <div
                  className={`max-w-[88%] whitespace-pre-wrap text-[13.5px] leading-relaxed rounded-lg px-3.5 py-2.5 ${
                    m.role === "user" ? "bg-[#1ab394] text-white" : "bg-[#f1f2f7] text-[#323a46]"
                  }`}
                >
                  {m.content}
                </div>
                {m.pending?.map((p) => (
                  <div key={p.id} className="max-w-[88%] w-full rounded-md border border-[#f5a623]/60 bg-[#fffaf0] px-3.5 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#b7791f]">Waiting for your OK</div>
                    <div className="mt-1 text-[13.5px] text-[#323a46]">{p.summary}</div>
                    {(p.state === "idle" || p.state === "working" || p.state === "error") && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => confirm(i, p)}
                          disabled={p.state === "working"}
                          className="h-8 px-3 rounded-md bg-[#1ab394] text-white text-[12.5px] font-semibold disabled:opacity-50"
                        >
                          {p.state === "working" ? "Working…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => updatePending(i, p.id, { state: "cancelled" })}
                          disabled={p.state === "working"}
                          className="h-8 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[12.5px]"
                        >
                          Cancel
                        </button>
                        {p.state === "error" && <span className="text-[12.5px] text-red-600" role="alert">{p.result}</span>}
                      </div>
                    )}
                    {p.state === "done" && <div className="mt-2 text-[13px] text-[#1ab394]">Done. {p.result}</div>}
                    {p.state === "cancelled" && <div className="mt-2 text-[13px] text-[#9ba6b7]">Cancelled. Nothing was changed.</div>}
                  </div>
                ))}
              </div>
            ))}
            {busy && <div className="text-[13px] text-[#9ba6b7]">Claude is working…</div>}
            {error && <div className="text-[13px] text-red-600" role="alert">{error}</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-4 flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={2}
              maxLength={2000}
              placeholder="Ask a question or tell Claude what to do…"
              aria-label="Your message"
              className="flex-1 resize-none rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="self-end h-10 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
