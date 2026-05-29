import { prisma } from "@/lib/prisma";

export default async function StakeholdersPage() {
  const parties = await prisma.party.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          uploads: true,
          rfisRaised: true,
          rfisRespondent: true,
        },
      },
    },
  });

  const resolvedAsRespondent = await prisma.rfi.groupBy({
    by: ["respondentPartyId"],
    where: { status: "RESOLVED" },
    _count: { id: true },
  });

  const resolvedMap = new Map(
    resolvedAsRespondent.map((r) => [r.respondentPartyId, r._count.id]),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Stakeholders</h1>
      <p className="mt-1 text-sm text-slate-500">
        Per-party contribution: files uploaded, RFIs raised, and RFIs resolved as
        respondent.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {parties.map((party) => {
          const filesUploaded = party._count.uploads;
          const rfisRaised = party._count.rfisRaised;
          const rfisResolved = resolvedMap.get(party.id) ?? 0;

          return (
            <div
              key={party.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="mt-1 font-semibold text-slate-900">{party.name}</h2>
              <p className="text-sm text-slate-500">{party.roleLabel}</p>
              {party.contactEmail && (
                <p className="mt-1 text-xs text-slate-400">{party.contactEmail}</p>
              )}

              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <dt className="text-xs text-slate-500">Files uploaded</dt>
                  <dd className="mt-0.5 text-2xl font-bold text-slate-900">
                    {filesUploaded}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">RFIs raised</dt>
                  <dd className="mt-0.5 text-2xl font-bold text-slate-900">
                    {rfisRaised}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">RFIs resolved</dt>
                  <dd className="mt-0.5 text-2xl font-bold text-green-700">
                    {rfisResolved}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
