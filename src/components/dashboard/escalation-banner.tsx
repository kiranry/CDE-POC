import Link from "next/link";
import { getPartyLabel } from "@/lib/party-labels";

export type EscalatedRfi = {
  id: string;
  displayId: string;
  subject: string;
  against: string;
};

export function EscalationBanner({ rfis }: { rfis: EscalatedRfi[] }) {
  if (rfis.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-red-800">
            PMC attention required
          </p>
          <p className="mt-1 text-sm text-red-900">
            {rfis.length} escalated RFI{rfis.length === 1 ? "" : "s"} need oversight.
          </p>
        </div>
        <Link
          href="/rfi"
          className="shrink-0 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
        >
          Open RFI register
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {rfis.map((r) => (
          <li key={r.id}>
            <Link
              href={`/rfi?open=${r.id}`}
              className="block rounded-md border border-red-200 bg-white px-3 py-2 text-sm hover:bg-red-50"
            >
              <span className="font-mono text-xs font-semibold text-red-700">
                {r.displayId}
              </span>
              <span className="mx-2 text-red-300">·</span>
              <span className="text-slate-800">{r.subject}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Assigned to {getPartyLabel(r.against)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
