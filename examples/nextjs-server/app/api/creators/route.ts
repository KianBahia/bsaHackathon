import { NextRequest } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(_req: NextRequest) {
  const creators = await prisma.creator.findMany({
    select: {
      id: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      _count: { select: { posts: true, subscriptions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(creators);
}
