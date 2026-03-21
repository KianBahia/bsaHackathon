import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const creator = await prisma.creator.findUnique({
    where: { id },
    include: {
      tiers: true,
      _count: { select: { subscriptions: true } },
      posts: {
        where: { publishedAt: { not: null } },
        select: {
          id: true,
          title: true,
          description: true,
          contentType: true,
          previewUrl: true,
          accessType: true,
          creditPrice: true,
          groupUnlockTarget: true,
          groupUnlockCurrent: true,
          publishedAt: true,
          tier: true,
        },
        orderBy: { publishedAt: "desc" },
      },
    },
  });
  if (!creator) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(creator);
}
