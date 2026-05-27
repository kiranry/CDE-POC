import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  clearAllNotificationsForViewer,
  getNotificationsForViewer,
  getUnreadCountForViewer,
} from "@/lib/notifications";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForViewer(activePartyCode),
    getUnreadCountForViewer(activePartyCode),
  ]);

  return NextResponse.json({
    unreadCount,
    viewerPartyCode: activePartyCode,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      payload: n.payload,
      readAt: n.readAt,
      createdAt: n.createdAt,
      recipientParty: n.recipientParty.code,
      isRead: n.readAt !== null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const markAll = body.markAll === true;
  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  if (markAll) {
    const party = await prisma.party.findUnique({
      where: { code: activePartyCode },
    });
    if (party) {
      await prisma.notification.updateMany({
        where: { recipientPartyId: party.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  await clearAllNotificationsForViewer(activePartyCode);

  return NextResponse.json({ ok: true });
}
