import { sendMail } from "../src/lib/mail";

const to = process.argv[2]?.trim() ?? process.env.SMTP_TEST_TO?.trim();

if (!to) {
  console.error("Usage: npm run test:smtp -- your@email.com");
  process.exit(1);
}

if (!process.env.SMTP_HOST?.trim()) {
  console.error("SMTP_HOST is not set in .env");
  process.exit(1);
}

async function main() {
  await sendMail({
    to,
    subject: "PRHUB CDE — SMTP test",
    text: "If you receive this, Brevo SMTP is configured correctly.",
  });
  console.log("Sent OK to", to);
}

main().catch((err) => {
  console.error("SMTP FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
