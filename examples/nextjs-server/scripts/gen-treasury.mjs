/**
 * Run once to generate a fresh treasury wallet:
 *   node scripts/gen-treasury.mjs
 *
 * Copy the output into your .env, then send testnet TON to the printed address.
 */
import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV5R1 } from "@ton/ton";

const words = await mnemonicNew(24);
const keyPair = await mnemonicToPrivateKey(words);
const wallet = WalletContractV5R1.create({ publicKey: keyPair.publicKey, workchain: 0 });

console.log("\n=== NEW TREASURY WALLET ===\n");
console.log("Fund this address with testnet TON:");
console.log(wallet.address.toString({ bounceable: false }));
console.log("");
console.log("Add this to your .env:");
console.log(`TREASURY_MNEMONIC="${words.join(" ")}"`);
console.log("\n===========================\n");
