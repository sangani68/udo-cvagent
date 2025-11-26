// app/landing/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_LANDING_PASSWORD || "cv-agent";

export default function LandingPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError("Please enter the password.");
      return;
    }

    if (password.trim() !== EXPECTED_PASSWORD) {
      setError("Incorrect password.");
      return;
    }

    setBusy(true);
    try {
      // On success, go to the main CV Agent app
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2 text-center">CV Agent</h1>
        <p className="text-sm text-slate-300 mb-6 text-center">
          Enter the access password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF462D] focus:border-transparent"
              autoComplete="off"
            />
          </label>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#FF462D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#e33f27] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? "Entering…" : "Enter CV Agent"}
          </button>
        </form>
      </div>
    </div>
  );
}
