import { getPartyContactEmail, sendMail } from "@/lib/mail";
import { getPartyLabel } from "@/lib/party-labels";
import type { OverdueRfiRow } from "@/lib/rfi-overdue";

function formatRfiDetails(row: OverdueRfiRow): string[] {
  const lines = [
    `RFI ID: ${row.displayId}`,
    `Subject: ${row.subject}`,
    `Status: ${row.status}`,
    `Raised by: ${getPartyLabel(row.raiserPartyCode)} — ${row.raiserPartyName}`,
    `Assigned to: ${getPartyLabel(row.respondentPartyCode)} — ${row.respondentPartyName}`,
    `Raised on: ${row.raisedAt.toLocaleString()}`,
    `Due date: ${row.dueAt.toLocaleDateString()}`,
    `Days overdue: ${row.daysOverdue}`,
    ``,
    `Description:`,
    row.description,
  ];

  if (row.relatedDocumentName) {
    lines.push(
      ``,
      `Related document: ${row.relatedDocumentName}${
        row.relatedFolderCode ? ` (${row.relatedFolderCode})` : ""
      }`,
    );
  }

  return lines;
}

/** Party A (admin): full RFI details. Concerned parties: raiser + respondent. */
export async function sendRfiOverdueEmails(row: OverdueRfiRow): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const detailLines = formatRfiDetails(row);
  const openLink = `${appUrl}/rfi?open=${row.id}`;

  const adminEmail = await getPartyContactEmail("A");
  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: `[PRHUB CDE] OVERDUE RFI — admin alert: ${row.displayId}`,
      text: [
        `Hello VISL (PMC),`,
        ``,
        `The following RFI has not been completed within the required 7 calendar days.`,
        `This enquiry is overdue and requires your oversight.`,
        ``,
        ...detailLines,
        ``,
        `Open in PRHUB CDE: ${openLink}`,
      ].join("\n"),
    });
  }

  const concerned: { code: typeof row.raiserPartyCode; role: string }[] = [
    { code: row.raiserPartyCode, role: "raising party" },
    { code: row.respondentPartyCode, role: "assigned respondent" },
  ];

  const sent = new Set<string>();

  for (const { code, role } of concerned) {
    const email = await getPartyContactEmail(code);
    if (!email || sent.has(email)) continue;
    sent.add(email);

    const isRespondent = code === row.respondentPartyCode;

    await sendMail({
      to: email,
      subject: `[PRHUB CDE] Overdue RFI — action required: ${row.displayId}`,
      text: [
        `Hello,`,
        ``,
        `This is an automatic reminder that the following RFI enquiry has not been completed within 7 calendar days.`,
        ``,
        `Your role: ${role}`,
        `RFI ID: ${row.displayId}`,
        `Subject: ${row.subject}`,
        `Raised by: ${getPartyLabel(row.raiserPartyCode)}`,
        `Assigned to: ${getPartyLabel(row.respondentPartyCode)}`,
        `Due date: ${row.dueAt.toLocaleDateString()} (${row.daysOverdue} day(s) overdue)`,
        ``,
        isRespondent
          ? `As the assigned party, please provide a written resolution as soon as possible.`
          : `Your raised enquiry remains open. The assigned party has not yet resolved it.`,
        ``,
        `Description:`,
        row.description,
        ``,
        `View in PRHUB CDE: ${openLink}`,
      ].join("\n"),
    });
  }
}
