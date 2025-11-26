export function pickCandidateName(data: any): string {
  const c = data?.candidate || data?.identity || {};
  const p = c?.personal || {};
  const raw =
    c.full_name || c.fullName || c.name ||
    p.full_name || p.fullName || p.name ||
    (data?.identity?.full_name || data?.identity?.fullName || data?.identity?.name) ||
    [c.firstName, c.lastName].filter(Boolean).join(' ') ||
    [p.firstName, p.lastName].filter(Boolean).join(' ') ||
    'anonymous';
  const slug = String(raw).trim()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .toLowerCase();
  return slug || 'anonymous';
}
export function langOf(data: any): string {
  return String(
    data?.candidate?.locale ||
    data?.meta?.locale ||
    data?.locale ||
    'en'
  ).toLowerCase();
}
export function yyyymmdd(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
export function makeBlobPath(
  data: any,
  template: 'kyndryl'|'europass'|'european-parliament'|'kyndryl-sm',
  ext: 'pdf'|'docx'|'pptx',
  prefix: string = 'exports' // override with 'exports-lab' in test routes
) {
  const name = pickCandidateName(data);
  const lang = langOf(data);
  const date = yyyymmdd();
  return `${prefix}/${name}_${template}_${lang}_${date}.${ext}`;
}
