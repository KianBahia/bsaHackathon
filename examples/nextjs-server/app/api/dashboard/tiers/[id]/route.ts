import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const { id } = await params;

  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Not a creator" }, { status: 404 });

  const tier = await prisma.subscriptionTier.findUnique({ where: { id } });
  if (!tier || tier.creatorId !== creator.id)
    return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.subscriptionTier.delete({ where: { id } });
  return Response.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";
  const { id } = await params;

  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Not a creator" }, { status: 404 });

  const tier = await prisma.subscriptionTier.findUnique({ where: { id } });
  if (!tier || tier.creatorId !== creator.id)
    return Response.json({ error: "Not found" }, { status: 404 });

  let body: { name?: string; creditsPerMonth?: number; description?: string; perks?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updated = await prisma.subscriptionTier.update({
    where: { id },
    data: {
      name:            body.name?.trim() || tier.name,
      creditsPerMonth: body.creditsPerMonth ? Number(body.creditsPerMonth) : tier.creditsPerMonth,
      description:     body.description !== undefined ? (body.description?.trim() || null) : tier.description,
      perks:           body.perks !== undefined ? (body.perks?.trim() || null) : tier.perks,
    },
  });
  return Response.json(updated);
}
