"use client";

import { PartyCode } from "@prisma/client";

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
  onSelectFolder,
}: {
  parties: FolderParty[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
}) {
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
      <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto">
        {parties.map((party) => (
          <div key={party.partyCode}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              Party {party.partyCode}
            </p>
            <p className="mb-2 text-xs text-slate-400">{party.roleLabel}</p>
            <ul className="space-y-0.5">
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
          </div>
        ))}
      </div>
    </aside>
  );
}
