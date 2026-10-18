"use client";

import React, { useState } from "react";

export default function AdminLogin() {
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Sign-in failed");
      }
      window.location.assign("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif tracking-wide text-neutral-100">✧ Operations Console</h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-mono mt-1">Historic Broyhill · Staff Access</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-lg font-mono">{error}</div>
          )}
          <div>
            <label htmlFor="passcode" className="block text-xs font-mono uppercase text-neutral-400 mb-1">Passcode</label>
            <input
              id="passcode"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full min-h-[44px] bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-950 font-medium text-sm rounded-lg transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
