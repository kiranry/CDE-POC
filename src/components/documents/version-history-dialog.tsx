"use client";

import { useCallback, useEffect, useState } from "react";

type Version = {
  id: string;
  version: number;
  uploadedByParty: string;
  uploadedByPartyName: string;
  uploadedByUser: string;
  uploadedAt: string;
  sizeLabel: string;
  description: string | null;
  canDelete: boolean;
};

export function VersionHistoryDialog({
  documentId,
  documentName,
  onClose,
  onChanged,
}: {
  documentId: string;
  documentName: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [folderLabel, setFolderLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${documentId}/versions`);
    const data = await res.json();
    setVersions(data.versions ?? []);
    setFolderLabel(
      `${data.document?.folderCode} — ${data.document?.folderName}`,
    );
    setLoading(false);
    return data;
  }, [documentId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function deleteVersion(v: Version) {
    if (
      !window.confirm(
        `Delete v${v.version} of "${documentName}"?${versions.length === 1 ? " This removes the entire document." : ""}`,
      )
    ) {
      return;
    }
    setDeleting(v.version);
    try {
      const res = await fetch(
        `/api/documents/${documentId}?version=${v.version}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Delete failed");
        return;
      }
      onChanged?.();
      if (data.documentRemoved) {
        onClose();
        return;
      }
      await loadVersions();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold">Version history</h2>
          <p className="text-sm text-slate-600">{documentName}</p>
          <p className="text-xs text-slate-400">{folderLabel}</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-slate-500">No versions found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Ver</th>
                  <th className="pb-2 pr-4">Uploaded by</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Size</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-mono">v{v.version}</td>
                    <td className="py-3 pr-4">
                      <span className="font-medium">Party {v.uploadedByParty}</span>
                      <br />
                      <span className="text-xs text-slate-500">
                        {v.uploadedByUser}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {new Date(v.uploadedAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">{v.sizeLabel}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/documents/${documentId}/download?version=${v.version}`}
                          className="rounded bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-900"
                        >
                          Download
                        </a>
                        {v.canDelete && (
                          <button
                            type="button"
                            disabled={deleting === v.version}
                            onClick={() => deleteVersion(v)}
                            className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {deleting === v.version ? "…" : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t border-slate-200 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
