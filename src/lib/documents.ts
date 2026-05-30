import { PartyCode } from "@prisma/client";

export function canUploadToFolder(
  folderPartyCode: PartyCode,
  activePartyCode: PartyCode,
): boolean {
  return folderPartyCode === activePartyCode;
}

export function canDeleteVersion(
  uploadedByPartyCode: PartyCode,
  activePartyCode: PartyCode,
): boolean {
  return uploadedByPartyCode === activePartyCode;
}

export function canDeleteDocument(
  versionPartyCodes: PartyCode[],
  activePartyCode: PartyCode,
): boolean {
  return (
    versionPartyCodes.length > 0 &&
    versionPartyCodes.every((code) => code === activePartyCode)
  );
}

export function fileNameFromStorageKey(storageKey: string): string {
  const parts = storageKey.split("/");
  return parts[parts.length - 1] ?? storageKey;
}

export function displayFileName(
  documentName: string,
  storageKey: string | undefined,
): string {
  if (!storageKey) return documentName;
  return fileNameFromStorageKey(storageKey);
}
