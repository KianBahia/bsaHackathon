import { NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  TonClient,
  WalletContractV3R2,
  WalletContractV4,
  WalletContractV5R1,
  internal,
  Address,
} from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { toNano } from "@ton/core";

const CREDITS_PER_TON = parseInt(process.env.CREDITS_PER_TON ?? "100", 10);

function makeClient() {
  return new TonClient({
    endpoint: process.env.TON_RPC_URL ?? "https://testnet.toncenter.com/api/v2/jsonRPC",
    ...(process.env.RPC_API_KEY ? { apiKey: process.env.RPC_API_KEY } : {}),
  });
}

async function getTreasury() {
  const mnemonic = process.env.TREASURY_MNEMONIC;
  if (!mnemonic) return null;

  const words = mnemonic.trim().split(/\s+/);
  const keyPair = await mnemonicToPrivateKey(words);
  const client = makeClient();

  // Try wallet versions in order of likelihood (Tonkeeper now creates V5R1 by default)
  const versions = [
    { name: "V5R1", create: () => WalletContractV5R1.create({ publicKey: keyPair.publicKey, workchain: 0 }) },
    { name: "V4",   create: () => WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 }) },
    { name: "V3R2", create: () => WalletContractV3R2.create({ publicKey: keyPair.publicKey, workchain: 0 }) },
  ];

  for (const v of versions) {
    const wallet = v.create();
    const contract = client.open(wallet);
    try {
      const balance = await client.getBalance(wallet.address);
      console.log(`[withdraw] ${v.name} address=${wallet.address.toString({ bounceable: false })} balance=${balance}`);
      if (balance > 0n) {
        console.log(`[withdraw] Using treasury wallet version ${v.name}`);
        return { contract, keyPair, version: v.name };
      }
    } catch (e) {
      console.log(`[withdraw] ${v.name} check failed: ${(e as Error).message}`);
    }
  }

  // No version has a balance — still return V5R1 so the error is clear
  console.warn("[withdraw] No treasury wallet version found with a balance — is the mnemonic correct and wallet funded?");
  const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey, workchain: 0 });
  return { contract: client.open(wallet), keyPair, version: "V5R1-unfunded" };
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

  // No treasury configured — simulate
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
    let seqno = 0;
    try { seqno = await treasury.contract.getSeqno(); } catch { seqno = 0; }
    console.log(`[withdraw] seqno=${seqno} sending ${tonAmount} TON to ${parsedAddress.toString({ bounceable: false })}`);

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
    console.error("[withdraw] TON send failed:", (err as Error).message);
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
