import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  return Response.json(creator ?? { error: "Not found" }, { status: creator ? 200 : 404 });
}

export async function PUT(req: NextRequest) {
  const userId   = req.headers.get("x-telegram-user-id") ?? "anon";
  const username = req.headers.get("x-telegram-username") ?? undefined;

  let body: { displayName?: string; bio?: string | null; avatarUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.displayName?.trim()) {
    return Response.json({ error: "Display name is required" }, { status: 400 });
  }

  const fields = {
    displayName: body.displayName.trim(),
    bio:         body.bio        ?? null,
    avatarUrl:   body.avatarUrl  ?? null,
  };

  try {
    const creator = await prisma.creator.upsert({
      where:  { telegramUserId: userId },
      update: fields,
      create: {
        telegramUserId:   userId,
        telegramUsername: username,
        ...fields,
      },
    });
    return Response.json(creator);
  } catch (err) {
    console.error("profile PUT error:", err);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
