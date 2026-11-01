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
    <main className="ins-app min-h-screen grid lg:grid-cols-[5fr_4fr]">
      <section className="hidden lg:flex flex-col justify-between bg-navy text-white px-12 py-10">
        <p className="text-[13px] text-accent-bright">Clemmons, North Carolina</p>
        <div>
          <h1 className="text-[44px] leading-[1.05] text-white max-w-md">Historic Broyhill</h1>
          <p className="mt-4 text-[16px] text-white/75 max-w-sm leading-relaxed">The back office for the Old Clemmons School: leads, email, photos and video for the venue and the offices.</p>
        </div>
        <p className="text-[13px] text-white/60">Staff only. Access expires after 12 hours.</p>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-8">
          <h1 className="text-[28px] text-ink leading-tight lg:hidden">Historic Broyhill</h1>
          <h2 className="text-[22px] text-ink leading-tight mt-1 lg:mt-0">Sign in to the back office</h2>
          <p className="text-[14px] text-muted mt-2">Enter the staff passcode.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-danger-tint border border-danger-tint text-danger text-xs rounded-md">{error}</div>
          )}
          <div>
            <label htmlFor="passcode" className="block text-[14px] font-semibold text-ink mb-1.5">Passcode</label>
            <input
              id="passcode"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="ins-input w-full min-h-[44px] rounded-md px-3 py-2 text-[15px]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-3 bg-navy hover:bg-navy-soft disabled:opacity-60 text-white font-semibold text-[15px] rounded-md transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
      </section>
    </main>
  );
}
