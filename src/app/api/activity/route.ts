import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecentActivity } from "@/lib/activity-feed";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit") ?? "30")),
  );

  const activities = await getRecentActivity(limit);
  return NextResponse.json({ activities });
}
