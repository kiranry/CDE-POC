import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registerDocumentVersion } from "@/lib/document-upload";
import { prisma } from "@/lib/prisma";
import { deleteFile, headObject, isS3Storage } from "@/lib/storage";
import { verifyUploadToken } from "@/lib/upload-token";

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

  const body = await request.json();
  const uploadToken = body.uploadToken as string | undefined;
  if (!uploadToken) {
    return NextResponse.json({ error: "uploadToken is required" }, { status: 400 });
  }

  const payload = verifyUploadToken(uploadToken);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid or expired upload token" },
      { status: 401 },
    );
  }

  if (payload.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const document = await prisma.document.findUnique({
    where: { id: payload.documentId },
    include: { folder: true, versions: true },
  });

  if (!document || document.folderId !== payload.folderId) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const existingVersion = document.versions.find(
    (v) => v.version === payload.versionNumber,
  );
  if (existingVersion) {
    return NextResponse.json(
      { error: "This version was already registered" },
      { status: 409 },
    );
  }

  let objectInfo: { sizeBytes: number };
  try {
    objectInfo = await headObject(payload.storageKey);
  } catch {
    if (payload.isNewDocument && document.versions.length === 0) {
      await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
    }
    return NextResponse.json(
      { error: "Upload not found in storage. Try uploading again." },
      { status: 400 },
    );
  }

  if (objectInfo.sizeBytes !== payload.sizeBytes) {
    await deleteFile(payload.storageKey);
    if (payload.isNewDocument && document.versions.length === 0) {
      await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
    }
    return NextResponse.json(
      { error: "Uploaded file size does not match the declared size" },
      { status: 400 },
    );
  }

  try {
    const { document: updatedDoc, docVersion } = await registerDocumentVersion({
      documentId: payload.documentId,
      versionNumber: payload.versionNumber,
      storageKey: payload.storageKey,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      description: payload.description,
      uploadedByPartyId: payload.partyId,
      uploadedByUserId: payload.userId,
    });

    return NextResponse.json({
      document: {
        id: updatedDoc.id,
        name: updatedDoc.name,
        version: payload.versionNumber,
        uploadedByParty: docVersion.uploadedByParty.code,
        uploadedAt: docVersion.uploadedAt,
      },
    });
  } catch (err) {
    await deleteFile(payload.storageKey);
    if (payload.isNewDocument && document.versions.length === 0) {
      await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
    }
    const message = err instanceof Error ? err.message : "Upload finalize failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
