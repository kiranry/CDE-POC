import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyDocumentUpload } from "@/lib/notifications";
import { getPartyLabel } from "@/lib/party-labels";
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

  const activeParty = await prisma.party.findUnique({
    where: { id: payload.partyId },
  });
  if (!activeParty) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
  }

  const docVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: payload.versionNumber,
      storageKey: payload.storageKey,
      mimeType: payload.mimeType,
      sizeBytes: BigInt(payload.sizeBytes),
      description: payload.description,
      uploadedByPartyId: payload.partyId,
      uploadedByUserId: payload.userId,
    },
    include: {
      uploadedByParty: true,
      uploadedByUser: true,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { currentVersion: payload.versionNumber },
  });

  const activityType =
    payload.versionNumber === 1 ? "DOCUMENT_UPLOAD" : "DOCUMENT_VERSION";
  const summary =
    payload.versionNumber === 1
      ? `${getPartyLabel(activeParty.code)} uploaded ${payload.fileName} to ${document.folder.code}`
      : `${getPartyLabel(activeParty.code)} uploaded v${payload.versionNumber} of ${payload.fileName} to ${document.folder.code}`;

  await logActivity({
    type: activityType,
    summary,
    actorPartyId: activeParty.id,
    metadata: {
      documentId: document.id,
      version: payload.versionNumber,
      folderCode: document.folder.code,
      fileName: payload.fileName,
    },
  });

  await notifyDocumentUpload({
    uploaderPartyCode: activeParty.code,
    uploaderPartyName: activeParty.name,
    uploaderUserName: docVersion.uploadedByUser.name,
    documentName: payload.fileName,
    folderCode: document.folder.code,
    folderName: document.folder.name,
    documentId: document.id,
    version: payload.versionNumber,
    uploadedAt: docVersion.uploadedAt,
  });

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      version: payload.versionNumber,
      uploadedByParty: docVersion.uploadedByParty.code,
      uploadedAt: docVersion.uploadedAt,
    },
  });
}
