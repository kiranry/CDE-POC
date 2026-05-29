import { NotificationType, PartyCode, Prisma } from "@prisma/client";
import {
  sendRfiEscalatedEmails,
  sendRfiRaisedEmails,
  sendRfiResolvedEmails,
} from "@/lib/rfi-mail";
import type { OverdueRfiRow } from "@/lib/rfi-overdue";
import { prisma } from "@/lib/prisma";

const ALL_PARTIES: PartyCode[] = ["A", "B", "C", "D"];

export type DocumentUploadNotificationInput = {
  uploaderPartyCode: PartyCode;
  uploaderPartyName: string;
  uploaderUserName: string;
  documentName: string;
  folderCode: string;
  folderName: string;
  documentId: string;
  version: number;
  uploadedAt: Date;
};

function buildUploadPayload(input: DocumentUploadNotificationInput) {
  return {
    uploaderPartyCode: input.uploaderPartyCode,
    uploaderPartyName: input.uploaderPartyName,
    uploaderUserName: input.uploaderUserName,
    documentName: input.documentName,
    folderCode: input.folderCode,
    folderName: input.folderName,
    documentId: input.documentId,
    version: input.version,
    uploadedAt: input.uploadedAt.toISOString(),
  };
}

/** FR-007: notify all parties except uploader. FR-012: Party A always included (deduped). */
export function getUploadRecipientCodes(uploaderCode: PartyCode): PartyCode[] {
  const recipients = new Set<PartyCode>(
    ALL_PARTIES.filter((code) => code !== uploaderCode),
  );
  recipients.add("A");
  return [...recipients];
}

export async function notifyDocumentUpload(
  input: DocumentUploadNotificationInput,
): Promise<void> {
  const type: NotificationType =
    input.version === 1 ? "DOCUMENT_UPLOAD" : "DOCUMENT_VERSION";

  const recipientCodes = getUploadRecipientCodes(input.uploaderPartyCode);
  const parties = await prisma.party.findMany({
    where: { code: { in: recipientCodes } },
  });

  const versionLabel =
    input.version > 1 ? ` (version ${input.version})` : "";
  const title =
    input.version === 1
      ? `New document uploaded`
      : `Document updated (v${input.version})`;
  const message = `Party ${input.uploaderPartyCode} uploaded "${input.documentName}"${versionLabel} to ${input.folderCode} — ${input.folderName}`;

  const payload = buildUploadPayload(input);

  await prisma.notification.createMany({
    data: parties.map((party) => ({
      type,
      recipientPartyId: party.id,
      title,
      message,
      payload: payload as Prisma.InputJsonValue,
    })),
  });
}

async function getPartyIdForCode(
  activePartyCode: PartyCode,
): Promise<string | null> {
  const party = await prisma.party.findUnique({
    where: { code: activePartyCode },
    select: { id: true },
  });
  return party?.id ?? null;
}

/** Each party only sees notifications addressed to them (active party context). */
export async function getNotificationsForViewer(activePartyCode: PartyCode) {
  const partyId = await getPartyIdForCode(activePartyCode);
  if (!partyId) return [];

  return prisma.notification.findMany({
    where: { recipientPartyId: partyId },
    orderBy: { createdAt: "desc" },
    include: { recipientParty: true },
  });
}

export async function getUnreadCountForViewer(
  activePartyCode: PartyCode,
): Promise<number> {
  const partyId = await getPartyIdForCode(activePartyCode);
  if (!partyId) return 0;

  return prisma.notification.count({
    where: { recipientPartyId: partyId, readAt: null },
  });
}

async function getPartiesByCodes(codes: PartyCode[]) {
  return prisma.party.findMany({
    where: { code: { in: codes } },
  });
}

/** Include VISL (Party A) on all RFI notifications for PMC oversight. */
function getRfiRecipientCodes(
  ...codes: PartyCode[]
): PartyCode[] {
  return [...new Set<PartyCode>([...codes, "A"])];
}

export type RfiRaisedNotificationInput = {
  displayId: string;
  subject: string;
  description: string;
  raiserPartyCode: PartyCode;
  raiserPartyName: string;
  respondentPartyCode: PartyCode;
  dueAt: Date;
};

/** RFI raised: raiser, respondent, and VISL (Party A) for PMC oversight. */
export async function notifyRfiRaised(
  input: RfiRaisedNotificationInput,
): Promise<void> {
  const parties = await getPartiesByCodes(
    getRfiRecipientCodes(
      input.raiserPartyCode,
      input.respondentPartyCode,
    ),
  );
  const dueLabel = input.dueAt.toLocaleDateString();
  const payload = {
    displayId: input.displayId,
    subject: input.subject,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
    dueAt: input.dueAt.toISOString(),
  } satisfies Prisma.InputJsonObject;

  const notifications: {
    type: NotificationType;
    recipientPartyId: string;
    title: string;
    message: string;
    payload: Prisma.InputJsonValue;
  }[] = [];

  for (const party of parties) {
    if (party.code === input.raiserPartyCode) {
      notifications.push({
        type: "RFI_CONFIRMATION",
        recipientPartyId: party.id,
        title: `RFI submitted: ${input.displayId}`,
        message: `Your RFI "${input.subject}" was raised against Party ${input.respondentPartyCode}. Due ${dueLabel}.`,
        payload,
      });
    } else if (party.code === input.respondentPartyCode) {
      notifications.push({
        type: "RFI_RAISED",
        recipientPartyId: party.id,
        title: `New RFI: ${input.displayId}`,
        message: `Party ${input.raiserPartyCode} raised "${input.subject}". You must resolve within 7 calendar days (due ${dueLabel}).`,
        payload,
      });
    } else if (party.code === "A") {
      notifications.push({
        type: "RFI_RAISED",
        recipientPartyId: party.id,
        title: `RFI raised (PMC): ${input.displayId}`,
        message: `Party ${input.raiserPartyCode} raised "${input.subject}" against Party ${input.respondentPartyCode}. Due ${dueLabel}.`,
        payload,
      });
    }
  }

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  await sendRfiRaisedEmails({
    displayId: input.displayId,
    subject: input.subject,
    description: input.description,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
    dueAt: input.dueAt,
  });
}

export async function notifyRfiResolved(input: {
  displayId: string;
  subject: string;
  raiserPartyCode: PartyCode;
  respondentPartyCode: PartyCode;
  resolutionText: string;
}): Promise<void> {
  const parties = await getPartiesByCodes(
    getRfiRecipientCodes(
      input.raiserPartyCode,
      input.respondentPartyCode,
    ),
  );
  const payload = {
    displayId: input.displayId,
    subject: input.subject,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
  } satisfies Prisma.InputJsonObject;

  const notifications = parties.map((party) => {
    if (party.code === "A") {
      return {
        type: "RFI_RESOLVED" as NotificationType,
        recipientPartyId: party.id,
        title: `RFI resolved (PMC): ${input.displayId}`,
        message: `RFI "${input.subject}" between Party ${input.raiserPartyCode} and Party ${input.respondentPartyCode} has been resolved.`,
        payload,
      };
    }
    const isRaiser = party.code === input.raiserPartyCode;
    return {
      type: "RFI_RESOLVED" as NotificationType,
      recipientPartyId: party.id,
      title: `RFI resolved: ${input.displayId}`,
      message: isRaiser
        ? `Your RFI "${input.subject}" has been resolved by Party ${input.respondentPartyCode}.`
        : `You resolved RFI "${input.subject}" raised by Party ${input.raiserPartyCode}.`,
      payload,
    };
  });

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  await sendRfiResolvedEmails({
    displayId: input.displayId,
    subject: input.subject,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
    resolutionText: input.resolutionText,
  });
}

export async function notifyRfiEscalated(input: {
  displayId: string;
  subject: string;
  raiserPartyCode: PartyCode;
  respondentPartyCode: PartyCode;
}): Promise<void> {
  const parties = await getPartiesByCodes(
    getRfiRecipientCodes(
      input.raiserPartyCode,
      input.respondentPartyCode,
    ),
  );
  const payload = {
    displayId: input.displayId,
    subject: input.subject,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
  } satisfies Prisma.InputJsonObject;

  const notifications = parties.map((party) => {
    if (party.code === "A") {
      return {
        type: "RFI_ESCALATED" as NotificationType,
        recipientPartyId: party.id,
        title: `RFI escalated (PMC): ${input.displayId}`,
        message: `Overdue RFI "${input.subject}" (Party ${input.raiserPartyCode} → Party ${input.respondentPartyCode}) was escalated.`,
        payload,
      };
    }
    const isRespondent = party.code === input.respondentPartyCode;
    return {
      type: "RFI_ESCALATED" as NotificationType,
      recipientPartyId: party.id,
      title: `RFI escalated: ${input.displayId}`,
      message: isRespondent
        ? `PMC escalated overdue RFI "${input.subject}". Immediate action required.`
        : `Your RFI "${input.subject}" was escalated by PMC (assigned to Party ${input.respondentPartyCode}).`,
      payload,
    };
  });

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  await sendRfiEscalatedEmails({
    displayId: input.displayId,
    subject: input.subject,
    raiserPartyCode: input.raiserPartyCode,
    respondentPartyCode: input.respondentPartyCode,
  });
}

/** Overdue alert: Party A (admin) + raiser + respondent only. */
export async function notifyRfiOverdue(row: OverdueRfiRow): Promise<void> {
  const parties = await getPartiesByCodes(
    getRfiRecipientCodes(row.raiserPartyCode, row.respondentPartyCode),
  );

  const payload = {
    rfiId: row.id,
    displayId: row.displayId,
    subject: row.subject,
    raiserPartyCode: row.raiserPartyCode,
    respondentPartyCode: row.respondentPartyCode,
    daysOverdue: row.daysOverdue,
    dueAt: row.dueAt.toISOString(),
  } satisfies Prisma.InputJsonObject;

  const notifications = parties.map((party) => {
    if (party.code === "A") {
      return {
        type: "RFI_OVERDUE" as NotificationType,
        recipientPartyId: party.id,
        title: `Overdue RFI (admin): ${row.displayId}`,
        message: `RFI "${row.subject}" is ${row.daysOverdue} day(s) overdue. Raised by Party ${row.raiserPartyCode}, assigned to Party ${row.respondentPartyCode}. Status: ${row.status}.`,
        payload,
      };
    }
    if (party.code === row.raiserPartyCode) {
      return {
        type: "RFI_OVERDUE" as NotificationType,
        recipientPartyId: party.id,
        title: `Your RFI is overdue: ${row.displayId}`,
        message: `"${row.subject}" has not been completed within 7 days. Assigned to Party ${row.respondentPartyCode}.`,
        payload,
      };
    }
    return {
      type: "RFI_OVERDUE" as NotificationType,
      recipientPartyId: party.id,
      title: `Overdue RFI assigned to you: ${row.displayId}`,
      message: `"${row.subject}" from Party ${row.raiserPartyCode} is ${row.daysOverdue} day(s) overdue. Please resolve urgently.`,
      payload,
    };
  });

  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }
}

export async function clearAllNotificationsForViewer(
  activePartyCode: PartyCode,
): Promise<void> {
  const partyId = await getPartyIdForCode(activePartyCode);
  if (!partyId) return;

  await prisma.notification.deleteMany({
    where: { recipientPartyId: partyId },
  });
}
