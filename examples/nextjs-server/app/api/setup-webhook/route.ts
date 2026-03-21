import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL;

  if (!botToken) return Response.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 400 });
  if (!appUrl)   return Response.json({ error: "NEXT_PUBLIC_APP_URL not set" }, { status: 400 });

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram-webhook`;

  const res  = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "pre_checkout_query"] }),
  });
  const data = await res.json();

  if (!data.ok) {
    return Response.json({ error: data.description ?? "Failed" }, { status: 500 });
  }

  // Also confirm current webhook info
  const infoRes  = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const infoData = await infoRes.json();

  return Response.json({
    ok:      true,
    message: `Webhook registered at ${webhookUrl}`,
    info:    infoData.result,
  });
}

// Also expose the current webhook status
export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return Response.json({ registered: false });

  const res  = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const data = await res.json();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const registered = data.result?.url?.includes("/api/telegram-webhook") &&
                     data.result?.url?.includes(appUrl.replace(/\/$/, "").split("//")[1] ?? "");

  return Response.json({ registered, url: data.result?.url ?? null });
}
