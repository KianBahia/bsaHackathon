import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = request.headers.get("x-telegram-user-id") ?? "anon";

  const post = await prisma.post.findUnique({
    where: { id },
    include: { creator: { select: { telegramUserId: true } } },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  // Free content — no payment needed
  if (post.accessType === "FREE") {
    return Response.json({ contentUrl: post.contentUrl });
  }

  // Already unlocked — serve immediately
  const existingUnlock = await prisma.unlock.findUnique({
    where: { userId_postId: { userId, postId: id } },
  });
  if (existingUnlock) {
    return Response.json({ contentUrl: post.contentUrl });
  }

  // Subscribers-only — check for active subscription
  if (post.accessType === "SUBSCRIBERS_ONLY") {
    const sub = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: post.creatorId } },
    });
    if (sub?.status === "ACTIVE") {
      return Response.json({ contentUrl: post.contentUrl });
    }
    return Response.json(
      { error: "Subscription required", accessType: "SUBSCRIBERS_ONLY", creatorId: post.creatorId },
      { status: 402 }
    );
  }

  // ONE_TIME_UNLOCK or GROUP_UNLOCK — deduct credits
  const price = post.creditPrice;

  if (price > 0) {
    const userWallet = await prisma.userWallet.findUnique({
      where: { telegramUserId: userId },
    });
    const balance = userWallet?.creditBalance ?? 0;

    if (balance < price) {
      return Response.json(
        { error: "Insufficient credits", required: price, balance },
        { status: 402 }
      );
    }

    // Atomic: deduct from buyer + credit creator + record unlock
    await prisma.$transaction([
      prisma.userWallet.update({
        where: { telegramUserId: userId },
        data: { creditBalance: { decrement: price } },
      }),
      prisma.userWallet.upsert({
        where: { telegramUserId: post.creator.telegramUserId },
        update: { creditBalance: { increment: price } },
        create: { telegramUserId: post.creator.telegramUserId, creditBalance: price },
      }),
      prisma.unlock.create({
        data: { userId, postId: id, paidCredits: price },
      }),
    ]);
  } else {
    // Price is 0 — just record the unlock
    await prisma.unlock.create({
      data: { userId, postId: id, paidCredits: 0 },
    });
  }

  // Group unlock — check if target reached
  if (post.accessType === "GROUP_UNLOCK" && post.groupUnlockTarget) {
    const updated = await prisma.post.update({
      where: { id },
      data: { groupUnlockCurrent: { increment: 1 } },
    });
    if (updated.groupUnlockCurrent >= updated.groupUnlockTarget) {
      await prisma.post.update({ where: { id }, data: { accessType: "FREE" } });
    }
  }

  return Response.json({ contentUrl: post.contentUrl });
}
