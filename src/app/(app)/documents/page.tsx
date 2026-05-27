import { Suspense } from "react";
import { DocumentsPageClient } from "@/components/documents/documents-page-client";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading documents…</p>}>
      <DocumentsPageClient />
    </Suspense>
  );
}
