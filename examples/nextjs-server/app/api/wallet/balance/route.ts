import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";

  // Run wallet upsert and transaction history fetches in parallel
  const [wallet, unlocks, subscriptions] = await Promise.all([
    prisma.userWallet.upsert({
      where: { telegramUserId: userId },
      update: {},
      create: { telegramUserId: userId, creditBalance: 0 },
    }),
    prisma.unlock.findMany({
      where: { userId },
      select: {
        id: true,
        paidCredits: true,
        paidAt: true,
        txHash: true,
        post: { select: { title: true, creatorId: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: {
        id: true,
        startedAt: true,
        tier: { select: { name: true, creditsPerMonth: true } },
        creator: { select: { displayName: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  const unlockTxns = unlocks.map((u) => ({
    id: u.id,
    type: "unlock" as const,
    paidCredits: u.paidCredits,
    paidAt: u.paidAt,
    txHash: u.txHash,
    post: u.post,
    subscription: null,
  }));

  const subTxns = subscriptions
    .filter((s) => s.tier.creditsPerMonth > 0)
    .map((s) => ({
      id: s.id,
      type: "subscription" as const,
      paidCredits: s.tier.creditsPerMonth,
      paidAt: s.startedAt,
      txHash: null,
      post: null,
      subscription: { tierName: s.tier.name, creatorName: s.creator.displayName },
    }));

  const recentTransactions = [...unlockTxns, ...subTxns]
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
    .slice(0, 30);

  return Response.json({ ...wallet, recentTransactions });
}
