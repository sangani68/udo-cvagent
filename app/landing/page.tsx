"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// We support either of these env vars; if none is set, password is OPTIONAL.
const EXPECTED_PASSWORD =
  process.env.NEXT_PUBLIC_CV_AGENT_PASSWORD ||
  process.env.NEXT_PUBLIC_LANDING_PASSWORD ||
  "";

export default function LandingPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [redirect, setRedirect] = useState<string>("/");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  // Read ?redirect=... from the URL on the client only
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const r = params.get("redirect");
        setRedirect(r || "/");
      }
    } catch {
      setRedirect("/");
    }
  }, []);

  useEffect(() => {
    if (!EXPECTED_PASSWORD) {
      setStatus("Password is currently disabled; click Enter to continue.");
    } else {
      setStatus("Password is required to enter CV Agent.");
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const expected = EXPECTED_PASSWORD;

    // If a password is configured, enforce it
    if (expected && password !== expected) {
      setError("Incorrect password. Please try again.");
      return;
    }

    // Mark the user as authenticated for the middleware
    try {
      if (typeof document !== "undefined") {
        // cookie name must match middleware
        document.cookie =
          "cv-agent-auth=1; path=/; max-age=86400; samesite=lax";
      }
    } catch {
      // ignore cookie errors
    }

    router.push(redirect || "/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            CV Agent
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Private access portal
          </p>
        </div>

        {status && (
          <p className="mb-4 text-xs text-slate-500 text-center">
            {status}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {EXPECTED_PASSWORD && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-200">
                Access password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF462D] focus:border-transparent"
                placeholder="Enter password"
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#FF462D] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#e53b22] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-[#FF462D] disabled:opacity-60"
          >
            Enter CV Agent
          </button>

          <p className="mt-2 text-[11px] text-slate-500 text-center">
            Redirect target: <code>{redirect || "/"}</code>
          </p>
        </form>
      </div>
    </div>
  );
}
