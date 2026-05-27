import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ActivityFeedItem = {
  id: string;
  type: ActivityType;
  summary: string;
  actorPartyCode: string | null;
  actorPartyName: string | null;
  createdAt: string;
  href: string;
  linkLabel: string;
};

type ActivityMetadata = {
  documentId?: string;
  fileName?: string;
  folderCode?: string;
  version?: number;
  rfiId?: string;
  displayId?: string;
};

function buildActivityLink(
  type: ActivityType,
  metadata: ActivityMetadata | null,
): { href: string; linkLabel: string } {
  if (type === "DOCUMENT_DELETE") {
    return { href: "/documents", linkLabel: "Go to documents" };
  }

  if (
    (type === "DOCUMENT_UPLOAD" || type === "DOCUMENT_VERSION") &&
    metadata?.documentId
  ) {
    return {
      href: `/documents?history=${metadata.documentId}`,
      linkLabel: metadata.fileName
        ? `View history — ${metadata.fileName}`
        : "View version history",
    };
  }

  if (metadata?.rfiId) {
    return {
      href: `/rfi?open=${metadata.rfiId}`,
      linkLabel: metadata.displayId
        ? `Open ${metadata.displayId}`
        : "Open RFI",
    };
  }

  if (type.startsWith("RFI_")) {
    return { href: "/rfi", linkLabel: "Open RFI register" };
  }

  return { href: "/documents", linkLabel: "Go to documents" };
}

export function serializeActivity(
  row: Prisma.ActivityLogGetPayload<{
    include: { actorParty: true };
  }>,
): ActivityFeedItem {
  const metadata = (row.metadata ?? null) as ActivityMetadata | null;
  const { href, linkLabel } = buildActivityLink(row.type, metadata);

  return {
    id: row.id,
    type: row.type,
    summary: row.summary,
    actorPartyCode: row.actorParty?.code ?? null,
    actorPartyName: row.actorParty?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    href,
    linkLabel,
  };
}

export async function getRecentActivity(limit = 30): Promise<ActivityFeedItem[]> {
  const rows = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actorParty: true },
  });
  return rows.map(serializeActivity);
}

export async function getActivitySince(
  since: Date,
  limit = 20,
): Promise<ActivityFeedItem[]> {
  const rows = await prisma.activityLog.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actorParty: true },
  });
  return rows.map(serializeActivity);
}

export async function getRecentUploads(limit = 10) {
  const versions = await prisma.documentVersion.findMany({
    orderBy: { uploadedAt: "desc" },
    take: limit,
    include: {
      uploadedByParty: true,
      uploadedByUser: true,
      document: { include: { folder: true } },
    },
  });

  return versions.map((v) => ({
    id: v.id,
    documentId: v.documentId,
    fileName: v.document.name,
    folderCode: v.document.folder.code,
    folderName: v.document.folder.name,
    version: v.version,
    uploadedByParty: v.uploadedByParty.code,
    uploadedByPartyName: v.uploadedByParty.name,
    uploadedByUser: v.uploadedByUser.name,
    uploadedAt: v.uploadedAt.toISOString(),
    sizeBytes: Number(v.sizeBytes),
  }));
}
