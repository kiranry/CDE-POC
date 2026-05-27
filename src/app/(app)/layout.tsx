import { AppShell } from "@/components/app-shell";
import { auth } from "@/lib/auth";
import { getActivePartyCode } from "@/lib/party-context";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const activePartyCode = await getActivePartyCode(session.user.partyCode);

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      loggedInParty={session.user.partyCode}
      activePartyCode={activePartyCode}
    >
      {children}
    </AppShell>
  );
}
