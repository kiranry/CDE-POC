export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".dwg",
  ".ifc",
  ".mpp",
  ".xml",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
] as const;

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.join(",");

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

export function isAllowedFile(filename: string, mimeType?: string): boolean {
  const ext = getExtension(filename);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return false;
  }
  if (!mimeType) return true;
  if (mimeType === "application/octet-stream") return true;
  return true;
}

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
