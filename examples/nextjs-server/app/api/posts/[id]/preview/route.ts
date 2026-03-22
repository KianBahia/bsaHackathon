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
      creator: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  const { contentUrl, ...rest } = post;

  // Free — always expose content
  if (post.accessType === "FREE") {
    return Response.json({ ...rest, contentUrl, isUnlocked: true });
  }

  // Check if this user has already unlocked the post
  const unlock = await prisma.unlock.findUnique({
    where: { userId_postId: { userId, postId: id } },
  });
  if (unlock) {
    return Response.json({ ...rest, contentUrl, isUnlocked: true });
  }

  // Check active subscription for SUBSCRIBERS_ONLY
  if (post.accessType === "SUBSCRIBERS_ONLY") {
    const sub = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: post.creatorId } },
    });
    if (sub?.status === "ACTIVE") {
      return Response.json({ ...rest, contentUrl, isUnlocked: true });
    }
  }

  // Locked — no contentUrl, but tell the client their current credit balance
  const wallet = await prisma.userWallet.findUnique({ where: { telegramUserId: userId } });
  return Response.json({
    ...rest,
    contentUrl: undefined,
    isUnlocked: false,
    userBalance: wallet?.creditBalance ?? 0,
  });
}
