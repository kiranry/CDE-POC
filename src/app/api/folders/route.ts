import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await prisma.folder.findMany({
    orderBy: { sortOrder: "asc" },
    include: { party: true },
  });

  const roots = folders.filter((f) => !f.code.includes("."));
  const byParty = roots.map((root) => ({
    partyCode: root.partyCode,
    partyName: root.party.name,
    roleLabel: root.party.roleLabel,
    root: { id: root.id, code: root.code, name: root.name },
    subfolders: folders
      .filter((f) => f.code.startsWith(`${root.partyCode}.`))
      .map((f) => ({ id: f.id, code: f.code, name: f.name })),
  }));

  return NextResponse.json({ parties: byParty });
}
