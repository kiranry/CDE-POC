import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const storageMode = process.env.STORAGE_MODE ?? "local";
const localRoot = path.join(
  process.cwd(),
  process.env.LOCAL_STORAGE_PATH ?? "storage/uploads",
);

let s3Client: S3Client | null = null;

function shouldUsePathStyle(): boolean {
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
      forcePathStyle: shouldUsePathStyle(),
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

/** Short-lived direct download URL — avoids Vercel function payload limits for large files. */
export async function getPresignedDownloadUrl(
  storageKey: string,
  options?: {
    expiresIn?: number;
    fileName?: string;
    mimeType?: string;
  },
): Promise<string> {
  if (storageMode !== "s3") {
    throw new Error("Presigned URLs require STORAGE_MODE=s3");
  }

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET ?? "prhub-cde",
    Key: storageKey,
    ResponseContentDisposition: options?.fileName
      ? `inline; filename="${options.fileName.replace(/"/g, "_")}"`
      : undefined,
    ResponseContentType: options?.mimeType,
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: options?.expiresIn ?? 900,
  });
}

/** Best-effort remove; ignores missing objects. */
export async function deleteFile(storageKey: string): Promise<void> {
  try {
    if (storageMode === "s3") {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET ?? "prhub-cde",
          Key: storageKey,
        }),
      );
      return;
    }

    const filePath = path.join(localRoot, storageKey);
    await unlink(filePath);
  } catch {
    // File may already be missing
  }
}

export function buildStorageKey(
  documentId: string,
  version: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `documents/${documentId}/v${version}/${safe}`;
}
