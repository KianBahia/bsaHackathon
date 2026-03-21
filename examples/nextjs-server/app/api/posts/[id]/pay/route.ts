import { NextRequest } from "next/server";
import { TonClient } from "@ton/ton";
import { prisma } from "../../../../../lib/prisma";
import { settleBoc } from "@ton-x402/facilitator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = req.headers.get("x-telegram-user-id") ?? "anon";

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  let body: { boc: string; queryId: string; fromAddress: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.boc || !body.queryId || !body.fromAddress) {
    return Response.json({ error: "Missing boc, queryId, or fromAddress" }, { status: 400 });
  }

  // Build TonClient
  const client = new TonClient({
    endpoint: process.env.TON_RPC_URL ?? "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.RPC_API_KEY,
  });

  const settlement = await settleBoc(
    {
      scheme: "ton-v1",
      network: (process.env.TON_NETWORK as "testnet" | "mainnet") ?? "testnet",
      boc: body.boc,
      fromAddress: body.fromAddress,
      queryId: body.queryId,
    },
    {
      scheme: "ton-v1",
      network: (process.env.TON_NETWORK as "testnet" | "mainnet") ?? "testnet",
      amount: String(BigInt(post.creditPrice) * BigInt(1_000_000_000) / BigInt(parseInt(process.env.CREDITS_PER_TON ?? "100"))),
      asset: process.env.JETTON_MASTER_ADDRESS ?? "TON",
      payTo: process.env.PAYMENT_ADDRESS ?? "",
      facilitatorUrl: process.env.FACILITATOR_URL ?? "http://localhost:3000/api/facilitator",
    },
    {
      client,
    }
  );

  if (!settlement.success) {
    return Response.json({ error: settlement.error ?? "Settlement failed" }, { status: 402 });
  }

  // Write unlock record
  await prisma.unlock.upsert({
    where: { userId_postId: { userId, postId: id } },
    update: { txHash: settlement.txHash },
    create: { userId, postId: id, paidCredits: post.creditPrice, txHash: settlement.txHash },
  });

  // Group unlock
  if (post.accessType === "GROUP_UNLOCK") {
    const updated = await prisma.post.update({
      where: { id },
      data: { groupUnlockCurrent: { increment: 1 } },
    });
    if (updated.groupUnlockCurrent >= (updated.groupUnlockTarget ?? Infinity)) {
      await prisma.post.update({ where: { id }, data: { accessType: "FREE" } });
    }
  }

  return Response.json({ contentUrl: post.contentUrl, txHash: settlement.txHash });
}
