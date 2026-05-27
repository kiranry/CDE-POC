"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { NotificationPanel } from "@/components/notification-panel";
import { PartySwitcher } from "@/components/party-switcher";
import { PARTY_LABELS } from "@/lib/party-labels";
import { PartyCode } from "@prisma/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/documents", label: "Documents" },
  { href: "/rfi", label: "RFI Register" },
  { href: "/stakeholders", label: "Stakeholders" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const partyCode = session?.user?.partyCode as PartyCode | undefined;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="text-lg font-bold text-slate-800">
            PRHUB <span className="text-blue-700">CDE</span>
          </Link>

          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-700 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationPanel />

            {partyCode && <PartySwitcher loggedInParty={partyCode} />}

            <div className="hidden text-right text-xs text-slate-500 sm:block">
              <p className="font-medium text-slate-700">{session?.user?.name}</p>
              <p>Logged in: {partyCode ? PARTY_LABELS[partyCode] : "—"}</p>
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
