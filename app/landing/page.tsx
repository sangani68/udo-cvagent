"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        setError("Invalid password. Please try again.");
        return;
      }

      // ✅ On success, always go to "/" (main CV Agent UI)
      router.push("/");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-brand w-full justify-center"
              disabled={loading || !password}
            >
              {loading && <span className="spinner" />}
              <span>Enter CV Agent</span>
            </button>

            <p className="mt-2 text-[11px] text-zinc-500 leading-snug">
              Configure the password via the <code>LANDING_PASSWORD</code> app
              setting in Azure. In local dev, it can fall back to a default if unset.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
