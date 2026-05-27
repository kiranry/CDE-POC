import { PartyCode, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PARTIES: {
  code: PartyCode;
  name: string;
  roleLabel: string;
  email: string;
  userName: string;
}[] = [
  {
    code: "A",
    name: "Party A — Project Management Consultant (PMC)",
    roleLabel: "CDE Administrator & Oversight",
    email: "party-a@prhub.local",
    userName: "PMC User",
  },
  {
    code: "B",
    name: "Party B — Design Consultant",
    roleLabel: "Design Document Owner",
    email: "party-b@prhub.local",
    userName: "Design User",
  },
  {
    code: "C",
    name: "Party C — Main Contractor",
    roleLabel: "Construction Document Owner",
    email: "party-c@prhub.local",
    userName: "Contractor User",
  },
  {
    code: "D",
    name: "Party D — Sub-Contractor / Specialist",
    roleLabel: "Specialist Package Owner",
    email: "party-d@prhub.local",
    userName: "Sub-Contractor User",
  },
];

const SUBFOLDERS = [
  "1 INFORMATION REQUIREMENTS",
  "2 DESIGN",
  "3 PLANNING & SCHEDULING",
  "4 EVM & PROGRESS TRACKING",
  "5 CONSTRUCTION DOCUMENTATION",
  "6 SITE MONITORING",
  "7 CORRESPONDENCE & APPROVALS",
  "8 CONTRACTS & PROCUREMENT",
  "9 SAFETY & COMPLIANCE",
  "10 SHARED MODELS & DATA",
  "11 ARCHIVE",
];

async function main() {
  const passwordHash = await bcrypt.hash("prhub123", 10);

  for (const party of PARTIES) {
    const dbParty = await prisma.party.upsert({
      where: { code: party.code },
      update: {
        name: party.name,
        roleLabel: party.roleLabel,
        contactEmail: party.email,
      },
      create: {
        code: party.code,
        name: party.name,
        roleLabel: party.roleLabel,
        contactEmail: party.email,
      },
    });

    await prisma.user.upsert({
      where: { email: party.email },
      update: {
        name: party.userName,
        passwordHash,
        partyId: dbParty.id,
      },
      create: {
        email: party.email,
        name: party.userName,
        passwordHash,
        partyId: dbParty.id,
      },
    });

    let sortOrder = 0;
    await prisma.folder.upsert({
      where: { code: party.code },
      update: { name: party.name, sortOrder: sortOrder++ },
      create: {
        code: party.code,
        name: party.name,
        partyCode: party.code,
        partyId: dbParty.id,
        sortOrder: sortOrder++,
      },
    });

    for (let i = 0; i < SUBFOLDERS.length; i++) {
      const code = `${party.code}.${i + 1}`;
      await prisma.folder.upsert({
        where: { code },
        update: { name: SUBFOLDERS[i], sortOrder: sortOrder++ },
        create: {
          code,
          name: SUBFOLDERS[i],
          partyCode: party.code,
          partyId: dbParty.id,
          sortOrder: sortOrder++,
        },
      });
    }
  }

  console.log("Seed complete: 4 parties, 4 users, 48 folders (4 roots + 44 subfolders)");
  console.log("Login: party-a@prhub.local … party-d@prhub.local / password: prhub123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
