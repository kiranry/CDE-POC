import { PartyCode } from "@prisma/client";

export const ACTIVE_PARTY_COOKIE = "cde-active-party";

export const PARTY_LABELS: Record<PartyCode, string> = {
  A: "VISL (PMC)",
  B: "SR (Southern Railway)",
  C: "Adani",
  D: "KRCL (Konkan Railway)",
};
