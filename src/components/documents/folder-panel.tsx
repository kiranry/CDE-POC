"use client";

import { PartyCode } from "@prisma/client";
import { useState } from "react";

export type FolderParty = {
  partyCode: PartyCode;
  partyName: string;
  roleLabel: string;
  root: { id: string; code: string; name: string };
  subfolders: { id: string; code: string; name: string }[];
};

export function FolderPanel({
  parties,
  selectedFolderId,
  activePartyCode,
  onSelectFolder,
}: {
  parties: FolderParty[];
  selectedFolderId: string | null;
  activePartyCode: PartyCode | null;
  onSelectFolder: (folderId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<PartyCode>>(() =>
    activePartyCode ? new Set([activePartyCode]) : new Set(),
  );

  function toggleParty(partyCode: PartyCode) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(partyCode)) {
        next.delete(partyCode);
      } else {
        next.add(partyCode);
      }
      return next;
    });
  }

  return (
    <aside className="w-full shrink-0 rounded-lg border border-slate-200 bg-white p-4 lg:w-72">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">Folders</h2>
      <button
        type="button"
        onClick={() => onSelectFolder(null)}
        className={`mb-3 w-full rounded-md px-3 py-2 text-left text-sm ${
          selectedFolderId === null
            ? "bg-blue-50 font-medium text-blue-800"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        All folders
      </button>
      <div className="max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto">
        {parties.map((party) => {
          const isExpanded = expanded.has(party.partyCode);
          const isOwnParty = party.partyCode === activePartyCode;

          return (
            <div
              key={party.partyCode}
              className="overflow-hidden rounded-md border border-slate-200"
            >
              <button
                type="button"
                onClick={() => toggleParty(party.partyCode)}
                className="flex w-full items-center gap-2 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
                aria-expanded={isExpanded}
              >
                <span
                  className={`text-xs text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  aria-hidden
                >
                  ▶
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                    {party.partyName}
                    {isOwnParty && (
                      <span className="ml-1.5 font-normal normal-case text-blue-700">
                        (your folders)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {party.roleLabel}
                  </p>
                </div>
              </button>
              {isExpanded && (
                <ul className="space-y-0.5 border-t border-slate-200 bg-white p-2">
                  {party.subfolders.map((folder) => (
                    <li key={folder.id}>
                      <button
                        type="button"
                        onClick={() => onSelectFolder(folder.id)}
                        className={`w-full rounded px-2 py-1.5 text-left text-xs leading-snug ${
                          selectedFolderId === folder.id
                            ? "bg-blue-700 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-80">
                          {folder.code}
                        </span>
                        <br />
                        {folder.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
