// app/(components)/PreviewFrame.tsx
"use client";
import React from "react";

export default function PreviewFrame({ html, loading, error }: { html?: string | null; loading?: boolean; error?: string | null; }) {
  if (loading) {
    return (
      <div className="h-[840px] w-full grid place-items-center border rounded-lg bg-white/60">
        <div className="animate-spin h-8 w-8 border-2 border-black/20 border-t-black rounded-full" />
      </div>
    );
  }
  if (error) {
    return <div className="h-[840px] w-full p-4 border rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>;
  }
  if (!html) {
    return <div className="h-[840px] w-full grid place-items-center border rounded-lg text-sm text-gray-500 bg-white">Nothing to preview yet.</div>;
  }
  return <iframe title="Preview" className="h-[840px] w-full border rounded-lg bg-white" srcDoc={html} sandbox="allow-same-origin" />;
}
