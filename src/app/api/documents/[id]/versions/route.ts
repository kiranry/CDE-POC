import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canDeleteVersion } from "@/lib/documents";
import { formatBytes } from "@/lib/files";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";
import { fileNameFromStorageKey } from "@/lib/documents";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
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
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  return NextResponse.json({
    document: {
      id: document.id,
      name: document.name,
      folderCode: document.folder.code,
      folderName: document.folder.name,
    },
    versions: document.versions.map((v) => ({
      id: v.id,
      version: v.version,
      fileName: fileNameFromStorageKey(v.storageKey),
      uploadedByParty: v.uploadedByParty.code,
      uploadedByPartyName: v.uploadedByParty.name,
      uploadedByUser: v.uploadedByUser.name,
      uploadedAt: v.uploadedAt,
      sizeBytes: Number(v.sizeBytes),
      sizeLabel: formatBytes(v.sizeBytes),
      description: v.description,
      canDelete: canDeleteVersion(v.uploadedByParty.code, activePartyCode),
      isLatest: v.version === document.currentVersion,
    })),
    activePartyCode,
  });
}
