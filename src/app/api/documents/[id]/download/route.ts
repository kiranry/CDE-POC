import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl, isS3Storage } from "@/lib/storage";

export async function GET(
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
    include: { versions: { orderBy: { version: "desc" } } },
  });

  if (!document || document.versions.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versionNumber = versionParam
    ? parseInt(versionParam, 10)
    : document.currentVersion;

  const docVersion = document.versions.find((v) => v.version === versionNumber);
  if (!docVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  if (isS3Storage()) {
    const downloadUrl = await getPresignedDownloadUrl(docVersion.storageKey, {
      fileName: document.name,
      mimeType: docVersion.mimeType,
      disposition: "attachment",
    });
    return NextResponse.redirect(downloadUrl, 302);
  }

  const { getFile } = await import("@/lib/storage");
  const buffer = await getFile(docVersion.storageKey);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": docVersion.mimeType,
      "Content-Disposition": `attachment; filename="${document.name}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
