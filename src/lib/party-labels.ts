import { PartyCode } from "@prisma/client";

export const ACTIVE_PARTY_COOKIE = "cde-active-party";

export const PARTY_LABELS: Record<PartyCode, string> = {
  A: "VISL (PMC)",
  B: "SR (Southern Railway)",
  C: "Adani",
  D: "KRCL (Konkan Railway)",
};

export function getPartyLabel(
  code: PartyCode | string | null | undefined,
): string {
  if (!code) return "Unknown";
  if (code in PARTY_LABELS) {
    return PARTY_LABELS[code as PartyCode];
  }
  return code;
}
