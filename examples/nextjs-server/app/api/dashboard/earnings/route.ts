import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Not a creator" }, { status: 404 });

  // Run all independent queries in parallel
  const [unlockAgg, activeSubs, recentUnlocks, wallet, postCount] = await Promise.all([
    // Sum unlock credits directly in DB — no need to load all records into memory
    prisma.unlock.aggregate({
      where: { post: { creatorId: creator.id } },
      _sum: { paidCredits: true },
    }),
    prisma.subscription.findMany({
      where: { creatorId: creator.id, status: "ACTIVE" },
      select: { tier: { select: { creditsPerMonth: true } } },
    }),
    prisma.unlock.findMany({
      where: { post: { creatorId: creator.id } },
      orderBy: { paidAt: "desc" },
      take: 20,
      select: {
        id: true,
        paidCredits: true,
        paidAt: true,
        post: { select: { title: true } },
      },
    }),
    prisma.userWallet.findUnique({ where: { telegramUserId: userId } }),
    prisma.post.count({ where: { creatorId: creator.id } }),
  ]);

  const unlockCredits = unlockAgg._sum.paidCredits ?? 0;
  const subscriptionCredits = activeSubs.reduce((sum, s) => sum + s.tier.creditsPerMonth, 0);

  return Response.json({
    totalCreditsEarned: unlockCredits + subscriptionCredits,
    unlockCredits,
    subscriptionCredits,
    subscriberCount: activeSubs.length,
    postCount,
    withdrawableBalance: wallet?.creditBalance ?? 0,
    recentUnlocks,
  });
}
