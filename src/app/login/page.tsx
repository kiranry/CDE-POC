import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          PRHUB <span className="text-blue-700">CDE</span>
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Common Data Environment — POC
        </p>
        <Suspense fallback={<p className="mt-8 text-center text-sm">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-xs text-slate-400">
          Demo password for all accounts: <strong>prhub123</strong>
        </p>
      </div>
    </div>
  );
}
