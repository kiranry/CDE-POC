import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";
import {
  canViewerAccessRfi,
  escalateRfi,
  getDaysRemaining,
  getDaysRemainingColor,
  getRfiById,
  isRfiOverdue,
  markRfiPending,
  resolveRfi,
} from "@/lib/rfi";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const rfi = await getRfiById(id);
  if (!rfi) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  if (!canViewerAccessRfi(rfi, activePartyCode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const daysRemaining = getDaysRemaining(rfi.dueAt);
  const actorParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });

  return NextResponse.json({
    viewerPartyCode: activePartyCode,
    rfi: {
      id: rfi.id,
      displayId: rfi.displayId,
      subject: rfi.subject,
      description: rfi.description,
      raisedBy: rfi.raisedByParty.code,
      raisedByName: rfi.raisedByParty.name,
      against: rfi.respondentParty.code,
      againstName: rfi.respondentParty.name,
      relatedDocument: rfi.relatedDocument
        ? {
            id: rfi.relatedDocument.id,
            name: rfi.relatedDocument.name,
            folderCode: rfi.relatedDocument.folder.code,
          }
        : null,
      raisedAt: rfi.raisedAt,
      dueAt: rfi.dueAt,
      status: rfi.status,
      resolutionText: rfi.resolutionText,
      daysRemaining,
      daysRemainingColor: getDaysRemainingColor(daysRemaining, rfi.status),
      isOverdue: isRfiOverdue(rfi.dueAt, rfi.status),
      canMarkPending:
        rfi.status === "OPEN" &&
        rfi.respondentParty.code === activePartyCode,
      canResolve:
        (rfi.status === "OPEN" || rfi.status === "PENDING") &&
        rfi.respondentParty.code === activePartyCode,
      canEscalate:
        activePartyCode === "A" &&
        rfi.status !== "RESOLVED" &&
        isRfiOverdue(rfi.dueAt, rfi.status),
      events: rfi.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actorParty: e.actorParty.code,
        actorPartyName: e.actorParty.name,
        note: e.note,
        createdAt: e.createdAt,
      })),
    },
    actorPartyId: actorParty?.id,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const rfi = await getRfiById(id);
  if (!rfi) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  if (!canViewerAccessRfi(rfi, activePartyCode)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });
  if (!actorParty) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
  }

  const body = await request.json();
  const action = body.action as string;

  try {
    if (action === "pending") {
      await markRfiPending({
        rfiId: id,
        actorPartyId: actorParty.id,
        actorPartyCode: activePartyCode,
      });
    } else if (action === "resolve") {
      const resolutionText =
        typeof body.resolutionText === "string" ? body.resolutionText : "";
      await resolveRfi({
        rfiId: id,
        resolutionText,
        actorPartyId: actorParty.id,
        actorPartyCode: activePartyCode,
      });
    } else if (action === "escalate") {
      const note = typeof body.note === "string" ? body.note : undefined;
      await escalateRfi({
        rfiId: id,
        actorPartyCode: activePartyCode,
        actorPartyId: actorParty.id,
        note,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
