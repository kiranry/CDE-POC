import { NextResponse } from "next/server";
import { processOverdueRfis } from "@/lib/rfi-overdue";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Local dev: allow without secret when not configured
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Run overdue RFI check (call hourly via cron or `npm run cron:rfi-overdue`). */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processOverdueRfis();
  return NextResponse.json({
    ok: true,
    processed: result.processed,
    displayIds: result.displayIds,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
