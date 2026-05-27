import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const versionParam = searchParams.get("version");

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      folder: true,
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const activeParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });
  if (!activeParty) {
    return NextResponse.json({ error: "Party not found" }, { status: 400 });
  }

  if (versionParam) {
    const versionNumber = parseInt(versionParam, 10);
    if (!Number.isFinite(versionNumber)) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    }

    const docVersion = document.versions.find((v) => v.version === versionNumber);
    if (!docVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    await deleteFile(docVersion.storageKey);
    await prisma.documentVersion.delete({ where: { id: docVersion.id } });

    const remaining = await prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { version: "desc" },
    });

    if (remaining.length === 0) {
      await prisma.rfi.updateMany({
        where: { relatedDocumentId: id },
        data: { relatedDocumentId: null },
      });
      await prisma.document.delete({ where: { id } });
    } else {
      await prisma.document.update({
        where: { id },
        data: { currentVersion: remaining[0].version },
      });
    }

    await logActivity({
      type: "DOCUMENT_DELETE",
      summary: `${activeParty.code} deleted v${versionNumber} of ${document.name} from ${document.folder.code}`,
      actorPartyId: activeParty.id,
      metadata: {
        documentId: id,
        version: versionNumber,
        folderCode: document.folder.code,
        fileName: document.name,
      },
    });

    return NextResponse.json({
      deleted: "version",
      documentId: id,
      version: versionNumber,
      documentRemoved: remaining.length === 0,
    });
  }

  for (const v of document.versions) {
    await deleteFile(v.storageKey);
  }

  await prisma.rfi.updateMany({
    where: { relatedDocumentId: id },
    data: { relatedDocumentId: null },
  });

  await prisma.document.delete({ where: { id } });

  await logActivity({
    type: "DOCUMENT_DELETE",
    summary: `${activeParty.code} deleted ${document.name} from ${document.folder.code}`,
    actorPartyId: activeParty.id,
    metadata: {
      documentId: id,
      folderCode: document.folder.code,
      fileName: document.name,
      versionsRemoved: document.versions.length,
    },
  });

  return NextResponse.json({ deleted: "document", documentId: id });
}
