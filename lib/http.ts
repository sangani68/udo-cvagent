// lib/http.ts
import { Agent } from "undici";

/**
 * DEV-ONLY: If you're behind a corporate proxy that injects a self-signed CA,
 * set ALLOW_INSECURE_TLS=true in .env.local so undici won't reject the cert.
 * In PROD, leave it off and install your corporate root CA via NODE_EXTRA_CA_CERTS.
 */
const allowInsecure =
  (process.env.ALLOW_INSECURE_TLS || "").toLowerCase() === "true";

export const insecureAgent = allowInsecure
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : undefined;

export function fetchAzure(input: string, init: RequestInit = {}) {
  const options: any = { ...init };
  if (insecureAgent) {
    // undici-specific hook used by global fetch in Node 18+
    options.dispatcher = insecureAgent;
  }
  return fetch(input, options);
}
