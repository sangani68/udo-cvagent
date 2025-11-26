// app/api/proofread/route.ts
// Purpose: fix spelling/grammar lightly while preserving JSON shape. Works with Azure OpenAI Chat.

import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { data } = await req.json();
  const system = `You fix spelling/grammar and slightly improve clarity.
You MUST preserve keys, arrays, and structure. Do not remove fields. Return strictly JSON.`;
  const user = JSON.stringify(data);

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
  const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || "gpt-4o-mini";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

  if (!endpoint || !apiKey) {
    // Safe fallback if env is missing: echo the input back
    return Response.json({ data }, { status: 200 });
  }

  try {
    const resp = await fetch(
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      }
    );

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    const cleaned = content ? JSON.parse(content) : data;
    return Response.json({ data: cleaned });
  } catch {
    // Fail-safe: return original
    return Response.json({ data }, { status: 200 });
  }
}
