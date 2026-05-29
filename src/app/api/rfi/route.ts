import { PartyCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";
import {
  createRfi,
  listRfisForViewer,
  serializeRfiListItem,
  type RfiFilter,
} from "@/lib/rfi";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterParam = searchParams.get("filter") ?? "all";
  const filter: RfiFilter =
    filterParam === "raised" || filterParam === "against"
      ? filterParam
      : "all";

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const rfis = await listRfisForViewer(activePartyCode, filter);

  return NextResponse.json({
    viewerPartyCode: activePartyCode,
    filter,
    rfis: rfis.map(serializeRfiListItem),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const respondentPartyCode = body.respondentPartyCode as PartyCode;
  const relatedDocumentId =
    typeof body.relatedDocumentId === "string"
      ? body.relatedDocumentId
      : undefined;

  if (!subject || !description) {
    return NextResponse.json(
      { error: "Subject and description are required" },
      { status: 400 },
    );
  }

  if (!["A", "B", "C", "D"].includes(respondentPartyCode)) {
    return NextResponse.json(
      { error: "Invalid respondent party" },
      { status: 400 },
    );
  }

  const activePartyCode = await getActivePartyCode(session.user.partyCode);
  const raiserParty = await prisma.party.findUnique({
    where: { code: activePartyCode },
  });
  if (!raiserParty) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 400 });
  }

  try {
    const rfi = await createRfi({
      subject,
      description,
      respondentPartyCode,
      relatedDocumentId,
      raiserPartyId: raiserParty.id,
      raiserPartyCode: activePartyCode,
      raiserPartyName: raiserParty.name,
    });

    return NextResponse.json({
      rfi: serializeRfiListItem({
        ...rfi,
        relatedDocument: rfi.relatedDocument,
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create RFI";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
