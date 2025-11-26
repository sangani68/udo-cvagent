// lib/text-embed.ts
const base = process.env.AZURE_OPENAI_ENDPOINT!;
const key = process.env.AZURE_OPENAI_API_KEY!;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding-3-small";

export async function embed(text: string): Promise<number[]> {
  const r = await fetch(
    `${base}/openai/deployments/${embeddingDeployment}/embeddings?api-version=${apiVersion}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify({ input: text }),
    }
  );
  if (!r.ok) throw new Error(`Embedding failed: ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding as number[];
}
