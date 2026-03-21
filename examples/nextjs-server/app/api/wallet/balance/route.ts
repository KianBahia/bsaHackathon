import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const wallet = await prisma.userWallet.upsert({
    where: { telegramUserId: userId },
    update: {},
    create: { telegramUserId: userId, creditBalance: 0 },
  });

  const unlocks = await prisma.unlock.findMany({
    where: { userId },
    include: { post: { select: { title: true, creatorId: true } } },
    orderBy: { paidAt: "desc" },
    take: 20,
  });

  return Response.json({ ...wallet, recentTransactions: unlocks });
}
