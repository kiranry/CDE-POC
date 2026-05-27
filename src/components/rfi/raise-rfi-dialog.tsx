"use client";

import { PartyCode } from "@prisma/client";
import { useEffect, useState } from "react";
import { PARTY_LABELS } from "@/lib/party-labels";

type DocumentOption = { id: string; name: string; folderCode: string };

const PARTY_CODES: PartyCode[] = ["A", "B", "C", "D"];

export function RaiseRfiDialog({
  viewerParty,
  onClose,
  onCreated,
}: {
  viewerParty: PartyCode;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [respondent, setRespondent] = useState<PartyCode | "">("");
  const [relatedDocumentId, setRelatedDocumentId] = useState("");
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        setDocuments(
          (data.documents ?? []).map(
            (d: {
              id: string;
              name: string;
              folderCode: string;
            }) => ({
              id: d.id,
              name: d.name,
              folderCode: d.folderCode,
            }),
          ),
        );
      });
  }, []);

  const respondentOptions = PARTY_CODES.filter((c) => c !== viewerParty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!respondent) {
      setError("Select a respondent party");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rfi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          description,
          respondentPartyCode: respondent,
          relatedDocumentId: relatedDocumentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to raise RFI");
        return;
      }
      window.dispatchEvent(new CustomEvent("cde-notifications-changed"));
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">Raise RFI</h2>
          <p className="mt-1 text-sm text-slate-500">
            Due date is automatically set to 7 calendar days from today.
          </p>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Subject
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Description
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Respondent party
            <select
              required
              value={respondent}
              onChange={(e) => setRespondent(e.target.value as PartyCode)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select party…</option>
              {respondentOptions.map((code) => (
                <option key={code} value={code}>
                  {PARTY_LABELS[code]}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Related document (optional)
            <select
              value={relatedDocumentId}
              onChange={(e) => setRelatedDocumentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.folderCode})
                </option>
              ))}
            </select>
          </label>

          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit RFI"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
