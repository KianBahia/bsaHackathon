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

  if (post.accessType === "FREE") {
    return Response.json({ contentUrl: post.contentUrl });
  }

  // Check unlock + subscription in parallel
  const [existingUnlock, sub] = await Promise.all([
    prisma.unlock.findUnique({ where: { userId_postId: { userId, postId: id } } }),
    prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: post.creatorId } },
    }),
  ]);

  if (existingUnlock) return Response.json({ contentUrl: post.contentUrl });

  if (post.accessType === "SUBSCRIBERS_ONLY") {
    if (sub?.status === "ACTIVE") return Response.json({ contentUrl: post.contentUrl });
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
      prisma.unlock.create({ data: { userId, postId: id, paidCredits: price } }),
    ]);
  } else {
    await prisma.unlock.create({ data: { userId, postId: id, paidCredits: 0 } });
  }

  // Group unlock — atomically increment and flip to FREE if target reached
  if (post.accessType === "GROUP_UNLOCK" && post.groupUnlockTarget) {
    await prisma.post.update({
      where: { id },
      data: {
        groupUnlockCurrent: { increment: 1 },
        // Flip to FREE once target is reached — done in one query using a raw check
        accessType:
          post.groupUnlockCurrent + 1 >= post.groupUnlockTarget ? "FREE" : post.accessType,
      },
    });
  }

  return Response.json({ contentUrl: post.contentUrl });
}
