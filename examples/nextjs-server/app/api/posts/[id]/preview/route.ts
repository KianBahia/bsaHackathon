import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      contentType: true,
      contentUrl: true,
      previewUrl: true,
      accessType: true,
      creditPrice: true,
      groupUnlockTarget: true,
      groupUnlockCurrent: true,
      publishedAt: true,
      creatorId: true,
      creator: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  const { contentUrl, ...rest } = post;

  if (post.accessType === "FREE") {
    return Response.json({ ...rest, contentUrl, isUnlocked: true });
  }

  // Run all access checks in parallel
  const [unlock, sub, wallet] = await Promise.all([
    prisma.unlock.findUnique({
      where: { userId_postId: { userId, postId: id } },
    }),
    prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: post.creatorId } },
    }),
    prisma.userWallet.findUnique({ where: { telegramUserId: userId } }),
  ]);

  if (unlock || (post.accessType === "SUBSCRIBERS_ONLY" && sub?.status === "ACTIVE")) {
    return Response.json({ ...rest, contentUrl, isUnlocked: true });
  }

  return Response.json({
    ...rest,
    contentUrl: undefined,
    isUnlocked: false,
    userBalance: wallet?.creditBalance ?? 0,
  });
}
