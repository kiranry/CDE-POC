import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  const notification = await prisma.notification.findUnique({
    where: { id },
    include: { recipientParty: true },
  });

  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (notification.recipientParty.code !== activePartyCode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
