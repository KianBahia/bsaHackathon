import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  return Response.json(creator);
}

export async function PUT(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const username = req.headers.get("x-telegram-username") ?? undefined;
  const body = await req.json();

  const creator = await prisma.creator.upsert({
    where: { telegramUserId: userId },
    update: body,
    create: {
      telegramUserId: userId,
      telegramUsername: username,
      displayName: body.displayName ?? `User ${userId.slice(-4)}`,
      ...body,
    },
  });

  return Response.json(creator);
}
