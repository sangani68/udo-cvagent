"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const HARDCODED_PASSWORD = "KyndrylCV2025!";

export default function LandingPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, go straight to the app
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = sessionStorage.getItem("cv-agent-auth");
    if (flag === "1") {
      router.replace("/");
    }
  }, [router]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      if (!password) {
        setError("Password is required");
        return;
      }

      if (password !== HARDCODED_PASSWORD) {
        setError("Invalid password");
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("cv-agent-auth", "1");
      }

      router.replace("/");
    } catch (err) {
      console.error("Login error", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[.25em] text-sky-700">
            Kyndryl
          </p>
          <h1 className="mt-2 text-2xl font-semibold">CV Agent</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the shared access password to continue.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[.25em] text-slate-500">
              Protected
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Checking…" : "Enter CV Agent"}
          </button>

          <p className="mt-2 text-xs text-slate-500">
            Password is checked in the browser for this internal app.
          </p>
        </form>

        <footer className="mt-6 text-center text-xs text-slate-400">
          <p>© 2025 Kyndryl (demo). All rights reserved.</p>
          <p className="mt-1">
            <a
              href="https://www.kyndryl.com/us/en/privacy"
              className="hover:text-slate-500"
              target="_blank"
              rel="noreferrer"
            >
              Privacy &amp; GDPR
            </a>{" "}
            ·{" "}
            <a
              href="https://www.kyndryl.com/us/en/cyber-security"
              className="hover:text-slate-500"
              target="_blank"
              rel="noreferrer"
            >
              Security
            </a>{" "}
            ·{" "}
            <a
              href="https://www.kyndryl.com/us/en/terms"
              className="hover:text-slate-500"
              target="_blank"
              rel="noreferrer"
            >
              Terms
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
