import { PartyCode, RfiStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import { getPartyLabel } from "@/lib/party-labels";
import { getDaysRemaining, isRfiOverdue } from "@/lib/rfi";
import { sendRfiOverdueEmails } from "@/lib/rfi-mail-overdue";
import { notifyRfiOverdue } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export type OverdueRfiRow = {
  id: string;
  displayId: string;
  subject: string;
  description: string;
  status: RfiStatus;
  raisedAt: Date;
  dueAt: Date;
  daysOverdue: number;
  raiserPartyCode: PartyCode;
  raiserPartyName: string;
  respondentPartyCode: PartyCode;
  respondentPartyName: string;
  relatedDocumentName: string | null;
  relatedFolderCode: string | null;
};

export async function findRfisNeedingOverdueNotice() {
  const candidates = await prisma.rfi.findMany({
    where: {
      status: { in: ["OPEN", "PENDING", "ESCALATED"] },
      overdueNotifiedAt: null,
    },
    include: {
      raisedByParty: true,
      respondentParty: true,
      relatedDocument: { include: { folder: true } },
    },
  });

  const now = new Date();
  return candidates.filter((rfi) => isRfiOverdue(rfi.dueAt, rfi.status, now));
}

function toOverdueRow(
  rfi: Awaited<ReturnType<typeof findRfisNeedingOverdueNotice>>[number],
): OverdueRfiRow {
  const daysRemaining = getDaysRemaining(rfi.dueAt);
  return {
    id: rfi.id,
    displayId: rfi.displayId,
    subject: rfi.subject,
    description: rfi.description,
    status: rfi.status,
    raisedAt: rfi.raisedAt,
    dueAt: rfi.dueAt,
    daysOverdue: Math.abs(Math.min(0, daysRemaining)),
    raiserPartyCode: rfi.raisedByParty.code,
    raiserPartyName: rfi.raisedByParty.name,
    respondentPartyCode: rfi.respondentParty.code,
    respondentPartyName: rfi.respondentParty.name,
    relatedDocumentName: rfi.relatedDocument?.name ?? null,
    relatedFolderCode: rfi.relatedDocument?.folder.code ?? null,
  };
}

/** Sends overdue emails to Party A (admin) and concerned parties; once per RFI. */
export async function processOverdueRfis(): Promise<{
  processed: number;
  displayIds: string[];
}> {
  const overdueList = await findRfisNeedingOverdueNotice();
  const displayIds: string[] = [];
  const now = new Date();

  for (const rfi of overdueList) {
    const row = toOverdueRow(rfi);

    await notifyRfiOverdue(row);
    await sendRfiOverdueEmails(row);
    await logActivity({
      type: "RFI_OVERDUE",
      summary: `${row.displayId} overdue — not resolved within 7 days (${getPartyLabel(row.respondentPartyCode)})`,
      actorPartyId: undefined,
      metadata: {
        rfiId: row.id,
        displayId: row.displayId,
        raiserPartyCode: row.raiserPartyCode,
        respondentPartyCode: row.respondentPartyCode,
        daysOverdue: row.daysOverdue,
      },
    });

    await prisma.rfi.update({
      where: { id: rfi.id },
      data: { overdueNotifiedAt: now },
    });

    displayIds.push(row.displayId);
  }

  return { processed: displayIds.length, displayIds };
}
