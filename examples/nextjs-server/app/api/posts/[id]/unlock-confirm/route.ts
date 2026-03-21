import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const { txHash } = await req.json();

  await prisma.unlock.upsert({
    where: { userId_postId: { userId, postId: id } },
    update: { txHash },
    create: { userId, postId: id, paidCredits: 0, txHash },
  });

  return Response.json({ success: true });
}
