import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json([]);

  const tiers = await prisma.subscriptionTier.findMany({
    where: { creatorId: creator.id },
    orderBy: { creditsPerMonth: "asc" },
  });
  return Response.json(tiers);
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Not a creator" }, { status: 404 });

  let body: { name?: string; creditsPerMonth?: number; description?: string; perks?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!body.creditsPerMonth || body.creditsPerMonth < 1)
    return Response.json({ error: "Price must be at least 1 credit" }, { status: 400 });

  const tier = await prisma.subscriptionTier.create({
    data: {
      creatorId:      creator.id,
      name:           body.name.trim(),
      creditsPerMonth: Number(body.creditsPerMonth),
      description:    body.description?.trim() || null,
      perks:          body.perks?.trim() || null,
    },
  });
  return Response.json(tier, { status: 201 });
}
