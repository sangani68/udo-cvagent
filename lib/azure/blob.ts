// lib/azure/blob.ts
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT;
const KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
function getService() {
  if (CONN) return BlobServiceClient.fromConnectionString(CONN);
  if (ACCOUNT && KEY) {
    const cs = `DefaultEndpointsProtocol=https;AccountName=${ACCOUNT};AccountKey=${KEY};EndpointSuffix=core.windows.net`;
    return BlobServiceClient.fromConnectionString(cs);
  }
  throw new Error("Blob storage credentials missing.");
}
export async function getContainer(name: string): Promise<ContainerClient> {
  const svc = getService();
  const c = svc.getContainerClient(name);
  await c.createIfNotExists({ access: "blob" }).catch(() => {});
  return c;
}
export function slugify(s: string) {
  return (s || "unknown").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export function ts() {
  const d = new Date(); const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
export async function uploadBuffer(containerName: string, blobPath: string, buffer: Buffer, contentType: string): Promise<string> {
  const cc = await getContainer(containerName);
  const blob = cc.getBlockBlobClient(blobPath);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return blob.url;
}
