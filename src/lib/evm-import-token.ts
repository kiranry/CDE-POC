import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

type EvmImportPayload = {
  docId: string;
  version?: number;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return secret;
}

export function createEvmImportToken(docId: string, version?: number): string {
  const payload: EvmImportPayload = {
    docId,
    exp: Date.now() + TOKEN_TTL_MS,
    ...(version !== undefined ? { version } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyEvmImportToken(
  token: string,
  docId: string,
): { valid: boolean; version?: number } {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  if (sig !== expected) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as EvmImportPayload;
    if (payload.docId !== docId || payload.exp < Date.now()) {
      return { valid: false };
    }
    return { valid: true, version: payload.version };
  } catch {
    return { valid: false };
  }
}

export function getEvmDashboardUrl(): string {
  return (
    process.env.EVM_DASHBOARD_URL?.replace(/\/$/, "") ||
    "https://evm-dashboard.netlify.app"
  );
}

export function getEvmDashboardOrigins(): string[] {
  const fromEnv = process.env.EVM_DASHBOARD_ORIGINS;
  if (fromEnv) {
    return fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  try {
    return [new URL(getEvmDashboardUrl()).origin];
  } catch {
    return ["https://evm-dashboard.netlify.app"];
  }
}

export function evmCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = getEvmDashboardOrigins();
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
  }
  return {};
}
