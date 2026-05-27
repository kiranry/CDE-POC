"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FolderPanel, FolderParty } from "@/components/documents/folder-panel";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { VersionHistoryDialog } from "@/components/documents/version-history-dialog";
import { formatBytes } from "@/lib/files";

type DocumentRow = {
  id: string;
  name: string;
  folderId: string;
  folderCode: string;
  folderName: string;
  currentVersion: number;
  uploadedByParty: string;
  uploadedByPartyName: string;
  uploadedByUser: string;
  uploadedAt: string;
  sizeBytes: number;
};

export function DocumentsPageClient() {
  const searchParams = useSearchParams();
  const historyFromUrl = searchParams.get("history");

  const [parties, setParties] = useState<FolderParty[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadTarget, setUploadTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [historyDoc, setHistoryDoc] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const loadFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    const data = await res.json();
    setParties(data.parties ?? []);
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const qs = selectedFolderId ? `?folderId=${selectedFolderId}` : "";
    const res = await fetch(`/api/documents${qs}`);
    const data = await res.json();
    setDocuments(data.documents ?? []);
    setLoading(false);
  }, [selectedFolderId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const onPartyChange = () => loadDocuments();
    window.addEventListener("cde-party-changed", onPartyChange);
    return () => window.removeEventListener("cde-party-changed", onPartyChange);
  }, [loadDocuments]);

  async function deleteDocument(doc: DocumentRow) {
    if (
      !window.confirm(
        `Delete "${doc.name}" and all ${doc.currentVersion} version(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Delete failed");
      return;
    }
    loadDocuments();
  }

  useEffect(() => {
    if (!historyFromUrl) return;
    const doc = documents.find((d) => d.id === historyFromUrl);
    if (doc) {
      setHistoryDoc({ id: doc.id, name: doc.name });
      return;
    }
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        const found = (data.documents ?? []).find(
          (d: { id: string }) => d.id === historyFromUrl,
        );
        if (found) {
          setHistoryDoc({ id: found.id, name: found.name });
        }
      });
  }, [historyFromUrl, documents]);

  const selectedFolder = parties
    .flatMap((p) => p.subfolders)
    .find((f) => f.id === selectedFolderId);

  const folderLabel = selectedFolder
    ? `${selectedFolder.code} — ${selectedFolder.name}`
    : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">
            Upload, download, version history, and delete — metadata register with
            uploader.
          </p>
        </div>
        <button
          type="button"
          disabled={!selectedFolderId}
          onClick={() =>
            selectedFolderId &&
            folderLabel &&
            setUploadTarget({ id: selectedFolderId, label: folderLabel })
          }
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload to folder
        </button>
      </div>

      {!selectedFolderId && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Select a subfolder on the left to filter documents and enable upload.
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <FolderPanel
          parties={parties}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
        />

        <section className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-800">
              {selectedFolder
                ? `${selectedFolder.code} — ${selectedFolder.name}`
                : "All documents"}
            </h2>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No documents in this view. Upload a file to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-600">
                    <th className="px-4 py-3">File name</th>
                    <th className="px-4 py-3">Folder</th>
                    <th className="px-4 py-3">Uploaded by</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Ver</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium">{doc.name}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-mono">{doc.folderCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">
                          Party {doc.uploadedByParty}
                        </span>
                        <br />
                        <span className="text-xs text-slate-500">
                          {doc.uploadedByUser}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {doc.uploadedAt
                          ? new Date(doc.uploadedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono">v{doc.currentVersion}</td>
                      <td className="px-4 py-3">
                        {formatBytes(doc.sizeBytes)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-900"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryDoc({ id: doc.id, name: doc.name })
                            }
                            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {uploadTarget && (
        <UploadDialog
          folderId={uploadTarget.id}
          folderLabel={uploadTarget.label}
          onClose={() => setUploadTarget(null)}
          onUploaded={loadDocuments}
        />
      )}

      {historyDoc && (
        <VersionHistoryDialog
          documentId={historyDoc.id}
          documentName={historyDoc.name}
          onClose={() => setHistoryDoc(null)}
          onChanged={loadDocuments}
        />
      )}
    </div>
  );
}
