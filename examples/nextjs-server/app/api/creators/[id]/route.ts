import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";

  const [creator, subscription, unlocks] = await Promise.all([
    prisma.creator.findUnique({
      where: { id },
      include: {
        tiers: true,
        _count: { select: { subscriptions: true } },
        posts: {
          where: { publishedAt: { not: null } },
          select: {
            id: true,
            title: true,
            description: true,
            contentType: true,
            previewUrl: true,
            accessType: true,
            creditPrice: true,
            groupUnlockTarget: true,
            groupUnlockCurrent: true,
            publishedAt: true,
            tier: true,
          },
          orderBy: { publishedAt: "desc" },
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: id } },
    }),
    prisma.unlock.findMany({
      where: { userId, post: { creatorId: id } },
      select: { postId: true },
    }),
  ]);

  if (!creator) return Response.json({ error: "Not found" }, { status: 404 });

  const isSubscribed = subscription?.status === "ACTIVE";
  const unlockedPostIds = new Set(unlocks.map((u) => u.postId));

  const posts = creator.posts.map((post) => {
    const isUnlocked =
      post.accessType === "FREE" ||
      (post.accessType === "SUBSCRIBERS_ONLY" && isSubscribed) ||
      unlockedPostIds.has(post.id) ||
      (post.accessType === "GROUP_UNLOCK" &&
        (post.groupUnlockCurrent ?? 0) >= (post.groupUnlockTarget ?? Infinity));
    return { ...post, isUnlocked };
  });

  return Response.json({ ...creator, posts });
}
