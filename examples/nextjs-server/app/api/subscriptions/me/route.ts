import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

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
