import { auth } from "@/lib/auth";
import { getRecentActivity, getRecentUploads } from "@/lib/activity-feed";
import {
  ActivityFeed,
  RecentUploadsList,
} from "@/components/dashboard/activity-feed";
import { EscalationBanner } from "@/components/dashboard/escalation-banner";
import { PARTY_LABELS } from "@/lib/party-labels";
import { getActivePartyCode } from "@/lib/party-context";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const activePartyCode = session?.user?.partyCode
    ? await getActivePartyCode(session.user.partyCode)
    : null;

  const [fileCount, openRfiCount, resolvedRfiCount, recentUploads, activities, escalatedRfis] =
    await Promise.all([
      prisma.document.count(),
      prisma.rfi.count({
        where: { status: { in: ["OPEN", "PENDING", "ESCALATED"] } },
      }),
      prisma.rfi.count({ where: { status: "RESOLVED" } }),
      getRecentUploads(10),
      getRecentActivity(30),
      activePartyCode === "A"
        ? prisma.rfi.findMany({
            where: { status: "ESCALATED" },
            orderBy: { updatedAt: "desc" },
            include: { respondentParty: true },
          })
        : Promise.resolve([]),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Welcome, {session?.user?.name}
        {activePartyCode ? ` — ${PARTY_LABELS[activePartyCode]}` : ""}
      </p>

      {activePartyCode === "A" && escalatedRfis.length > 0 && (
        <div className="mt-6">
          <EscalationBanner
            rfis={escalatedRfis.map((r) => ({
              id: r.id,
              displayId: r.displayId,
              subject: r.subject,
              against: r.respondentParty.code,
            }))}
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total files" value={String(fileCount)} />
        <StatCard label="Open RFIs" value={String(openRfiCount)} />
        <StatCard label="Resolved RFIs" value={String(resolvedRfiCount)} />
        <StatCard label="Stakeholders" value="4" href="/stakeholders" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <RecentUploadsList uploads={recentUploads} />
        <ActivityFeed initialActivities={activities} />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/documents" className="text-blue-700 hover:underline">
          Documents →
        </Link>
        <Link href="/rfi" className="text-blue-700 hover:underline">
          RFI Register →
        </Link>
        <Link href="/stakeholders" className="text-blue-700 hover:underline">
          Stakeholders →
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {inner}
    </div>
  );
}
