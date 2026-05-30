"use client";

import { useEffect, useRef, useState } from "react";
import { UploadIcon } from "@/components/icons/upload-icon";
import { ACCEPT_ATTRIBUTE } from "@/lib/files";
import {
  fetchFolderDocuments,
  FolderDocumentOption,
  uploadDocumentFile,
} from "@/lib/upload-client";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog({
  folderId,
  folderLabel,
  onClose,
  onUploaded,
  initialParentDocumentId,
  lockRevisionMode = false,
}: {
  folderId: string;
  folderLabel: string;
  onClose: () => void;
  onUploaded: () => void;
  initialParentDocumentId?: string;
  lockRevisionMode?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploadMode, setUploadMode] = useState<"new" | "revision">(
    initialParentDocumentId || lockRevisionMode ? "revision" : "new",
  );
  const [parentDocumentId, setParentDocumentId] = useState(
    initialParentDocumentId ?? "",
  );
  const [versionInput, setVersionInput] = useState("");
  const [folderDocuments, setFolderDocuments] = useState<FolderDocumentOption[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFolderDocuments(folderId).then(setFolderDocuments);
  }, [folderId]);

  const selectedParent = folderDocuments.find((d) => d.id === parentDocumentId);
  const suggestedVersion = selectedParent
    ? selectedParent.currentVersion + 1
    : 1;

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }
    if (uploadMode === "revision" && !parentDocumentId) {
      setError("Select the base document (v1) for this revision");
      return;
    }

    const parsedVersion =
      versionInput.trim() === "" ? undefined : parseInt(versionInput, 10);
    if (parsedVersion != null && (!Number.isInteger(parsedVersion) || parsedVersion < 1)) {
      setError("Version must be a whole number of at least 1");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await uploadDocumentFile({
        folderId,
        file,
        description: description || undefined,
        parentDocumentId:
          uploadMode === "revision" ? parentDocumentId : undefined,
        versionNumber: parsedVersion,
      });

      window.dispatchEvent(new CustomEvent("cde-notifications-changed"));
      clearFile();
      onUploaded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {lockRevisionMode ? "Upload revision" : "Upload document"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">Folder: {folderLabel}</p>
        <p className="mt-1 text-xs text-amber-700">
          Files are stored for download only — no in-app preview.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!lockRevisionMode && (
            <div>
              <span className="block text-sm font-medium text-slate-700">
                Upload type
              </span>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === "new"}
                    onChange={() => {
                      setUploadMode("new");
                      setParentDocumentId("");
                      setVersionInput("");
                    }}
                  />
                  New document (v1)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === "revision"}
                    onChange={() => setUploadMode("revision")}
                  />
                  New revision
                </label>
              </div>
            </div>
          )}

          {uploadMode === "revision" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Base document (v1)
              </label>
              <select
                value={parentDocumentId}
                onChange={(e) => {
                  setParentDocumentId(e.target.value);
                  setVersionInput("");
                }}
                required
                disabled={lockRevisionMode && !!initialParentDocumentId}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Select document…</option>
                {folderDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} (current v{doc.currentVersion})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Revisions are grouped under the selected document. Older versions
                appear in version history.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Version number{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
              placeholder={
                uploadMode === "revision" && selectedParent
                  ? `Auto (v${suggestedVersion})`
                  : "Auto (v1)"
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave blank to use the next version automatically.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              required
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700"
              >
                <UploadIcon className="h-10 w-10" />
                <span className="text-sm font-medium">Choose a file to upload</span>
                <span className="text-xs text-slate-500">
                  PDF, Office, CAD, images, and more
                </span>
              </button>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  disabled={loading}
                  className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-white disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? (
                "Uploading…"
              ) : (
                <>
                  <UploadIcon className="h-4 w-4" />
                  {uploadMode === "revision" ? "Upload revision" : "Upload"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
