import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { TonClient, WalletContractV4, internal, Address } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { toNano } from "@ton/core";

const CREDITS_PER_TON = parseInt(process.env.CREDITS_PER_TON ?? "100", 10);

async function getTreasury() {
  const mnemonic = process.env.TREASURY_MNEMONIC;
  if (!mnemonic) return null;

  const words = mnemonic.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
  const client = new TonClient({
    endpoint: process.env.TON_RPC_URL ?? "https://testnet.toncenter.com/api/v2/jsonRPC",
    ...(process.env.RPC_API_KEY ? { apiKey: process.env.RPC_API_KEY } : {}),
  });
  return { contract: client.open(wallet), keyPair };
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-telegram-user-id") ?? "anon";
  const body = await request.json().catch(() => ({}));
  const { credits, toAddress } = body as { credits: number; toAddress: string };

  if (!credits || typeof credits !== "number" || credits < CREDITS_PER_TON) {
    return Response.json(
      { error: `Minimum withdrawal is ${CREDITS_PER_TON} credits (1 TON)` },
      { status: 400 }
    );
  }
  if (credits % CREDITS_PER_TON !== 0) {
    return Response.json(
      { error: `Credits must be a multiple of ${CREDITS_PER_TON}` },
      { status: 400 }
    );
  }
  if (!toAddress) {
    return Response.json({ error: "TON wallet address required" }, { status: 400 });
  }

  let parsedAddress: Address;
  try {
    parsedAddress = Address.parse(toAddress);
  } catch {
    return Response.json({ error: "Invalid TON address" }, { status: 400 });
  }

  const creator = await prisma.creator.findUnique({ where: { telegramUserId: userId } });
  if (!creator) return Response.json({ error: "Creator not found" }, { status: 404 });

  const wallet = await prisma.userWallet.findUnique({ where: { telegramUserId: userId } });
  const balance = wallet?.creditBalance ?? 0;
  if (balance < credits) {
    return Response.json({ error: "Insufficient credits", balance }, { status: 402 });
  }

  const tonAmount = credits / CREDITS_PER_TON;
  const nanotons = toNano(tonAmount.toFixed(9));

  // Atomically deduct credits and create a PENDING withdrawal record
  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.userWallet.update({
      where: { telegramUserId: userId },
      data: { creditBalance: { decrement: credits } },
    });
    return tx.withdrawal.create({
      data: {
        creatorId: creator.id,
        credits,
        tonAmount: nanotons.toString(),
        toAddress: parsedAddress.toString({ bounceable: false }),
        status: "PENDING",
      },
    });
  });

  const treasury = await getTreasury();

  // Dev / no treasury — simulate success without sending real TON
  if (!treasury) {
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "SIMULATED", txHash: `sim-${withdrawal.id}` },
    });
    return Response.json({
      success: true,
      tonAmount,
      simulated: true,
      message: "Simulated (no TREASURY_MNEMONIC configured). Credits deducted.",
    });
  }

  // Send real TON from treasury to creator
  try {
    const seqno = await treasury.contract.getSeqno();
    await treasury.contract.sendTransfer({
      secretKey: treasury.keyPair.secretKey,
      seqno,
      messages: [
        internal({
          to: parsedAddress,
          value: nanotons,
          body: `Ribbit payout ${withdrawal.id}`,
          bounce: false,
        }),
      ],
    });

    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "BROADCAST" },
    });

    return Response.json({
      success: true,
      tonAmount,
      message: "TON sent! It should arrive in your wallet within ~30 seconds.",
    });
  } catch (err) {
    // Refund credits on failure
    await prisma.$transaction([
      prisma.userWallet.update({
        where: { telegramUserId: userId },
        data: { creditBalance: { increment: credits } },
      }),
      prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "FAILED" },
      }),
    ]);
    return Response.json(
      { error: `Failed to send TON: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
