import nodemailer from "nodemailer";
import { PartyCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT ?? "587");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

export async function sendMail(payload: MailPayload): Promise<void> {
  const from =
    process.env.MAIL_FROM?.trim() ??
    process.env.SMTP_USER?.trim() ??
    "prhub-cde@localhost";

  if (!isSmtpConfigured()) {
    console.info("[mail:dev] SMTP not configured — email logged only");
    console.info(`  To: ${payload.to}`);
    console.info(`  Subject: ${payload.subject}`);
    console.info(`  Body:\n${payload.text}`);
    return;
  }

  const transport = createTransport();
  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? payload.text.replace(/\n/g, "<br>"),
  });
}

/** Party contact email (falls back to the party user's login email). */
export async function getPartyContactEmail(
  partyCode: PartyCode,
): Promise<string | null> {
  const party = await prisma.party.findUnique({
    where: { code: partyCode },
    include: { users: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (!party) return null;
  return party.contactEmail || party.users[0]?.email || null;
}

export async function getPartyContactEmails(
  partyCodes: PartyCode[],
): Promise<Map<PartyCode, string>> {
  const parties = await prisma.party.findMany({
    where: { code: { in: partyCodes } },
    include: { users: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  const map = new Map<PartyCode, string>();
  for (const party of parties) {
    const email = party.contactEmail || party.users[0]?.email;
    if (email) map.set(party.code, email);
  }
  return map;
}

export async function sendMailToParties(
  partyCodes: PartyCode[],
  buildMessage: (partyCode: PartyCode, email: string) => MailPayload,
): Promise<void> {
  const emails = await getPartyContactEmails(partyCodes);
  const sent = new Set<string>();

  for (const [code, email] of emails) {
    if (sent.has(email)) continue;
    sent.add(email);
    const message = buildMessage(code, email);
    await sendMail({ ...message, to: email });
  }
}
