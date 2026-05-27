import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logActivity(params: {
  type: ActivityType;
  summary: string;
  actorPartyId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      type: params.type,
      summary: params.summary,
      actorPartyId: params.actorPartyId,
      metadata: params.metadata,
    },
  });
}
