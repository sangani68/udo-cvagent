'use client';

import React from 'react';

export type MaskPolicy = {
  email: boolean;
  phone: boolean;
  location: boolean; // matches code-zip
};

const DEFAULT_POLICY: MaskPolicy = { email: false, phone: false, location: false };

type Props = {
  /** Preferred prop name in the code-zip */
  policy?: Partial<MaskPolicy>;
  /** Back-compat: some pages used `value` instead of `policy` */
  value?: Partial<MaskPolicy>;
  onChange: (next: MaskPolicy) => void;
  className?: string;
};

export function MaskingToggles({ policy, value, onChange, className }: Props) {
  // Tolerant merge of inputs → always a complete object
  const current: MaskPolicy = { ...DEFAULT_POLICY, ...(policy ?? value ?? {}) };

  const set = (k: keyof MaskPolicy, v: boolean) => {
    const next: MaskPolicy = { ...current, [k]: v };
    onChange(next);
  };

  const KEYS: (keyof MaskPolicy)[] = ['email', 'phone', 'location'];

  return (
    <div className={`grid grid-cols-3 gap-2 text-sm ${className || ''}`}>
      {KEYS.map(k => (
        <label key={k} className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!current[k]}
            onChange={e => set(k, e.target.checked)}
          />
          <span className="select-none capitalize">{k}</span>
        </label>
      ))}
    </div>
  );
}

export default MaskingToggles;
