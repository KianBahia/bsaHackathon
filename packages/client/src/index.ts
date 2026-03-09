import {
    type PaymentRequired,
    type PaymentPayload,
    type SettlementResponse,
    decodePaymentRequired,
    encodePaymentPayload,
    decodeSettlementResponse,
    generateQueryId,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_RESPONSE,
} from "@ton-x402/core";
import {
    internal,
    external,
    beginCell,
    storeMessage,
    Address,
    SendMode,
} from "@ton/core";
import {
    WalletContractV4,
    WalletContractV5R1,
    TonClient,
} from "@ton/ton";
import type { KeyPair } from "@ton/crypto";

// ============================================================
// Types
// ============================================================

type WalletContract = WalletContractV4 | WalletContractV5R1 | {
    createTransfer(args: {
        seqno: number;
        secretKey: Buffer;
        messages: ReturnType<typeof internal>[];
        sendMode: number;
    }): unknown;
    address: Address;
};

export interface X402ClientConfig {
    wallet: WalletContract;
    keypair: KeyPair;
    seqno?: number;
    client?: TonClient;
    amount?: string;
    payTo?: string;
}

export interface X402FetchResult {
    response: Response;
    settlement?: SettlementResponse;
    paid: boolean;
}

// ============================================================
// Core: create signed BOC for a TON transfer
// ============================================================

async function createSignedBoc(
    wallet: WalletContract,
    keypair: KeyPair,
    seqno: number,
    to: string,
    amount: string,
    queryId: string,
    asset: string = "TON",
    client?: TonClient,
): Promise<string> {
    let transferMessage: ReturnType<typeof internal>;

    if (asset === "TON") {
        transferMessage = internal({
            to: Address.parse(to),
            value: BigInt(amount),
            bounce: false,
            body: beginCell()
                .storeUint(0, 32)
                .storeStringTail(`x402:${queryId}`)
                .endCell(),
        });
    } else {
        // Jetton transfer (TEP-74)
        if (!client) {
            throw new Error("TonClient is required in config for Jetton transfers");
        }

        const masterAddress = Address.parse(asset);
        const recipientAddress = Address.parse(to);

        // 1. Resolve sender's jetton wallet address
        const res = await client.runMethod(masterAddress, "get_wallet_address", [
            { type: "slice", cell: beginCell().storeAddress(wallet.address).endCell() },
        ]);
        const senderJettonWallet = res.stack.readAddress();

        // 2. Construct TEP-74 transfer body
        const jettonTransferBody = beginCell()
            .storeUint(0xf8a7ea5, 32) // op::transfer
            .storeUint(BigInt(queryId), 64) // query_id
            .storeCoins(BigInt(amount)) // amount
            .storeAddress(recipientAddress) // destination
            .storeAddress(wallet.address) // response_destination (excess gas to sender)
            .storeMaybeRef(null) // custom_payload
            .storeCoins(1_000_000n) // forward_ton_amount (0.001 TON for notification)
            .storeBit(0) // forward_payload: in-place
            .storeUint(0, 32) // comment prefix
            .storeStringTail(`x402:${queryId}`)
            .endCell();

        transferMessage = internal({
            to: senderJettonWallet,
            value: BigInt(70_000_000), // 0.07 TON for gas (conservative)
            bounce: true,
            body: jettonTransferBody,
        });
    }

    const transfer = (wallet as any).createTransfer({
        seqno,
        secretKey: keypair.secretKey,
        messages: [transferMessage],
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    });

    const ext = external({
        to: wallet.address,
        init: seqno === 0 ? (wallet as any).init : undefined,
        body: transfer,
    });

    const cell = beginCell().store(storeMessage(ext)).endCell();
    const boc = cell.toBoc();
    return boc.toString("base64");
}

// ============================================================
// x402 fetch wrapper
// ============================================================

/**
 * Wraps native fetch to handle x402 payment flow transparently.
 *
 * 1. Makes the initial request
 * 2. If 402 → reads PAYMENT-REQUIRED, signs BOC, retries with PAYMENT-SIGNATURE
 * 3. Returns the final response with settlement info
 *
 * The client NEVER broadcasts — the signed BOC goes to the facilitator.
 */
export async function x402Fetch(
    url: string | URL,
    config: X402ClientConfig,
    init?: RequestInit,
): Promise<X402FetchResult> {
    const { wallet, keypair } = config;

    // Step 1: Initial request
    const firstResponse = await fetch(url, init);

    if (firstResponse.status !== 402) {
        return { response: firstResponse, paid: false };
    }

    // Step 2: Parse payment requirements
    const paymentRequiredHeader = firstResponse.headers.get(HEADER_PAYMENT_REQUIRED);
    if (!paymentRequiredHeader) {
        throw new Error("Server returned 402 but no PAYMENT-REQUIRED header");
    }

    const paymentRequired: PaymentRequired = decodePaymentRequired(paymentRequiredHeader);

    const tonOption = paymentRequired.accepts.find(
        (a) => a.scheme === "ton-v1"
    );
    if (!tonOption) {
        throw new Error(
            `No TON payment option available. Accepted schemes: ${paymentRequired.accepts.map((a) => a.scheme).join(", ")}`
        );
    }

    // Step 3: Determine seqno
    let seqno = config.seqno;
    if (seqno === undefined) {
        if ("getSeqno" in wallet && typeof (wallet as any).getSeqno === "function") {
            seqno = await (wallet as any).getSeqno();
        } else {
            throw new Error(
                "seqno not provided and wallet has no getSeqno() method. " +
                "Pass seqno in config or open the wallet contract with a provider."
            );
        }
    }

    // Step 4: Sign BOC
    const queryId = generateQueryId();
    const boc = await createSignedBoc(
        wallet,
        keypair,
        seqno!,
        config.payTo ?? tonOption.payTo,
        config.amount ?? tonOption.amount,
        queryId,
        tonOption.asset,
        config.client,
    );

    // Step 5: Build payment payload
    const paymentPayload: PaymentPayload = {
        scheme: "ton-v1",
        network: tonOption.network,
        boc,
        fromAddress: wallet.address.toString({ bounceable: false }),
        queryId,
    };

    // Step 6: Retry with PAYMENT-SIGNATURE
    const retryInit: RequestInit = { ...init };
    const headers = new Headers(init?.headers);
    headers.set(HEADER_PAYMENT_SIGNATURE, encodePaymentPayload(paymentPayload));
    retryInit.headers = headers;

    const secondResponse = await fetch(url, retryInit);

    // Step 7: Extract settlement response
    const paymentResponseHeader = secondResponse.headers.get(HEADER_PAYMENT_RESPONSE);
    let settlement: SettlementResponse | undefined;
    if (paymentResponseHeader) {
        settlement = decodeSettlementResponse(paymentResponseHeader);
    }

    return {
        response: secondResponse,
        settlement,
        paid: true,
    };
}

export default x402Fetch;