import { PartyCode, Prisma, RfiStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { getPartyLabel } from "@/lib/party-labels";
import {
  notifyRfiEscalated,
  notifyRfiRaised,
  notifyRfiResolved,
} from "@/lib/notifications";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type RfiFilter = "all" | "raised" | "against";

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDaysRemaining(dueAt: Date, now = new Date()): number {
  const due = new Date(dueAt);
  due.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
}

export type DaysRemainingColor = "green" | "amber" | "red";

export function getDaysRemainingColor(
  daysRemaining: number,
  status: RfiStatus,
): DaysRemainingColor {
  if (status === "RESOLVED") return "green";
  if (daysRemaining <= 0) return "red";
  if (daysRemaining <= 2) return "amber";
  return "green";
}

export function isRfiOverdue(dueAt: Date, status: RfiStatus, now = new Date()): boolean {
  if (status === "RESOLVED") return false;
  return getDaysRemaining(dueAt, now) <= 0;
}

async function nextDisplayId(): Promise<string> {
  const count = await prisma.rfi.count();
  return `RFI-${String(count + 1).padStart(3, "0")}`;
}

function buildRfiWhere(
  activePartyCode: PartyCode,
  filter: RfiFilter,
): Prisma.RfiWhereInput {
  if (activePartyCode === "A") {
    if (filter === "raised") {
      return { raisedByParty: { code: "A" } };
    }
    if (filter === "against") {
      return { respondentParty: { code: "A" } };
    }
    return {};
  }

  if (filter === "raised") {
    return { raisedByParty: { code: activePartyCode } };
  }
  if (filter === "against") {
    return { respondentParty: { code: activePartyCode } };
  }

  return {
    OR: [
      { raisedByParty: { code: activePartyCode } },
      { respondentParty: { code: activePartyCode } },
    ],
  };
}

export async function listRfisForViewer(
  activePartyCode: PartyCode,
  filter: RfiFilter = "all",
) {
  const effectiveFilter =
    activePartyCode === "A" ? filter : filter === "all" ? "all" : filter;

  return prisma.rfi.findMany({
    where: buildRfiWhere(activePartyCode, effectiveFilter),
    orderBy: { raisedAt: "desc" },
    include: {
      raisedByParty: true,
      respondentParty: true,
      relatedDocument: true,
    },
  });
}

export async function getRfiById(id: string) {
  return prisma.rfi.findUnique({
    where: { id },
    include: {
      raisedByParty: true,
      respondentParty: true,
      relatedDocument: { include: { folder: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actorParty: true },
      },
    },
  });
}

export function canViewerAccessRfi(
  rfi: { raisedByParty: { code: PartyCode }; respondentParty: { code: PartyCode } },
  activePartyCode: PartyCode,
): boolean {
  if (activePartyCode === "A") return true;
  return (
    rfi.raisedByParty.code === activePartyCode ||
    rfi.respondentParty.code === activePartyCode
  );
}

export type CreateRfiInput = {
  subject: string;
  description: string;
  respondentPartyCode: PartyCode;
  relatedDocumentId?: string;
  raiserPartyId: string;
  raiserPartyCode: PartyCode;
  raiserPartyName: string;
};

export async function createRfi(input: CreateRfiInput) {
  if (input.respondentPartyCode === input.raiserPartyCode) {
    throw new Error("Cannot raise RFI against your own party");
  }

  const respondent = await prisma.party.findUnique({
    where: { code: input.respondentPartyCode },
  });
  if (!respondent) throw new Error("Respondent party not found");

  if (input.relatedDocumentId) {
    const doc = await prisma.document.findUnique({
      where: { id: input.relatedDocumentId },
    });
    if (!doc) throw new Error("Related document not found");
  }

  const raisedAt = new Date();
  const dueAt = addCalendarDays(raisedAt, 7);
  const displayId = await nextDisplayId();

  const rfi = await prisma.rfi.create({
    data: {
      displayId,
      subject: input.subject,
      description: input.description,
      raisedByPartyId: input.raiserPartyId,
      respondentPartyId: respondent.id,
      relatedDocumentId: input.relatedDocumentId ?? null,
      raisedAt,
      dueAt,
      status: "OPEN",
      events: {
        create: {
          eventType: "CREATED",
          fromStatus: null,
          toStatus: "OPEN",
          actorPartyId: input.raiserPartyId,
          note: input.description,
        },
      },
    },
    include: {
      raisedByParty: true,
      respondentParty: true,
      relatedDocument: true,
    },
  });

  await logActivity({
    type: "RFI_CREATED",
    summary: `${displayId} raised by ${getPartyLabel(input.raiserPartyCode)} against ${getPartyLabel(input.respondentPartyCode)}`,
    actorPartyId: input.raiserPartyId,
    metadata: {
      rfiId: rfi.id,
      displayId,
      subject: input.subject,
    },
  });

  await notifyRfiRaised({
    displayId,
    subject: input.subject,
    description: input.description,
    raiserPartyCode: input.raiserPartyCode,
    raiserPartyName: input.raiserPartyName,
    respondentPartyCode: input.respondentPartyCode,
    dueAt,
  });

  return rfi;
}

async function appendRfiEvent(params: {
  rfiId: string;
  eventType: import("@prisma/client").RfiEventType;
  fromStatus: RfiStatus;
  toStatus: RfiStatus;
  actorPartyId: string;
  note?: string;
}) {
  await prisma.rfiEvent.create({
    data: {
      rfiId: params.rfiId,
      eventType: params.eventType,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      actorPartyId: params.actorPartyId,
      note: params.note,
    },
  });
}

export async function markRfiPending(params: {
  rfiId: string;
  actorPartyId: string;
  actorPartyCode: PartyCode;
}) {
  const rfi = await prisma.rfi.findUnique({
    where: { id: params.rfiId },
    include: { respondentParty: true },
  });
  if (!rfi) throw new Error("RFI not found");
  if (rfi.respondentParty.code !== params.actorPartyCode) {
    throw new Error("Only the respondent can mark an RFI as pending");
  }
  if (rfi.status !== "OPEN") {
    throw new Error("Only open RFIs can be marked pending");
  }

  const updated = await prisma.rfi.update({
    where: { id: params.rfiId },
    data: { status: "PENDING" },
    include: { raisedByParty: true, respondentParty: true },
  });

  await appendRfiEvent({
    rfiId: params.rfiId,
    eventType: "PENDING",
    fromStatus: "OPEN",
    toStatus: "PENDING",
    actorPartyId: params.actorPartyId,
  });

  await logActivity({
    type: "RFI_UPDATED",
    summary: `${rfi.displayId} marked pending by ${getPartyLabel(params.actorPartyCode)}`,
    actorPartyId: params.actorPartyId,
    metadata: { rfiId: rfi.id, displayId: rfi.displayId },
  });

  return updated;
}

export async function resolveRfi(params: {
  rfiId: string;
  resolutionText: string;
  actorPartyId: string;
  actorPartyCode: PartyCode;
  revisionVersion?: number;
}) {
  const rfi = await prisma.rfi.findUnique({
    where: { id: params.rfiId },
    include: { raisedByParty: true, respondentParty: true },
  });
  if (!rfi) throw new Error("RFI not found");
  if (rfi.respondentParty.code !== params.actorPartyCode) {
    throw new Error("Only the respondent can resolve an RFI");
  }
  if (rfi.status === "RESOLVED") {
    throw new Error("RFI is already resolved");
  }
  if (!params.resolutionText.trim()) {
    throw new Error("Resolution text is required");
  }

  const fromStatus = rfi.status;
  const resolutionNote = params.revisionVersion
    ? `${params.resolutionText.trim()}\n\nRevision uploaded: v${params.revisionVersion}`
    : params.resolutionText.trim();

  const updated = await prisma.rfi.update({
    where: { id: params.rfiId },
    data: {
      status: "RESOLVED",
      resolutionText: params.resolutionText.trim(),
    },
    include: { raisedByParty: true, respondentParty: true },
  });

  await appendRfiEvent({
    rfiId: params.rfiId,
    eventType: "RESOLVED",
    fromStatus,
    toStatus: "RESOLVED",
    actorPartyId: params.actorPartyId,
    note: resolutionNote,
  });

  await logActivity({
    type: "RFI_RESOLVED",
    summary: `${rfi.displayId} resolved by ${getPartyLabel(params.actorPartyCode)}`,
    actorPartyId: params.actorPartyId,
    metadata: { rfiId: rfi.id, displayId: rfi.displayId },
  });

  await notifyRfiResolved({
    displayId: rfi.displayId,
    subject: rfi.subject,
    raiserPartyCode: rfi.raisedByParty.code,
    respondentPartyCode: rfi.respondentParty.code,
    resolutionText: params.resolutionText.trim(),
  });

  return updated;
}

export async function escalateRfi(params: {
  rfiId: string;
  actorPartyCode: PartyCode;
  actorPartyId: string;
  note?: string;
}) {
  if (params.actorPartyCode !== "A") {
    throw new Error("Only VISL (PMC) can escalate RFIs");
  }

  const rfi = await prisma.rfi.findUnique({
    where: { id: params.rfiId },
    include: { raisedByParty: true, respondentParty: true },
  });
  if (!rfi) throw new Error("RFI not found");
  if (rfi.status === "RESOLVED") {
    throw new Error("Cannot escalate a resolved RFI");
  }
  if (!isRfiOverdue(rfi.dueAt, rfi.status)) {
    throw new Error("RFI must be overdue before escalation");
  }

  const fromStatus = rfi.status;
  const updated = await prisma.rfi.update({
    where: { id: params.rfiId },
    data: { status: "ESCALATED" },
    include: { raisedByParty: true, respondentParty: true },
  });

  await appendRfiEvent({
    rfiId: params.rfiId,
    eventType: "ESCALATED",
    fromStatus,
    toStatus: "ESCALATED",
    actorPartyId: params.actorPartyId,
    note: params.note,
  });

  await logActivity({
    type: "RFI_ESCALATED",
    summary: `${rfi.displayId} escalated by PMC`,
    actorPartyId: params.actorPartyId,
    metadata: { rfiId: rfi.id, displayId: rfi.displayId },
  });

  await notifyRfiEscalated({
    displayId: rfi.displayId,
    subject: rfi.subject,
    raiserPartyCode: rfi.raisedByParty.code,
    respondentPartyCode: rfi.respondentParty.code,
  });

  return updated;
}

export function serializeRfiListItem(
  rfi: Awaited<ReturnType<typeof listRfisForViewer>>[number],
) {
  const daysRemaining = getDaysRemaining(rfi.dueAt);
  return {
    id: rfi.id,
    displayId: rfi.displayId,
    subject: rfi.subject,
    raisedBy: rfi.raisedByParty.code,
    raisedByName: rfi.raisedByParty.name,
    against: rfi.respondentParty.code,
    againstName: rfi.respondentParty.name,
    raisedAt: rfi.raisedAt,
    dueAt: rfi.dueAt,
    daysRemaining,
    daysRemainingColor: getDaysRemainingColor(daysRemaining, rfi.status),
    status: rfi.status,
    relatedDocumentId: rfi.relatedDocumentId,
    relatedDocumentName: rfi.relatedDocument?.name ?? null,
    isOverdue: isRfiOverdue(rfi.dueAt, rfi.status),
  };
}
