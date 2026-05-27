"use client";

import { PartyCode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PARTY_LABELS } from "@/lib/party-labels";

const PARTIES: PartyCode[] = ["A", "B", "C", "D"];

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function PartySwitcher({ loggedInParty }: { loggedInParty: PartyCode }) {
  const router = useRouter();
  const [active, setActive] = useState<PartyCode>(loggedInParty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromCookie = getCookie("cde-active-party") as PartyCode | null;
    if (fromCookie && PARTIES.includes(fromCookie)) {
      setActive(fromCookie);
    } else {
      setActive(loggedInParty);
    }
  }, [loggedInParty]);

  async function switchParty(code: PartyCode) {
    setLoading(true);
    try {
      const res = await fetch("/api/party/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyCode: code }),
      });
      if (res.ok) {
        setActive(code);
        window.dispatchEvent(new CustomEvent("cde-party-changed"));
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="party-switch" className="text-xs text-slate-500">
        Act as:
      </label>
      <select
        id="party-switch"
        value={active}
        disabled={loading}
        onChange={(e) => switchParty(e.target.value as PartyCode)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
        title="Demo party switcher (FR-031)"
      >
        {PARTIES.map((code) => (
          <option key={code} value={code} className="bg-white text-slate-900">
            {PARTY_LABELS[code]}
            {code === loggedInParty ? " (login)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
