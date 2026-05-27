/**
 * Run overdue RFI email + notification job once.
 * Usage: npm run cron:rfi-overdue
 */
import { processOverdueRfis } from "../src/lib/rfi-overdue";

async function main() {
  const result = await processOverdueRfis();
  console.log(
    `Overdue RFI check complete: ${result.processed} processed`,
    result.displayIds.length > 0 ? result.displayIds : "",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
