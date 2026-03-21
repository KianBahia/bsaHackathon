import { NextRequest } from "next/server";
import { paymentGate } from "@ton-x402/middleware";
import { getPaymentConfig } from "../../../../../lib/payment-config";
import { prisma } from "../../../../../lib/prisma";
import { creditsToNano } from "../../../../../lib/credits";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  // Free content: return immediately
  if (post.accessType === "FREE") {
    return Response.json({ contentUrl: post.contentUrl });
  }

  // Check if already unlocked
  const userId = request.headers.get("x-telegram-user-id") ?? "anon";
  const existingUnlock = await prisma.unlock.findUnique({
    where: { userId_postId: { userId, postId: id } },
  });
  if (existingUnlock) {
    return Response.json({ contentUrl: post.contentUrl });
  }

  // Check subscription for SUBSCRIBERS_ONLY
  if (post.accessType === "SUBSCRIBERS_ONLY") {
    const sub = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId: post.creatorId } },
    });
    if (sub && sub.status === "ACTIVE") {
      return Response.json({ contentUrl: post.contentUrl });
    }
  }

  // Build dynamic payment config
  const amount = creditsToNano(post.creditPrice || 1);
  const config = getPaymentConfig({
    amount,
    asset: process.env.JETTON_MASTER_ADDRESS || "TON",
    description: `Unlock: ${post.title} (${post.creditPrice} credits)`,
    decimals: post.accessType === "ONE_TIME_UNLOCK" || post.accessType === "GROUP_UNLOCK" ? 9 : undefined,
  });

  const handler = async (req: Request) => {
    const uid = req.headers.get("x-telegram-user-id") ?? "anon";

    // Write Unlock record (txHash confirmed separately via unlock-confirm)
    await prisma.unlock.upsert({
      where: { userId_postId: { userId: uid, postId: id } },
      update: {},
      create: {
        userId: uid,
        postId: id,
        paidCredits: post.creditPrice,
        txHash: null,
      },
    });

    // Group unlock logic
    if (post.accessType === "GROUP_UNLOCK") {
      const updated = await prisma.post.update({
        where: { id },
        data: { groupUnlockCurrent: { increment: 1 } },
      });
      if (
        updated.groupUnlockCurrent >= (updated.groupUnlockTarget ?? Infinity)
      ) {
        await prisma.post.update({
          where: { id },
          data: { accessType: "FREE" },
        });
      }
    }

    return Response.json({ contentUrl: post.contentUrl });
  };

  return paymentGate(handler, { config })(request);
}
