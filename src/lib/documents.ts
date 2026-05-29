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
