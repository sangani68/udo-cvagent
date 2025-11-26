"use client";
import React, { useState } from "react";
export function LanguagePicker({ value='en', onChange }:{ value?: 'en'|'fr'|'de'|'nl'; onChange:(v:any)=>void }){
  const [v,setV] = useState(value);
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Language</label>
      <select className="border rounded px-2 py-1" value={v} onChange={e=>{ setV(e.target.value as any); onChange(e.target.value); }}>
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="nl">Nederlands</option>
      </select>
    </div>
  );
}
