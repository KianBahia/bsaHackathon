import { x402Fetch } from "@ton-x402/client";
import { nanoToTon, atomicToJetton, decodePaymentRequired, HEADER_PAYMENT_REQUIRED } from "@ton-x402/core";
import { TonClient } from "@ton/ton";
import { WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { parseArgs } from "node:util";
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new Agent({ maxResponseSize: 65536 }));

async function main() {
    const { values } = parseArgs({
        options: {
            to: { type: "string" },
            amount: { type: "string" },
        },
    });

    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
        console.error("❌ Set WALLET_MNEMONIC env var (24-word mnemonic)");
        console.error("   Get testnet TON from https://t.me/testgiver_ton_bot");
        process.exit(1);
    }

    const rpcUrl =
        process.env.TON_RPC_URL ??
        "https://testnet.toncenter.com/api/v2/jsonRPC";
    const resourceUrl =
        process.env.RESOURCE_URL ?? "http://localhost:3000/api/weather";

    const keypair = await mnemonicToPrivateKey(mnemonic.split(" "));

    const wallet = WalletContractV5R1.create({
        publicKey: keypair.publicKey,
        workchain: 0,
    });

    const client = new TonClient({
        endpoint: rpcUrl,
        apiKey: process.env.RPC_API_KEY,
    });
    const walletContract = client.open(wallet);

    console.log(`💰 Wallet: ${wallet.address.toString({ bounceable: false })}`);

    const balance = await client.getBalance(wallet.address);
    console.log(`💎 Balance: ${nanoToTon(balance.toString())} TON`);

    const seqno = await walletContract.getSeqno();
    console.log(`🔢 Seqno: ${seqno}`);

    // Peek at what it costs
    console.log(`\n🌐 Requesting: ${resourceUrl}`);
    const peekResponse = await fetch(resourceUrl);

    if (peekResponse.status === 402) {
        const header = peekResponse.headers.get(HEADER_PAYMENT_REQUIRED);
        if (header) {
            const required = decodePaymentRequired(header);
            const option = required.accepts[0];
            const isTon = option.asset === "TON";
            const assetLabel = isTon ? "TON" : `Jetton (${option.asset})`;
            const humanAmount = isTon
                ? `${nanoToTon(option.amount)} TON`
                : `${atomicToJetton(option.amount, option.decimals ?? 9)} BSA USD`;
            console.log(`💸 Payment required: ${humanAmount}`);
            console.log(`🪙 Asset: ${assetLabel}`);
            console.log(`📍 Pay to: ${option.payTo}`);
            console.log(`🌐 Network: ${option.network}`);
        }
    } else if (peekResponse.ok) {
        console.log("✅ Resource is free! No payment needed.");
        const data = await peekResponse.json();
        console.log(data);
        return;
    } else {
        console.error(`❌ Server error (${peekResponse.status}): ${peekResponse.statusText}`);
        const text = await peekResponse.text();
        console.error(text);
        return;
    }

    // Pay with x402Fetch
    const finalAmount = values.amount ?? (peekResponse.status === 402 ? decodePaymentRequired(peekResponse.headers.get(HEADER_PAYMENT_REQUIRED)!).accepts[0].amount : "0");
    const finalTo = values.to ?? (peekResponse.status === 402 ? decodePaymentRequired(peekResponse.headers.get(HEADER_PAYMENT_REQUIRED)!).accepts[0].payTo : "");

    const optionFromHeader = peekResponse.status === 402 ? decodePaymentRequired(peekResponse.headers.get(HEADER_PAYMENT_REQUIRED)!).accepts[0] : null;
    const signLabel = !optionFromHeader || optionFromHeader.asset === "TON"
        ? `${nanoToTon(finalAmount)} TON`
        : `${atomicToJetton(finalAmount, optionFromHeader.decimals ?? 9)} BSA USD`;
    console.log(`\n🔐 Signing payment: ${signLabel} to ${finalTo}...`);
    if (values.amount || values.to) {
        console.log(`   (Using CLI overrides: amount=${values.amount ?? "default"}, to=${values.to ?? "default"})`);
    }

    const result = await x402Fetch(resourceUrl, {
        wallet,
        keypair,
        seqno,
        client,
        amount: values.amount,
        payTo: values.to,
    });

    if (result.response.ok) {
        if (result.paid && result.settlement?.txHash) {
            console.log("✅ Payment confirmed!");
            console.log(`📝 TX Hash: ${result.settlement.txHash}`);
            console.log(`🌐 Network: ${result.settlement.network}`);
        }
        const data = await result.response.json();
        console.log("\n📦 Resource data:");
        console.log(JSON.stringify(data, null, 2));
    } else {
        if (result.paid) {
            console.error("⚠️  Payment broadcasted but settlement failed (tx may still confirm on-chain)");
        }
        console.error(`❌ Request failed: ${result.response.status}`);
        const text = await result.response.text();
        console.error(text);
    }
}

main().catch(console.error);