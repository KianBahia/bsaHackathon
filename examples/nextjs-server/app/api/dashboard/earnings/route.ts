import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Not a creator" }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { creatorId: creator.id },
    include: { unlocks: true },
  });

  // Credits earned from one-time unlocks
  const unlockCredits = posts.reduce(
    (sum, p) => sum + p.unlocks.reduce((s, u) => s + u.paidCredits, 0),
    0
  );

  // Credits earned from active subscriptions
  const activeSubs = await prisma.subscription.findMany({
    where: { creatorId: creator.id, status: "ACTIVE" },
    include: { tier: { select: { creditsPerMonth: true } } },
  });
  const subscriptionCredits = activeSubs.reduce(
    (sum, s) => sum + s.tier.creditsPerMonth,
    0
  );

  const subscriberCount = activeSubs.length;

  const recentUnlocks = await prisma.unlock.findMany({
    where: { post: { creatorId: creator.id } },
    orderBy: { paidAt: "desc" },
    take: 20,
    include: { post: { select: { title: true } } },
  });

  // Current wallet balance (what creator can withdraw as TON)
  const wallet = await prisma.userWallet.findUnique({
    where: { telegramUserId: userId },
  });

  return Response.json({
    totalCreditsEarned: unlockCredits + subscriptionCredits,
    unlockCredits,
    subscriptionCredits,
    subscriberCount,
    postCount: posts.length,
    withdrawableBalance: wallet?.creditBalance ?? 0,
    recentUnlocks,
  });
}
