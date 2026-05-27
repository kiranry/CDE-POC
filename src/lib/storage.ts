import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const storageMode = process.env.STORAGE_MODE ?? "local";
const localRoot = path.join(
  process.cwd(),
  process.env.LOCAL_STORAGE_PATH ?? "storage/uploads",
);

let s3Client: S3Client | null = null;

function usePathStyle(): boolean {
  // MinIO / local S3: true. Cloudflare R2: set S3_FORCE_PATH_STYLE=false
  if (process.env.S3_FORCE_PATH_STYLE === "false") return false;
  if (process.env.S3_FORCE_PATH_STYLE === "true") return true;
  const endpoint = process.env.S3_ENDPOINT ?? "";
  return !endpoint.includes("r2.cloudflarestorage.com");
}

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!process.env.S3_ENDPOINT?.trim()) {
      throw new Error("S3_ENDPOINT is required when STORAGE_MODE=s3");
    }
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
      forcePathStyle: usePathStyle(),
    });
  }
  return s3Client;
}

export async function putFile(
  storageKey: string,
  body: Buffer,
  mimeType: string,
): Promise<void> {
  if (storageMode === "s3") {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "prhub-cde",
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
      }),
    );
    return;
  }

  const filePath = path.join(localRoot, storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

export async function getFile(storageKey: string): Promise<Buffer> {
  if (storageMode === "s3") {
    const res = await getS3Client().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET ?? "prhub-cde",
        Key: storageKey,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty file from storage");
    return Buffer.from(bytes);
  }

  const filePath = path.join(localRoot, storageKey);
  return readFile(filePath);
}

export function buildStorageKey(
  documentId: string,
  version: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `documents/${documentId}/v${version}/${safe}`;
}
