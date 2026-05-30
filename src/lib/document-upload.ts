import { logActivity } from "@/lib/activity";
import { notifyDocumentUpload } from "@/lib/notifications";
import { getPartyLabel } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";

export type ResolveUploadTargetInput = {
  folderId: string;
  fileName: string;
  parentDocumentId?: string | null;
  versionNumber?: number | null;
};

export type ResolvedUploadTarget = {
  documentId: string;
  versionNumber: number;
  isNewDocument: boolean;
};

export async function resolveUploadTarget(
  input: ResolveUploadTargetInput,
): Promise<ResolvedUploadTarget> {
  const explicitVersion =
    input.versionNumber != null && Number.isInteger(input.versionNumber)
      ? input.versionNumber
      : null;

  if (explicitVersion != null && explicitVersion < 1) {
    throw new Error("Version must be at least 1");
  }

  if (input.parentDocumentId) {
    const parent = await prisma.document.findUnique({
      where: { id: input.parentDocumentId },
      include: { versions: true },
    });
    if (!parent) {
      throw new Error("Base document not found");
    }
    if (parent.folderId !== input.folderId) {
      throw new Error("Base document is not in this folder");
    }

    const versionNumber = explicitVersion ?? parent.currentVersion + 1;
    if (parent.versions.some((v) => v.version === versionNumber)) {
      throw new Error(`Version ${versionNumber} already exists`);
    }

    return {
      documentId: parent.id,
      versionNumber,
      isNewDocument: false,
    };
  }

  const existing = await prisma.document.findUnique({
    where: { name_folderId: { name: input.fileName, folderId: input.folderId } },
    include: { versions: true },
  });

  if (existing) {
    const versionNumber = explicitVersion ?? existing.currentVersion + 1;
    if (existing.versions.some((v) => v.version === versionNumber)) {
      throw new Error(`Version ${versionNumber} already exists`);
    }
    return {
      documentId: existing.id,
      versionNumber,
      isNewDocument: false,
    };
  }

  const versionNumber = explicitVersion ?? 1;
  if (versionNumber > 1) {
    throw new Error(
      "Select a base document when uploading version 2 or higher",
    );
  }

  const created = await prisma.document.create({
    data: {
      name: input.fileName,
      folderId: input.folderId,
      currentVersion: 0,
    },
  });

  return {
    documentId: created.id,
    versionNumber,
    isNewDocument: true,
  };
}

export async function registerDocumentVersion(params: {
  documentId: string;
  versionNumber: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  description?: string;
  uploadedByPartyId: string;
  uploadedByUserId: string;
}) {
  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    include: { folder: true, versions: true },
  });
  if (!document) {
    throw new Error("Document not found");
  }

  if (document.versions.some((v) => v.version === params.versionNumber)) {
    throw new Error(`Version ${params.versionNumber} already exists`);
  }

  const docVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: params.versionNumber,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      sizeBytes: BigInt(params.sizeBytes),
      description: params.description,
      uploadedByPartyId: params.uploadedByPartyId,
      uploadedByUserId: params.uploadedByUserId,
    },
    include: {
      uploadedByParty: true,
      uploadedByUser: true,
    },
  });

  const nextCurrentVersion = Math.max(
    document.currentVersion,
    params.versionNumber,
  );

  await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersion: nextCurrentVersion,
      ...(params.versionNumber === nextCurrentVersion
        ? { name: params.fileName }
        : {}),
    },
  });

  const activityType =
    params.versionNumber === 1 ? "DOCUMENT_UPLOAD" : "DOCUMENT_VERSION";
  const summary =
    params.versionNumber === 1
      ? `${getPartyLabel(docVersion.uploadedByParty.code)} uploaded ${params.fileName} to ${document.folder.code}`
      : `${getPartyLabel(docVersion.uploadedByParty.code)} uploaded v${params.versionNumber} of ${document.name} to ${document.folder.code}`;

  await logActivity({
    type: activityType,
    summary,
    actorPartyId: params.uploadedByPartyId,
    metadata: {
      documentId: document.id,
      version: params.versionNumber,
      folderCode: document.folder.code,
      fileName: params.fileName,
    },
  });

  await notifyDocumentUpload({
    uploaderPartyCode: docVersion.uploadedByParty.code,
    uploaderPartyName: docVersion.uploadedByParty.name,
    uploaderUserName: docVersion.uploadedByUser.name,
    documentName: params.fileName,
    folderCode: document.folder.code,
    folderName: document.folder.name,
    documentId: document.id,
    version: params.versionNumber,
    uploadedAt: docVersion.uploadedAt,
  });

  return { document, docVersion };
}
