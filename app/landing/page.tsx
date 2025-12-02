// app/landing/page.tsx
"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const HARDCODED_PASSWORD = "KyndrylCV2025!"; // ⬅️ change this to your password

export default function LandingPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      // Simple client-side check
      if (!password) {
        setError("Password is required");
        setLoading(false);
        return;
      }

      if (password !== HARDCODED_PASSWORD) {
        setError("Invalid password");
        setLoading(false);
        return;
      }

      // Mark session as authenticated in the browser
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cv-agent-auth", "1");
      }

      // Go to main app
      router.replace("/");
    } catch (err) {
      console.error("Login error", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="flex min-h-[calc(100vh-88px-72px)] items-center justify-center">
        <div className="card w-full max-w-md">
          <div className="card-head">
            <div>
              <h1 className="text-base font-semibold text-zinc-900">
                Kyndryl CV Agent
              </h1>
              <p className="mt-1 text-xs text-zinc-500">
                Enter the shared access password to continue.
              </p>
            </div>
            <span className="badge badge-brand uppercase tracking-wide">
              Protected
            </span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <button
                type="submit"
                className="btn btn-brand w-full justify-center"
                disabled={loading}
              >
                <span>{loading ? "Checking..." : "Enter CV Agent"}</span>
              </button>

              <p className="mt-2 text-[11px] text-zinc-500 leading-snug">
                Password is checked in the browser for this internal app.
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
