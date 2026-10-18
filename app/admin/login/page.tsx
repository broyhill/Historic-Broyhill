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
    <main className="ins-app min-h-screen flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm bg-white border border-[#e7e9eb] rounded-lg p-8 shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-[#323a46]">✦ Operations Console</h1>
          <p className="text-[11px] uppercase tracking-widest text-[#1ab394] mt-1">Historic Broyhill · Staff Access</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-[#fdeeee] border border-[#f5c2c7] text-[#c0392b] text-xs rounded-md">{error}</div>
          )}
          <div>
            <label htmlFor="passcode" className="block text-[11px] font-semibold uppercase tracking-wider text-[#9ba6b7] mb-1.5">Passcode</label>
            <input
              id="passcode"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="ins-input w-full min-h-[44px] rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-3 bg-[#1ab394] hover:bg-[#16987e] disabled:opacity-60 text-white font-semibold text-sm rounded-md transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ab394]/50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
