import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  createEvmImportToken,
  getEvmDashboardUrl,
} from "@/lib/evm-import-token";
import { isEvmScheduleFile } from "@/lib/files";
import { getActivePartyCode } from "@/lib/party-context";
import { getPartyLabel } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";

export async function POST(
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
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!document || document.versions.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isEvmScheduleFile(document.name)) {
    return NextResponse.json(
      {
        error:
          "Only Microsoft Project schedule files (.xml, .mpp, .mspdi) can be opened in the EVM dashboard",
      },
      { status: 400 },
    );
  }

  const token = createEvmImportToken(id, document.currentVersion);
  const dashboardBase = getEvmDashboardUrl();
  const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "";
  if (!origin) {
    return NextResponse.json(
      { error: "NEXTAUTH_URL is not configured" },
      { status: 500 },
    );
  }

  const importUrl = new URL(dashboardBase);
  importUrl.searchParams.set("docId", id);
  importUrl.searchParams.set("origin", origin);
  importUrl.searchParams.set("token", token);
  importUrl.searchParams.set("name", document.name);

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const activeParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });

  if (activeParty) {
    await logActivity({
      type: "DOCUMENT_UPLOAD",
      summary: `${getPartyLabel(activeParty.code)} opened ${document.name} in EVM Dashboard`,
      actorPartyId: activeParty.id,
      metadata: {
        action: "evm_dashboard_open",
        documentId: id,
        folderCode: document.folder.code,
        fileName: document.name,
      },
    });
  }

  return NextResponse.json({
    importUrl: importUrl.toString(),
    expiresInSeconds: 15 * 60,
  });
}
