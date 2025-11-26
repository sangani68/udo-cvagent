"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
personName: string;
photoUrl?: string;
onUploaded: (value: string) => void; // returns a data URL for guaranteed preview
};

export default function PhotoUploader({ personName, photoUrl, onUploaded }: Props) {
const inputRef = useRef<HTMLInputElement | null>(null);
const [preview, setPreview] = useState<string | undefined>(photoUrl);

async function fileToDataUrl(file: File): Promise<string> {
return await new Promise((resolve, reject) => {
const r = new FileReader();
r.onload = () => resolve(String(r.result || ""));
r.onerror = reject;
r.readAsDataURL(file);
});
}

async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
const f = e.target.files?.[0];
if (!f) return;
try {
const dataUrl = await fileToDataUrl(f);
setPreview(dataUrl);
onUploaded(dataUrl); // always provide a data URL → no CORS/tainting issues
} catch {
// best effort: no-op
} finally {
if (inputRef.current) inputRef.current.value = "";
}
}

return (
<div className="flex items-start gap-3">
<div className="h-24 w-24 overflow-hidden rounded-xl border bg-zinc-50 grid place-items-center">
{preview ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={preview} alt={personName || "Photo"} className="h-full w-full object-cover" />
) : (
<span className="text-xs text-zinc-500">No photo</span>
)}
</div>
<div className="flex flex-col gap-2">
<button
onClick={() => inputRef.current?.click()}
className="rounded-md border px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50"
>
Choose image…
</button>
{preview && (
<button
onClick={() => { setPreview(undefined); onUploaded(""); }}
className="rounded-md border px-3 py-1.5 text-sm shadow-sm hover:bg-zinc-50"
>
Remove
</button>
)}
<input
ref={inputRef}
type="file"
accept="image/*"
className="hidden"
onChange={onPick}
/>
<p className="text-[11px] text-zinc-500">We embed the image directly for preview/export.</p>
</div>
</div>
);
}