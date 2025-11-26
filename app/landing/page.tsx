// app/landing/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirect = searchParams.get("redirect") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        setError(json.error || "Invalid password");
        setLoading(false);
        return;
      }

      // On success, go to the original destination (default "/")
      router.push(redirect);
    } catch (err: any) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/90 border border-slate-700 px-8 py-10 shadow-xl">
        <h1 className="text-2xl font-semibold text-white mb-2 text-center">
          CV Agent
        </h1>
        <p className="text-sm text-slate-300 mb-6 text-center">
          Enter the access password to continue
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF462D] focus:border-[#FF462D]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-[#FF462D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#e03e29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Checking..." : "Enter CV Agent"}
          </button>
        </form>
      </div>
    </div>
  );
}
