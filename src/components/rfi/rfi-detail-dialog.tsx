"use client";

import { PartyCode, RfiStatus } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE } from "@/lib/files";
import { uploadDocumentFile } from "@/lib/upload-client";

type RfiDetail = {
  id: string;
  displayId: string;
  subject: string;
  description: string;
  raisedBy: PartyCode;
  raisedByName: string;
  against: PartyCode;
  againstName: string;
  relatedDocument: {
    id: string;
    name: string;
    folderId: string;
    folderCode: string;
    currentVersion: number;
  } | null;
  raisedAt: string;
  dueAt: string;
  status: RfiStatus;
  resolutionText: string | null;
  daysRemaining: number;
  daysRemainingColor: "green" | "amber" | "red";
  isOverdue: boolean;
  canMarkPending: boolean;
  canResolve: boolean;
  canEscalate: boolean;
  events: {
    id: string;
    eventType: string;
    fromStatus: RfiStatus | null;
    toStatus: RfiStatus;
    actorParty: PartyCode;
    actorPartyName: string;
    note: string | null;
    createdAt: string;
  }[];
};

const STATUS_LABELS: Record<RfiStatus, string> = {
  OPEN: "Open",
  PENDING: "Pending",
  RESOLVED: "Resolved",
  ESCALATED: "Escalated",
};

const COLOR_CLASSES = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

export function RfiDetailDialog({
  rfiId,
  onClose,
  onUpdated,
}: {
  rfiId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [rfi, setRfi] = useState<RfiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionText, setResolutionText] = useState("");
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const revisionInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/rfi/${rfiId}`);
    const data = await res.json();
    if (res.ok) {
      setRfi(data.rfi);
      if (data.rfi.resolutionText) {
        setResolutionText(data.rfi.resolutionText);
      }
    }
    setLoading(false);
  }, [rfiId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve() {
    if (!resolutionText.trim()) {
      setActionError("Resolution text is required");
      return;
    }

    setActing(true);
    setActionError(null);

    try {
      let revisionVersion: number | undefined;

      if (revisionFile && rfi?.relatedDocument) {
        const uploadResult = await uploadDocumentFile({
          folderId: rfi.relatedDocument.folderId,
          file: revisionFile,
          description: `RFI ${rfi.displayId} resolution revision`,
          parentDocumentId: rfi.relatedDocument.id,
        });
        revisionVersion = uploadResult.version;
      }

      const res = await fetch(`/api/rfi/${rfiId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          resolutionText,
          revisionVersion,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Action failed");
        return;
      }
      window.dispatchEvent(new CustomEvent("cde-notifications-changed"));
      setRevisionFile(null);
      if (revisionInputRef.current) revisionInputRef.current.value = "";
      await load();
      onUpdated();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setActing(false);
    }
  }

  async function runAction(
    action: "pending" | "resolve" | "escalate",
    body: Record<string, string> = {},
  ) {
    setActing(true);
    setActionError(null);
    const res = await fetch(`/api/rfi/${rfiId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    setActing(false);
    if (!res.ok) {
      setActionError(data.error ?? "Action failed");
      return;
    }
    window.dispatchEvent(new CustomEvent("cde-notifications-changed"));
    await load();
    onUpdated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {loading ? (
                <p className="text-slate-500">Loading…</p>
              ) : rfi ? (
                <>
                  <p className="text-sm font-medium text-blue-700">{rfi.displayId}</p>
                  <h2 className="text-lg font-semibold text-slate-900">{rfi.subject}</h2>
                </>
              ) : (
                <p className="text-red-600">RFI not found</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        {rfi && (
          <div className="space-y-6 p-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Raised by</dt>
                <dd className="font-medium">{rfi.raisedByName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Against</dt>
                <dd className="font-medium">{rfi.againstName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Raised</dt>
                <dd>{new Date(rfi.raisedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due</dt>
                <dd>{new Date(rfi.dueAt).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                    {STATUS_LABELS[rfi.status]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Days remaining</dt>
                <dd>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${COLOR_CLASSES[rfi.daysRemainingColor]}`}
                  >
                    {rfi.status === "RESOLVED"
                      ? "Closed"
                      : rfi.daysRemaining <= 0
                        ? `${Math.abs(rfi.daysRemaining)} days overdue`
                        : `${rfi.daysRemaining} days`}
                  </span>
                </dd>
              </div>
            </dl>

            {rfi.relatedDocument && (
              <p className="text-sm text-slate-600">
                Related document:{" "}
                <span className="font-medium">{rfi.relatedDocument.name}</span> (
                {rfi.relatedDocument.folderCode}, v
                {rfi.relatedDocument.currentVersion})
              </p>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-800">Description</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {rfi.description}
              </p>
            </div>

            {rfi.resolutionText && (
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Resolution</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {rfi.resolutionText}
                </p>
              </div>
            )}

            {(rfi.canMarkPending || rfi.canResolve || rfi.canEscalate) && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-800">Actions</h3>
                {actionError && (
                  <p className="mt-2 text-sm text-red-600">{actionError}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {rfi.canMarkPending && (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => runAction("pending")}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
                    >
                      Mark pending
                    </button>
                  )}
                  {rfi.canResolve && (
                    <>
                      <textarea
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        placeholder="Written resolution (required)"
                        rows={3}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      {rfi.relatedDocument && (
                        <div className="w-full rounded-md border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">
                            Upload revision (optional)
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Attaches as v{rfi.relatedDocument.currentVersion + 1}{" "}
                            of {rfi.relatedDocument.name} in{" "}
                            {rfi.relatedDocument.folderCode}.
                          </p>
                          <input
                            ref={revisionInputRef}
                            type="file"
                            accept={ACCEPT_ATTRIBUTE}
                            className="mt-2 block w-full text-sm"
                            onChange={(e) =>
                              setRevisionFile(e.target.files?.[0] ?? null)
                            }
                          />
                          {revisionFile && (
                            <p className="mt-1 text-xs text-slate-600">
                              Selected: {revisionFile.name}
                            </p>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={acting || !resolutionText.trim()}
                        onClick={handleResolve}
                        className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {acting
                          ? revisionFile
                            ? "Uploading & resolving…"
                            : "Resolving…"
                          : "Resolve RFI"}
                      </button>
                    </>
                  )}
                  {rfi.canEscalate && (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => runAction("escalate")}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                    >
                      Escalate (PMC)
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-slate-800">History</h3>
              <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
                {rfi.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <p className="text-sm font-medium text-slate-800">
                      {e.eventType}
                      {e.fromStatus && (
                        <span className="font-normal text-slate-500">
                          {" "}
                          ({e.fromStatus} → {e.toStatus})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.actorPartyName} — {new Date(e.createdAt).toLocaleString()}
                    </p>
                    {e.note && (
                      <p className="mt-1 text-sm text-slate-600">{e.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
