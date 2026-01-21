// app/layout.tsx
import "./globals.css";
import Image from "next/image";
import type { ReactNode } from "react";

export const metadata = {
  title: "CV Agent",
  description: "Kyndryl CV Agent — search, edit & export",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-zinc-900 antialiased">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6">
            <div className="flex h-14 items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/kyndryl.svg"
                  alt="Kyndryl"
                  width={96}
                  height={22}
                  className="brand-logo"
                  priority
                />
                <span className="font-semibold tracking-tight text-[var(--brand)]">
                  CV Agent
                </span>
                <span className="hidden sm:inline rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                  beta
                </span>
              </div>
              <div />
            </div>
          </div>
          <div className="h-[3px] w-full" style={{ backgroundColor: "var(--brand)" }} />
        </header>

        {/* Main container */}
        <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-3 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between">
              <div>© {year} Kyndryl (demo). All rights reserved.</div>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="https://www.kyndryl.com/us/en/privacy"
                  className="hover:text-zinc-900"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy &amp; GDPR
                </a>
                <a
                  href="https://www.kyndryl.com/us/en/cyber-security"
                  className="hover:text-zinc-900"
                  target="_blank"
                  rel="noreferrer"
                >
                  Security
                </a>
                <a
                  href="https://www.kyndryl.com/us/en/terms"
                  className="hover:text-zinc-900"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
