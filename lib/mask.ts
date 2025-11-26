export type MaskPolicy = { email?: boolean; phone?: boolean; location?: boolean };

export function maskPII(text: string, policy: MaskPolicy){
  let out = text;
  if (policy.email) out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[email masked]');
  if (policy.phone) out = out.replace(/\+?[0-9][0-9\-\s()]{6,}/g, '[phone masked]');
  if (policy.location) out = out.replace(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\b,?\s*(?:[A-Z]{2,}|[A-Za-z]+)/g, '[location masked]');
  return out;
}

export function maskCV(cv: any, policy: MaskPolicy){
  const out = JSON.parse(JSON.stringify(cv));
  if (out.identity){
    if (policy.email && out.identity.email) out.identity.email = '[email masked]';
    if (policy.phone && out.identity.phone) out.identity.phone = '[phone masked]';
    if (policy.location && out.identity.location) out.identity.location = '[location masked]';
  }
  const apply = (b: {text:string})=> ({...b, text: maskPII(b.text, policy)});
  if (out.summary) out.summary = maskPII(out.summary, policy);
  out.experience?.forEach((e:any)=> e.bullets = e.bullets?.map(apply));
  out.projects?.forEach((p:any)=> p.bullets = p.bullets?.map(apply));
  return out;
}
