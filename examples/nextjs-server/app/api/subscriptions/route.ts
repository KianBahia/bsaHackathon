import { NextRequest } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get("x-telegram-user-id") ?? "anon";
  const body = await request.json().catch(() => ({}));
  const { creatorId } = body;

  if (!creatorId) {
    return Response.json({ error: "creatorId required" }, { status: 400 });
  }

  await prisma.subscription.updateMany({
    where: { userId, creatorId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  return Response.json({ success: true });
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      creator: { select: { id: true, displayName: true, avatarUrl: true } },
      tier: true,
    },
  });
  return Response.json(subscriptions);
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-telegram-user-id") ?? "anon";
  const body = await request.json().catch(() => ({}));
  const { tierId, creatorId } = body;

  if (!tierId || !creatorId) {
    return Response.json({ error: "tierId and creatorId required" }, { status: 400 });
  }

  const tier = await prisma.subscriptionTier.findUnique({
    where: { id: tierId },
    include: { creator: { select: { telegramUserId: true } } },
  });
  if (!tier) return Response.json({ error: "Tier not found" }, { status: 404 });

  // Prevent re-subscribing to an already active subscription
  const existing = await prisma.subscription.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });
  if (existing?.status === "ACTIVE") {
    return Response.json({ error: "Already subscribed" }, { status: 409 });
  }

  const price = tier.creditsPerMonth;

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

    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    // Atomic: deduct from subscriber + credit creator + record subscription
    await prisma.$transaction([
      prisma.userWallet.upsert({
        where: { telegramUserId: userId },
        update: { creditBalance: { decrement: price } },
        create: { telegramUserId: userId, creditBalance: 0 },
      }),
      prisma.userWallet.upsert({
        where: { telegramUserId: tier.creator.telegramUserId },
        update: { creditBalance: { increment: price } },
        create: { telegramUserId: tier.creator.telegramUserId, creditBalance: price },
      }),
      prisma.subscription.upsert({
        where: { userId_creatorId: { userId, creatorId } },
        update: { tierId, status: "ACTIVE", renewsAt },
        create: { userId, creatorId, tierId, status: "ACTIVE", renewsAt },
      }),
    ]);
  } else {
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);
    await prisma.subscription.upsert({
      where: { userId_creatorId: { userId, creatorId } },
      update: { tierId, status: "ACTIVE", renewsAt },
      create: { userId, creatorId, tierId, status: "ACTIVE", renewsAt },
    });
  }

  return Response.json({ success: true, creditsCharged: price });
}
