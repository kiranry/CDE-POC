/**
 * Optional in-process scheduler for overdue RFI emails (local / single-node deploy).
 * Set ENABLE_RFI_OVERDUE_CRON=true in .env
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_RFI_OVERDUE_CRON !== "true") return;

  const { processOverdueRfis } = await import("./src/lib/rfi-overdue");

  const run = async () => {
    try {
      const result = await processOverdueRfis();
      if (result.processed > 0) {
        console.info(
          `[rfi-overdue-cron] Notified for: ${result.displayIds.join(", ")}`,
        );
      }
    } catch (err) {
      console.error("[rfi-overdue-cron]", err);
    }
  };

  const oneHourMs = 60 * 60 * 1000;

  // First run 30s after server start, then every hour
  setTimeout(run, 30_000);
  setInterval(run, oneHourMs);

  console.info("[rfi-overdue-cron] Scheduled hourly overdue RFI checks");
}
