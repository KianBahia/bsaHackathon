import { NextRequest } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return Response.json({ ok: true });

  let update: any;
  try {
    update = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // pre_checkout_query: must answer within 10 seconds — answer immediately
  if (update.pre_checkout_query) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      }),
    });
    return Response.json({ ok: true });
  }

  // successful_payment
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const payload = payment.invoice_payload as string;

    // Update invoice record status
    try {
      const invoice = await prisma.invoiceRecord.findUnique({ where: { invoicePayload: payload } });
      if (invoice && invoice.status === "PENDING") {
        await prisma.invoiceRecord.update({
          where: { invoicePayload: payload },
          data: { status: "PAID", paidAt: new Date() },
        });

        // Credit the user's wallet
        await prisma.userWallet.upsert({
          where: { telegramUserId: invoice.telegramUserId },
          update: { creditBalance: { increment: invoice.credits } },
          create: { telegramUserId: invoice.telegramUserId, creditBalance: invoice.credits },
        });
      }
    } catch {
      // Don't fail — payment is already confirmed by Telegram
    }

    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
