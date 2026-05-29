import { PartyCode } from "@prisma/client";
import { sendMailToParties } from "@/lib/mail";
import { getPartyLabel } from "@/lib/party-labels";

export async function sendRfiRaisedEmails(input: {
  displayId: string;
  subject: string;
  description: string;
  raiserPartyCode: PartyCode;
  respondentPartyCode: PartyCode;
  dueAt: Date;
}): Promise<void> {
  const dueLabel = input.dueAt.toLocaleDateString();
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  await sendMailToParties(
    [input.raiserPartyCode, input.respondentPartyCode],
    (partyCode, email) => {
      const isRaiser = partyCode === input.raiserPartyCode;
      const subject = isRaiser
        ? `[PRHUB CDE] RFI confirmation: ${input.displayId}`
        : `[PRHUB CDE] New RFI assigned: ${input.displayId}`;

      const text = isRaiser
        ? [
            `Hello,`,
            ``,
            `Your RFI has been submitted successfully.`,
            ``,
            `RFI ID: ${input.displayId}`,
            `Subject: ${input.subject}`,
            `Raised by: ${getPartyLabel(input.raiserPartyCode)}`,
            `Assigned to: ${getPartyLabel(input.respondentPartyCode)}`,
            `Due date: ${dueLabel}`,
            ``,
            `Description:`,
            input.description,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n")
        : [
            `Hello,`,
            ``,
            `A new RFI has been assigned to your party.`,
            ``,
            `RFI ID: ${input.displayId}`,
            `Subject: ${input.subject}`,
            `Raised by: ${getPartyLabel(input.raiserPartyCode)}`,
            `Assigned to: ${getPartyLabel(input.respondentPartyCode)} (${email})`,
            `Due date: ${dueLabel}`,
            ``,
            `You must provide a written resolution within 7 calendar days.`,
            ``,
            `Description:`,
            input.description,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n");

      return { to: email, subject, text };
    },
  );
}

export async function sendRfiResolvedEmails(input: {
  displayId: string;
  subject: string;
  raiserPartyCode: PartyCode;
  respondentPartyCode: PartyCode;
  resolutionText: string;
}): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  await sendMailToParties(
    [input.raiserPartyCode, input.respondentPartyCode],
    (partyCode, email) => {
      const isRaiser = partyCode === input.raiserPartyCode;
      const subject = `[PRHUB CDE] RFI resolved: ${input.displayId}`;
      const text = isRaiser
        ? [
            `Hello,`,
            ``,
            `Your RFI has been resolved.`,
            ``,
            `RFI ID: ${input.displayId}`,
            `Subject: ${input.subject}`,
            `Resolved by: ${getPartyLabel(input.respondentPartyCode)}`,
            ``,
            `Resolution:`,
            input.resolutionText,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n")
        : [
            `Hello,`,
            ``,
            `You resolved RFI ${input.displayId}.`,
            ``,
            `Subject: ${input.subject}`,
            `Raised by: ${getPartyLabel(input.raiserPartyCode)}`,
            ``,
            `Resolution:`,
            input.resolutionText,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n");

      return { to: email, subject, text };
    },
  );
}

export async function sendRfiEscalatedEmails(input: {
  displayId: string;
  subject: string;
  raiserPartyCode: PartyCode;
  respondentPartyCode: PartyCode;
}): Promise<void> {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  await sendMailToParties(
    [input.raiserPartyCode, input.respondentPartyCode],
    (partyCode, email) => {
      const isRespondent = partyCode === input.respondentPartyCode;
      const subject = `[PRHUB CDE] RFI escalated: ${input.displayId}`;
      const text = isRespondent
        ? [
            `Hello,`,
            ``,
            `PMC has escalated an overdue RFI assigned to your party.`,
            ``,
            `RFI ID: ${input.displayId}`,
            `Subject: ${input.subject}`,
            `Raised by: ${getPartyLabel(input.raiserPartyCode)}`,
            ``,
            `Immediate action is required.`,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n")
        : [
            `Hello,`,
            ``,
            `Your RFI has been escalated by PMC due to being overdue.`,
            ``,
            `RFI ID: ${input.displayId}`,
            `Subject: ${input.subject}`,
            `Assigned to: ${getPartyLabel(input.respondentPartyCode)}`,
            ``,
            `View in PRHUB CDE: ${appUrl}/rfi`,
          ].join("\n");

      return { to: email, subject, text };
    },
  );
}
