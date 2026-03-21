import { NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tiers = await prisma.subscriptionTier.findMany({
    where: { creatorId: id },
    orderBy: { creditsPerMonth: "asc" },
  });
  return Response.json(tiers);
}
