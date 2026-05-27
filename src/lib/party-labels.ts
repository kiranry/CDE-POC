import { PartyCode } from "@prisma/client";

export const ACTIVE_PARTY_COOKIE = "cde-active-party";

export const PARTY_LABELS: Record<PartyCode, string> = {
  A: "Party A (PMC)",
  B: "Party B (Design)",
  C: "Party C (Contractor)",
  D: "Party D (Sub-Con)",
};
