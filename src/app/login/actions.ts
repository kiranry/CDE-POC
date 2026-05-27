"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { ACTIVE_PARTY_COOKIE } from "@/lib/party-labels";
import { prisma } from "@/lib/prisma";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl =
    (formData.get("callbackUrl") as string | null) ?? "/dashboard";

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Invalid email or password" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { party: true },
  });
  if (!user) {
    return { error: "Invalid email or password" };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PARTY_COOKIE, user.party.code, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }
}
