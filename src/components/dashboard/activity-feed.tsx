"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatBytes } from "@/lib/files";

export type ActivityItem = {
  id: string;
  type: string;
  summary: string;
  actorPartyCode: string | null;
  actorPartyName: string | null;
  createdAt: string;
  href: string;
  linkLabel: string;
};

const TYPE_LABELS: Record<string, string> = {
  DOCUMENT_UPLOAD: "Upload",
  DOCUMENT_VERSION: "New version",
  DOCUMENT_DELETE: "Deleted",
  RFI_CREATED: "RFI raised",
  RFI_UPDATED: "RFI updated",
  RFI_RESOLVED: "RFI resolved",
  RFI_ESCALATED: "RFI escalated",
  RFI_OVERDUE: "RFI overdue",
};

export function ActivityFeed({
  initialActivities,
}: {
  initialActivities: ActivityItem[];
}) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [live, setLive] = useState(false);

  const mergeActivities = useCallback((incoming: ActivityItem[]) => {
    setActivities((prev) => {
      const seen = new Set(prev.map((a) => a.id));
      const merged = [...incoming.filter((a) => !seen.has(a.id)), ...prev];
      return merged.slice(0, 50);
    });
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/activity/stream");

    source.addEventListener("initial", (e) => {
      const data = JSON.parse(e.data) as { activities: ActivityItem[] };
      setActivities(data.activities);
      setLive(true);
    });

    source.addEventListener("activities", (e) => {
      const data = JSON.parse(e.data) as { activities: ActivityItem[] };
      mergeActivities(data.activities);
    });

    source.addEventListener("error", () => setLive(false));

    return () => source.close();
  }, [mergeActivities]);

  useEffect(() => {
    const refresh = () => {
      fetch("/api/activity?limit=30")
        .then((r) => r.json())
        .then((data) => {
          if (data.activities) setActivities(data.activities);
        });
    };
    window.addEventListener("cde-notifications-changed", refresh);
    window.addEventListener("cde-party-changed", refresh);
    return () => {
      window.removeEventListener("cde-notifications-changed", refresh);
      window.removeEventListener("cde-party-changed", refresh);
    };
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-800">Activity log</h2>
        <span
          className={`flex items-center gap-1.5 text-xs ${
            live ? "text-green-700" : "text-slate-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-slate-300"}`}
          />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>
      {activities.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {activities.map((a) => (
            <li key={a.id} className="px-4 py-3 hover:bg-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                  {TYPE_LABELS[a.type] ?? a.type}
                </span>
                {a.actorPartyCode && (
                  <span className="text-[10px] text-slate-500">
                    Party {a.actorPartyCode}
                  </span>
                )}
                <span className="text-[10px] text-slate-400">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{a.summary}</p>
              <Link
                href={a.href}
                className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
              >
                {a.linkLabel} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type RecentUpload = {
  id: string;
  documentId: string;
  fileName: string;
  folderCode: string;
  folderName: string;
  version: number;
  uploadedByParty: string;
  uploadedByPartyName: string;
  uploadedByUser: string;
  uploadedAt: string;
  sizeBytes: number;
};

export function RecentUploadsList({ uploads }: { uploads: RecentUpload[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-800">Recent uploads</h2>
        <p className="text-xs text-slate-500">Metadata only — download from Documents</p>
      </div>
      {uploads.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No uploads yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {uploads.map((u) => (
            <li key={u.id} className="px-4 py-3 hover:bg-slate-50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{u.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {u.folderCode} — {u.folderName}
                  </p>
                </div>
                <span className="text-xs text-slate-400">v{u.version}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Party {u.uploadedByParty} · {u.uploadedByUser} ·{" "}
                {formatBytes(u.sizeBytes)}
              </p>
              <p className="text-[10px] text-slate-400">
                {new Date(u.uploadedAt).toLocaleString()}
              </p>
              <Link
                href={`/documents?history=${u.documentId}`}
                className="mt-1 inline-block text-xs font-medium text-blue-700 hover:underline"
              >
                View version history →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
