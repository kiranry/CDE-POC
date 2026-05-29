import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notifyDocumentUpload } from "@/lib/notifications";
import { isAllowedFile } from "@/lib/files";
import { canDeleteDocument, canUploadToFolder } from "@/lib/documents";
import { getActivePartyCode } from "@/lib/party-context";
import { getPartyLabel } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";
import { buildStorageKey, putFile } from "@/lib/storage";
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  const documents = await prisma.document.findMany({
    where: folderId ? { folderId } : undefined,
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
      name: doc.name,
      folderId: doc.folderId,
      folderCode: doc.folder.code,
      folderName: doc.folder.name,
      currentVersion: doc.currentVersion,
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
  const mimeType = file.type || "application/octet-stream";

  let document = await prisma.document.findUnique({
    where: { name_folderId: { name: file.name, folderId } },
  });

  let versionNumber = 1;
  if (document) {
    versionNumber = document.currentVersion + 1;
    document = await prisma.document.update({
      where: { id: document.id },
      data: { currentVersion: versionNumber },
    });
  } else {
    document = await prisma.document.create({
      data: {
        name: file.name,
        folderId,
        currentVersion: 1,
      },
    });
  }

  const storageKey = buildStorageKey(document.id, versionNumber, file.name);
  await putFile(storageKey, buffer, mimeType);

  const docVersion = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: versionNumber,
      storageKey,
      mimeType,
      sizeBytes: BigInt(buffer.length),
      description,
      uploadedByPartyId: activeParty.id,
      uploadedByUserId: dbUser.id,
    },
    include: {
      uploadedByParty: true,
      uploadedByUser: true,
    },
  });

  const activityType =
    versionNumber === 1 ? "DOCUMENT_UPLOAD" : "DOCUMENT_VERSION";
  const summary =
    versionNumber === 1
      ? `${getPartyLabel(activeParty.code)} uploaded ${file.name} to ${folder.code}`
      : `${getPartyLabel(activeParty.code)} uploaded v${versionNumber} of ${file.name} to ${folder.code}`;

  await logActivity({
    type: activityType,
    summary,
    actorPartyId: activeParty.id,
    metadata: {
      documentId: document.id,
      version: versionNumber,
      folderCode: folder.code,
      fileName: file.name,
    },
  });

  await notifyDocumentUpload({
    uploaderPartyCode: activeParty.code,
    uploaderPartyName: activeParty.name,
    uploaderUserName: docVersion.uploadedByUser.name,
    documentName: file.name,
    folderCode: folder.code,
    folderName: folder.name,
    documentId: document.id,
    version: versionNumber,
    uploadedAt: docVersion.uploadedAt,
  });

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      version: versionNumber,
      uploadedByParty: docVersion.uploadedByParty.code,
      uploadedAt: docVersion.uploadedAt,
    },
  });
  } catch (err) {
    console.error("[documents POST]", err);
    const message =
      err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
