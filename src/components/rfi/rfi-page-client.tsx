"use client";

import { PartyCode, RfiStatus } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RaiseRfiDialog } from "@/components/rfi/raise-rfi-dialog";
import { RfiDetailDialog } from "@/components/rfi/rfi-detail-dialog";

type RfiRow = {
  id: string;
  displayId: string;
  subject: string;
  raisedBy: PartyCode;
  raisedByName: string;
  against: PartyCode;
  againstName: string;
  raisedAt: string;
  dueAt: string;
  daysRemaining: number;
  daysRemainingColor: "green" | "amber" | "red";
  status: RfiStatus;
  isOverdue: boolean;
};

type Filter = "all" | "raised" | "against";

const STATUS_STYLES: Record<RfiStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  ESCALATED: "bg-red-100 text-red-800",
};

const DAYS_COLOR: Record<"green" | "amber" | "red", string> = {
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700 font-semibold",
};

export function RfiPageClient() {
  const searchParams = useSearchParams();
  const openFromUrl = searchParams.get("open");

  const [rfis, setRfis] = useState<RfiRow[]>([]);
  const [viewerParty, setViewerParty] = useState<PartyCode | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [showRaise, setShowRaise] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/rfi?filter=${filter}`);
    const data = await res.json();
    if (res.ok) {
      setRfis(data.rfis ?? []);
      setViewerParty(data.viewerPartyCode ?? null);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
    const onPartyChange = () => load();
    window.addEventListener("cde-party-changed", onPartyChange);
    return () => window.removeEventListener("cde-party-changed", onPartyChange);
  }, [load]);

  useEffect(() => {
    if (openFromUrl) setDetailId(openFromUrl);
  }, [openFromUrl]);

  const isPmc = viewerParty === "A";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">RFI Register</h1>
          <p className="text-sm text-slate-500">
            Raise, track, and resolve requests for information. Due date is 7
            calendar days from raised date.
          </p>
        </div>
        {viewerParty && (
          <button
            type="button"
            onClick={() => setShowRaise(true)}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Raise RFI
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(isPmc
          ? ([
              ["all", "All RFIs"],
              ["raised", "Raised by VISL"],
              ["against", "Against VISL"],
            ] as const)
          : ([
              ["all", "All my RFIs"],
              ["raised", "Raised by me"],
              ["against", "Against me"],
            ] as const)
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === value
                ? "bg-blue-700 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">RFI ID</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Raised by</th>
              <th className="px-4 py-3">Against</th>
              <th className="px-4 py-3">Raised</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Days left</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rfis.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No RFIs match this filter.
                </td>
              </tr>
            ) : (
              rfis.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setDetailId(r.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">
                    {r.displayId}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">{r.subject}</td>
                  <td className="px-4 py-3">Party {r.raisedBy}</td>
                  <td className="px-4 py-3">Party {r.against}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.raisedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.dueAt).toLocaleDateString()}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap ${DAYS_COLOR[r.daysRemainingColor]}`}
                  >
                    {r.status === "RESOLVED"
                      ? "—"
                      : r.daysRemaining <= 0
                        ? `${Math.abs(r.daysRemaining)}d overdue`
                        : `${r.daysRemaining}d`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Days remaining:{" "}
        <span className="text-green-700">green</span> (3+ days),{" "}
        <span className="text-amber-700">amber</span> (1–2 days),{" "}
        <span className="text-red-700">red</span> (overdue). PMC can escalate
        overdue unresolved RFIs.
      </p>

      {showRaise && viewerParty && (
        <RaiseRfiDialog
          viewerParty={viewerParty}
          onClose={() => setShowRaise(false)}
          onCreated={load}
        />
      )}

      {detailId && (
        <RfiDetailDialog
          rfiId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
