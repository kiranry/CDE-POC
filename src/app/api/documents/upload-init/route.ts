import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAllowedFile } from "@/lib/files";
import { canUploadToFolder } from "@/lib/documents";
import { resolveUploadTarget } from "@/lib/document-upload";
import { getActivePartyCode } from "@/lib/party-context";
import { getPartyLabel } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";
import {
  buildStorageKey,
  getPresignedUploadUrl,
  isS3Storage,
} from "@/lib/storage";
import { createUploadToken } from "@/lib/upload-token";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isS3Storage()) {
    return NextResponse.json(
      { error: "Direct upload is only available when STORAGE_MODE=s3" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!dbUser) {
    return NextResponse.json(
      {
        error:
          "Your login session is from an old database. Sign out, then sign in again.",
      },
      { status: 401 },
    );
  }

  const body = await request.json();
  const folderId = body.folderId as string | undefined;
  const fileName = body.fileName as string | undefined;
  const mimeType = (body.mimeType as string | undefined) || "application/octet-stream";
  const sizeBytes = Number(body.sizeBytes);
  const description = (body.description as string | undefined) ?? undefined;
  const parentDocumentId = (body.parentDocumentId as string | undefined) || undefined;
  const versionNumber =
    body.versionNumber != null && Number.isInteger(body.versionNumber)
      ? (body.versionNumber as number)
      : null;

  if (!folderId || !fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: "folderId, fileName, and sizeBytes are required" },
      { status: 400 },
    );
  }

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds maximum upload size (${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)`,
      },
      { status: 400 },
    );
  }

  if (!isAllowedFile(fileName, mimeType)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const activeParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });
  if (!activeParty) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
  }

  if (!canUploadToFolder(folder.partyCode, activePartyCode)) {
    return NextResponse.json(
      {
        error: `You can only upload to ${getPartyLabel(activePartyCode)}'s folders`,
      },
      { status: 403 },
    );
  }

  try {
    const resolved = await resolveUploadTarget({
      folderId,
      fileName,
      parentDocumentId,
      versionNumber,
    });

    const storageKey = buildStorageKey(
      resolved.documentId,
      resolved.versionNumber,
      fileName,
    );
    const uploadUrl = await getPresignedUploadUrl(storageKey, mimeType);

    const uploadToken = createUploadToken({
      documentId: resolved.documentId,
      versionNumber: resolved.versionNumber,
      storageKey,
      folderId,
      fileName,
      mimeType,
      sizeBytes,
      description,
      userId: dbUser.id,
      partyId: activeParty.id,
      isNewDocument: resolved.isNewDocument,
    });

    return NextResponse.json({
      uploadUrl,
      uploadToken,
      documentId: resolved.documentId,
      versionNumber: resolved.versionNumber,
      storageKey,
      method: "PUT",
      headers: { "Content-Type": mimeType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload init failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
