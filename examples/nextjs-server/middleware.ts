import { NextRequest, NextResponse } from "next/server";

const BYPASS_PATTERNS = [
  /^\/api\/facilitator/,
  /^\/api\/telegram-webhook/,
  /^\/api\/wallet\/bot-status$/,
  /^\/api\/setup-webhook$/,
  /^\/api\/tonconnect-manifest$/,
  // Public read routes — no auth needed
  /^\/api\/creators/,
  /^\/api\/posts\/[^/]+\/preview$/,
];

async function validateTelegramInitData(
  initData: string,
  botToken: string
): Promise<{ valid: boolean; userId?: string; username?: string }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };
    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const enc = new TextEncoder();
    const webAppDataKey = await crypto.subtle.importKey(
      "raw",
      enc.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const secretKeyBytes = await crypto.subtle.sign(
      "HMAC",
      webAppDataKey,
      enc.encode(botToken)
    );
    const verifyKey = await crypto.subtle.importKey(
      "raw",
      secretKeyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      verifyKey,
      enc.encode(dataCheckString)
    );
    const expectedHash = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedHash !== hash) return { valid: false };

    const userJson = params.get("user");
    if (!userJson) return { valid: true };
    const user = JSON.parse(userJson);
    return {
      valid: true,
      userId: String(user.id),
      username: user.username,
    };
  } catch {
    return { valid: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (BYPASS_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next();
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    // Dev mode: inject mock user into request headers (not response headers)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-telegram-user-id", "dev-user-123");
    requestHeaders.set("x-telegram-username", "devuser");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const initData = request.headers.get("x-telegram-init-data");

  if (!initData) {
    return NextResponse.json(
      { error: "Missing Telegram init data" },
      { status: 401 }
    );
  }

  const result = await validateTelegramInitData(initData, botToken);
  if (!result.valid) {
    return NextResponse.json(
      { error: "Invalid Telegram auth" },
      { status: 401 }
    );
  }

  const requestHeaders = new Headers(request.headers);
  if (result.userId) requestHeaders.set("x-telegram-user-id", result.userId);
  if (result.username) requestHeaders.set("x-telegram-username", result.username);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/:path*"],
};
