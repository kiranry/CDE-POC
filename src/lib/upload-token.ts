import crypto from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export type UploadTokenPayload = {
  documentId: string;
  versionNumber: number;
  storageKey: string;
  folderId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  userId: string;
  partyId: string;
  isNewDocument: boolean;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

export function createUploadToken(payload: Omit<UploadTokenPayload, "exp">): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as UploadTokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
