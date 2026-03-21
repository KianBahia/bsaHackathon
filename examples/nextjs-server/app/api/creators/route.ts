import { NextRequest } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(_req: NextRequest) {
  const creators = await prisma.creator.findMany({
    include: {
      _count: { select: { posts: true, subscriptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(creators);
}
