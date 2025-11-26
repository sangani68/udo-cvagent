import {
BlobServiceClient,
StorageSharedKeyCredential,
BlobHTTPHeaders,
} from "@azure/storage-blob";

function getBlobServiceClient(): BlobServiceClient {
const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (conn) return BlobServiceClient.fromConnectionString(conn);

const account = process.env.AZURE_STORAGE_ACCOUNT;
const sas = process.env.AZURE_STORAGE_SAS; // optional alternative
const key = process.env.AZURE_STORAGE_ACCOUNT_KEY; // optional alternative

if (account && sas) {
return new BlobServiceClient(`https://${account}.blob.core.windows.net${sas}`);
}
if (account && key) {
const cred = new StorageSharedKeyCredential(account, key);
return new BlobServiceClient(`https://${account}.blob.core.windows.net`, cred);
}
throw new Error("No Azure Storage credentials configured");
}

export async function uploadBufferToAdls(
containerName: string,
blobPath: string,
buffer: Buffer,
contentType: string
) {
const svc = getBlobServiceClient();
const container = svc.getContainerClient(containerName);
await container.createIfNotExists();
const block = container.getBlockBlobClient(blobPath);
const headers: BlobHTTPHeaders = { blobContentType: contentType };
await block.uploadData(buffer, { blobHTTPHeaders: headers });
return block.url;
}