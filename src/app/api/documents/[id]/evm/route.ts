import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import {
  evmCorsHeaders,
  verifyEvmImportToken,
} from "@/lib/evm-import-token";
import { isEvmScheduleFile } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/storage";

export async function OPTIONS(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await params;
  const cors = evmCorsHeaders(request);
  if (!cors["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cors = evmCorsHeaders(request);
  if (!cors["Access-Control-Allow-Origin"]) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing token" },
      { status: 401, headers: cors },
    );
  }

  const verified = verifyEvmImportToken(token, id);
  if (!verified.valid) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401, headers: cors },
    );
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      folder: true,
      versions: { orderBy: { version: "desc" } },
    },
  });

  if (!document || document.versions.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: cors });
  }

  if (!isEvmScheduleFile(document.name)) {
    return NextResponse.json(
      { error: "File type not supported for EVM import" },
      { status: 400, headers: cors },
    );
  }

  const versionNumber = verified.version ?? document.currentVersion;
  const docVersion = document.versions.find((v) => v.version === versionNumber);
  if (!docVersion) {
    return NextResponse.json(
      { error: "Version not found" },
      { status: 404, headers: cors },
    );
  }

  const buffer = await getFile(docVersion.storageKey);

  await logActivity({
    type: "DOCUMENT_UPLOAD",
    summary: `EVM Dashboard imported ${document.name} from ${document.folder.code}`,
    metadata: {
      action: "evm_dashboard_import",
      documentId: id,
      folderCode: document.folder.code,
      fileName: document.name,
      version: versionNumber,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...cors,
      "Content-Type": docVersion.mimeType || "application/xml",
      "Content-Disposition": `inline; filename="${document.name}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
