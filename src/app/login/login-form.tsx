"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";

const DEMO_ACCOUNTS = [
  { email: "party-a@prhub.local", label: "VISL (PMC) — party-a@prhub.local" },
  { email: "party-b@prhub.local", label: "SR (Southern Railway) — party-b@prhub.local" },
  { email: "party-c@prhub.local", label: "Adani — party-c@prhub.local" },
  { email: "party-d@prhub.local", label: "KRCL (Konkan Railway) — party-d@prhub.local" },
];

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4 text-slate-900">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <select
          name="email"
          defaultValue="party-a@prhub.local"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {DEMO_ACCOUNTS.map((a) => (
            <option
              key={a.email}
              value={a.email}
              className="bg-white text-slate-900"
            >
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          type="password"
          name="password"
          defaultValue="prhub123"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-700 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
