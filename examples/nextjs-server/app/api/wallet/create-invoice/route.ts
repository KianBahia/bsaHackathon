import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return Response.json({ error: "Bot not configured" }, { status: 503 });
  }

  const { credits } = await req.json();
  const CREDITS_PER_STAR = parseInt(process.env.CREDITS_PER_STAR ?? "2", 10);
  const starsAmount = Math.ceil(credits / CREDITS_PER_STAR);

  if (starsAmount < 1) {
    return Response.json({ error: "Minimum 1 Star required" }, { status: 400 });
  }

  // Create invoice payload — encodes userId + credits for webhook matching
  const invoicePayload = `ribbit:${userId}:${credits}:${Date.now()}`;

  // Store pending invoice
  await prisma.invoiceRecord.create({
    data: { telegramUserId: userId, credits, starsAmount, invoicePayload },
  });

  // Call Telegram Bot API to create invoice link
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${credits} Ribbit Credits`,
        description: `Top up ${credits} credits to unlock content on Ribbit`,
        payload: invoicePayload,
        currency: "XTR",
        prices: [{ label: `${credits} Credits`, amount: starsAmount }],
      }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    return Response.json({ error: data.description ?? "Failed to create invoice" }, { status: 500 });
  }

  return Response.json({ invoiceUrl: data.result });
}
