import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const { credits } = await req.json();
  const amount = Number(credits);
  if (!amount || amount <= 0) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }

  // TODO: Integrate with Telegram Stars real payment
  const wallet = await prisma.userWallet.upsert({
    where: { telegramUserId: userId },
    update: { creditBalance: { increment: amount } },
    create: { telegramUserId: userId, creditBalance: amount },
  });

  return Response.json({ success: true, newBalance: wallet.creditBalance });
}
