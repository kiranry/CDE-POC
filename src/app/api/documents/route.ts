import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAllowedFile } from "@/lib/files";
import {
  canDeleteDocument,
  canUploadToFolder,
  displayFileName,
} from "@/lib/documents";
import { registerDocumentVersion, resolveUploadTarget } from "@/lib/document-upload";
import { getActivePartyCode } from "@/lib/party-context";
import { getPartyLabel } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";
import { buildStorageKey, isS3Storage, putFile } from "@/lib/storage";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  const documents = await prisma.document.findMany({
    where: folderId
      ? { folderId, versions: { some: {} } }
      : { versions: { some: {} } },
    include: {
      folder: true,
      versions: {
        orderBy: { version: "desc" },
        include: {
          uploadedByParty: true,
          uploadedByUser: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items = documents.map((doc) => {
    const latest = doc.versions[0];
    const versionPartyCodes = doc.versions.map((v) => v.uploadedByParty.code);
    return {
      id: doc.id,
      name: displayFileName(doc.name, latest?.storageKey),
      folderId: doc.folderId,
      folderCode: doc.folder.code,
      folderName: doc.folder.name,
      currentVersion: doc.currentVersion,
      versionCount: doc.versions.length,
      uploadedByParty: latest?.uploadedByParty.code,
      uploadedByPartyName: latest?.uploadedByParty.name,
      uploadedByUser: latest?.uploadedByUser.name,
      uploadedAt: latest?.uploadedAt,
      sizeBytes: latest ? Number(latest.sizeBytes) : 0,
      mimeType: latest?.mimeType,
      canDelete: canDeleteDocument(versionPartyCodes, activePartyCode),
    };
  });

  return NextResponse.json({ documents: items, activePartyCode });
}

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

export async function POST(request: Request) {
  try {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const description = (formData.get("description") as string | null) ?? undefined;
    const parentDocumentId =
      (formData.get("parentDocumentId") as string | null) || undefined;
    const versionNumber = parseOptionalInt(formData.get("versionNumber"));

    if (!file || !folderId) {
      return NextResponse.json(
        { error: "file and folderId are required" },
        { status: 400 },
      );
    }

    if (!isAllowedFile(file.name, file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
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

    const buffer = Buffer.from(await file.arrayBuffer());

    if (isS3Storage() && buffer.length > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "File is too large for server upload. Use the upload dialog (direct-to-storage upload).",
        },
        { status: 413 },
      );
    }

    const mimeType = file.type || "application/octet-stream";

    const resolved = await resolveUploadTarget({
      folderId,
      fileName: file.name,
      parentDocumentId,
      versionNumber,
    });

    const storageKey = buildStorageKey(
      resolved.documentId,
      resolved.versionNumber,
      file.name,
    );
    await putFile(storageKey, buffer, mimeType);

    const { document, docVersion } = await registerDocumentVersion({
      documentId: resolved.documentId,
      versionNumber: resolved.versionNumber,
      storageKey,
      fileName: file.name,
      mimeType,
      sizeBytes: buffer.length,
      description,
      uploadedByPartyId: activeParty.id,
      uploadedByUserId: dbUser.id,
    });

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        version: resolved.versionNumber,
        uploadedByParty: docVersion.uploadedByParty.code,
        uploadedAt: docVersion.uploadedAt,
      },
    });
  } catch (err) {
    console.error("[documents POST]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
