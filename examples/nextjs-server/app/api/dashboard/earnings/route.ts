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

  const totalUnlockCredits = posts.reduce((sum, p) =>
    sum + p.unlocks.reduce((s, u) => s + u.paidCredits, 0), 0);

  const subscriberCount = await prisma.subscription.count({
    where: { creatorId: creator.id, status: "ACTIVE" },
  });

  const recentUnlocks = await prisma.unlock.findMany({
    where: { post: { creatorId: creator.id } },
    orderBy: { paidAt: "desc" },
    take: 20,
    include: { post: { select: { title: true } } },
  });

  return Response.json({
    totalCreditsEarned: totalUnlockCredits,
    subscriberCount,
    postCount: posts.length,
    recentUnlocks,
  });
}
