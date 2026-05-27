import { NextResponse } from "next/server";
import { ACTIVE_PARTY_COOKIE } from "@/lib/party-labels";

/** Clears demo party override on sign-out. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_PARTY_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
