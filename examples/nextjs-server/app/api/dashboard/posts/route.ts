import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json([]);

  const posts = await prisma.post.findMany({
    where: { creatorId: creator.id },
    include: { _count: { select: { unlocks: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(posts);
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const username = req.headers.get("x-telegram-username") ?? undefined;

  // Auto-create creator if needed
  let creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) {
    creator = await prisma.creator.create({
      data: {
        telegramUserId: userId,
        telegramUsername: username,
        displayName: username ? `@${username}` : `User ${userId.slice(-4)}`,
      },
    });
  }

  const body = await req.json();
  const {
    title, description, contentType, contentUrl, previewUrl,
    accessType, creditPrice, groupUnlockTarget, tier,
  } = body;

  const post = await prisma.post.create({
    data: {
      creatorId: creator.id,
      title,
      description,
      contentType: contentType ?? "TEXT",
      contentUrl,
      previewUrl,
      accessType: accessType ?? "FREE",
      creditPrice: Number(creditPrice) || 0,
      groupUnlockTarget: groupUnlockTarget ? Number(groupUnlockTarget) : null,
      tier,
      publishedAt: new Date(),
    },
  });

  return Response.json(post, { status: 201 });
}
