import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      contentType: true,
      contentUrl: true,
      previewUrl: true,
      accessType: true,
      creditPrice: true,
      groupUnlockTarget: true,
      groupUnlockCurrent: true,
      publishedAt: true,
      creatorId: true,
      creator: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
    },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  // Only expose contentUrl for free posts — paid posts must go through /content
  const { contentUrl, ...rest } = post;
  return Response.json({
    ...rest,
    contentUrl: post.accessType === "FREE" ? contentUrl : undefined,
  });
}
