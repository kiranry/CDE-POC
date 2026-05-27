import { PartyCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ACTIVE_PARTY_COOKIE } from "@/lib/party-labels";

const VALID: PartyCode[] = ["A", "B", "C", "D"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const partyCode = body.partyCode as PartyCode;
  if (!VALID.includes(partyCode)) {
    return NextResponse.json({ error: "Invalid party" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, partyCode });
  response.cookies.set(ACTIVE_PARTY_COOKIE, partyCode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
