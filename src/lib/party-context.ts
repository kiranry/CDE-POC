import { PartyCode } from "@prisma/client";
import { cookies } from "next/headers";
import { ACTIVE_PARTY_COOKIE } from "@/lib/party-labels";

export { ACTIVE_PARTY_COOKIE, PARTY_LABELS } from "@/lib/party-labels";

export async function getActivePartyCode(
  loggedInPartyCode: PartyCode,
): Promise<PartyCode> {
  const cookieStore = await cookies();
  const override = cookieStore.get(ACTIVE_PARTY_COOKIE)?.value;
  if (override && ["A", "B", "C", "D"].includes(override)) {
    return override as PartyCode;
  }
  return loggedInPartyCode;
}
