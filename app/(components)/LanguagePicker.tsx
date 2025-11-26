// app/(components)/LanguagePicker.tsx
"use client";

import * as React from "react";

export type LanguagePickerProps = {
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "nl", label: "Nederlands" },
];

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-600">Language:</label>
      <select
        className="border rounded px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Default export for imports/dynamic() that expect a default
export default LanguagePicker;
