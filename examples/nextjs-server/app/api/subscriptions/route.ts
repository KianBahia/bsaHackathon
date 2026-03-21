import { NextRequest } from "next/server";
import { paymentGate } from "@ton-x402/middleware";
import { getPaymentConfig } from "../../../lib/payment-config";
import { prisma } from "../../../lib/prisma";
import { creditsToNano } from "../../../lib/credits";

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
  const body = await request.clone().json().catch(() => ({}));
  const { tierId, creatorId } = body;

  if (!tierId || !creatorId) {
    return Response.json({ error: "tierId and creatorId required" }, { status: 400 });
  }

  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) return Response.json({ error: "Tier not found" }, { status: 404 });

  const amount = creditsToNano(tier.creditsPerMonth);
  const config = getPaymentConfig({
    amount,
    asset: process.env.JETTON_MASTER_ADDRESS || "TON",
    description: `Subscribe: ${tier.name} (${tier.creditsPerMonth} credits/month)`,
    decimals: 9,
  });

  const handler = async (req: Request) => {
    const userId = req.headers.get("x-telegram-user-id") ?? "anon";
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    await prisma.subscription.upsert({
      where: { userId_creatorId: { userId, creatorId } },
      update: { tierId, status: "ACTIVE", renewsAt },
      create: { userId, creatorId, tierId, status: "ACTIVE", renewsAt },
    });

    return Response.json({ success: true });
  };

  return paymentGate(handler, { config })(request);
}
