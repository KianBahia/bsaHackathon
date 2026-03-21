import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";

  const post = await prisma.post.findUnique({
    where: { id },
    include: { creator: true },
  });
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  if (post.creator.telegramUserId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await prisma.post.update({ where: { id }, data: body });
  return Response.json(updated);
}
