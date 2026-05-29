"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons/upload-icon";
import { ACCEPT_ATTRIBUTE } from "@/lib/files";

export function UploadDialog({
  folderId,
  folderLabel,
  onClose,
  onUploaded,
}: {
  folderId: string;
  folderLabel: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", folderId);
      if (description) form.append("description", description);

      const res = await fetch("/api/documents", { method: "POST", body: form });
      const text = await res.text();
      let data: { error?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text) as { error?: string };
        } catch {
          throw new Error(
            res.ok
              ? "Invalid server response"
              : `Upload failed (${res.status})`,
          );
        }
      } else if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
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
        <h2 className="text-lg font-semibold text-slate-900">Upload document</h2>
        <p className="mt-1 text-sm text-slate-500">Folder: {folderLabel}</p>
        <p className="mt-1 text-xs text-amber-700">
          Files are stored for download only — no in-app preview.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
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
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
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
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
