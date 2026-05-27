import { Suspense } from "react";
import { RfiPageClient } from "@/components/rfi/rfi-page-client";

export default function RfiPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading RFI register…</p>}>
      <RfiPageClient />
    </Suspense>
  );
}
