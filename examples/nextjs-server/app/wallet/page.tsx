"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronRight, Star, ArrowDownLeft, ArrowUpRight,
  Plus, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { TonConnectButton } from "@tonconnect/ui-react";
import { BottomNav } from "../../components/BottomNav";
import { useTelegram } from "../../components/TelegramProvider";
import { createApiClient } from "../../lib/api-client";

interface Transaction {
  id: string;
  type: "unlock" | "subscription";
  paidCredits: number;
  paidAt: string;
  txHash?: string | null;
  post?: { title: string } | null;
  subscription?: { tierName: string; creatorName: string } | null;
}

interface WalletData {
  creditBalance: number;
  recentTransactions: Transaction[];
}

const CREDITS_PER_TON = parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10);

const PACKAGES = [
  { stars: 25,  credits: 50,  label: "Starter" },
  { stars: 50,  credits: 100, label: "Popular"  },
  { stars: 250, credits: 500, label: "Pro"       },
];

const DEV_TOPUPS = [
  { credits: 50,  label: "50 credits"  },
  { credits: 200, label: "200 credits" },
  { credits: 500, label: "500 credits" },
];

export default function WalletPage() {
  const { initData, user, isReady } = useTelegram();
  const [wallet, setWallet]         = useState<WalletData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [buying, setBuying]         = useState<number | null>(null);
  const [hasBot, setHasBot]         = useState(false);
  const [webhookOk, setWebhookOk]   = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBalance = useCallback(async () => {
    const api = createApiClient(initData);
    const res = await api("/api/wallet/balance");
    if (!res.ok) return null;
    const data = await res.json();
    return {
      creditBalance: data.creditBalance ?? 0,
      recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
    } as WalletData;
  }, [initData]);

  const loadWallet = useCallback(async () => {
    const api = createApiClient(initData);
    try {
      const [walletData, botRes] = await Promise.all([
        fetchBalance(),
        api("/api/wallet/bot-status"),
      ]);

      if (walletData) setWallet(walletData);

      if (botRes.ok) {
        const botData = await botRes.json();
        const botConfigured = botData.configured === true;
        setHasBot(botConfigured);

        // Auto-register the webhook whenever the wallet page loads so Stars
        // payments are always routed correctly without manual setup.
        if (botConfigured) {
          const webhookRes = await fetch("/api/setup-webhook");
          setWebhookOk(webhookRes.ok);
        }
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [initData, fetchBalance]);

  useEffect(() => {
    if (!isReady) return;
    loadWallet();
  }, [isReady, loadWallet]);

  // Poll balance for up to 30s after a payment while waiting for webhook
  const startPolling = useCallback(() => {
    let attempts = 0;
    const prevBalance = wallet?.creditBalance ?? 0;

    const poll = async () => {
      attempts++;
      const data = await fetchBalance();
      if (data) {
        setWallet(data);
        if (data.creditBalance > prevBalance || attempts >= 10) return; // balance changed or timeout
      }
      if (attempts < 10) {
        pollRef.current = setTimeout(poll, 3000);
      }
    };

    pollRef.current = setTimeout(poll, 2000);
  }, [wallet, fetchBalance]);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const registerWebhook = async () => {
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const res  = await fetch("/api/setup-webhook");
      const data = await res.json();
      if (data.ok) {
        setWebhookOk(true);
        setRegisterMsg("Webhook registered!");
      } else {
        setRegisterMsg(data.error ?? "Failed");
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleBuyStars = async (pkg: typeof PACKAGES[number]) => {
    setBuying(pkg.credits);
    try {
      const res = await createApiClient(initData)("/api/wallet/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: pkg.credits }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error ?? "Failed to create invoice");
        return;
      }
      const { invoiceUrl } = json;

      const onPaid = (status: string) => {
        if (status === "paid") startPolling();
      };

      const twa = typeof window !== "undefined" && (window as any).Telegram?.WebApp;
      if (twa?.openInvoice) {
        twa.openInvoice(invoiceUrl, onPaid);
      } else {
        window.open(invoiceUrl, "_blank");
      }
    } catch (err) {
      alert("Something went wrong. Please try again.");
      console.error("[handleBuyStars]", err);
    } finally {
      setBuying(null);
    }
  };

  const handleDevTopup = async (credits: number) => {
    setBuying(credits);
    try {
      const res = await createApiClient(initData)("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      if (res.ok) await loadWallet();
    } finally {
      setBuying(null);
    }
  };

  const txns = wallet?.recentTransactions ?? [];

  return (
    <div className="min-h-screen bg-bg font-sans">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl h-14 flex items-center px-4">
        <div className="max-w-mobile mx-auto w-full">
          <span className="text-[17px] font-semibold text-white">Wallet</span>
        </div>
      </header>

      <main className="max-w-mobile mx-auto pb-28 pt-2">
        {/* Balance hero */}
        <div className="flex flex-col items-center py-8">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-14 w-32 bg-surface rounded-xl animate-pulse" />
              <div className="h-4 w-40 bg-surface rounded animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-[56px] font-bold text-white leading-none tabular-nums">
                {wallet?.creditBalance ?? 0}
              </p>
              <p className="text-[15px] text-label2 mt-2">
                credits&nbsp;&nbsp;·&nbsp;&nbsp;≈&nbsp;
                {((wallet?.creditBalance ?? 0) / CREDITS_PER_TON).toFixed(2)} TON
              </p>
            </>
          )}
        </div>

        {/* Webhook setup banner — only when bot is configured but webhook isn't registered */}
        {!loading && hasBot && webhookOk === false && (
          <div className="mx-4 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3.5">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[14px] text-white font-medium">Webhook not registered</p>
                <p className="text-[13px] text-label2 mt-0.5">
                  Required for Stars payments to credit your balance.
                </p>
                {registerMsg && (
                  <p className={`text-[13px] mt-1 ${registerMsg.includes("!") ? "text-ribbit" : "text-red-400"}`}>
                    {registerMsg}
                  </p>
                )}
              </div>
              <button
                onClick={registerWebhook}
                disabled={registering}
                className="flex-shrink-0 bg-yellow-500/20 text-yellow-400 text-[13px] font-semibold px-3 py-1.5 rounded-xl active:opacity-80 disabled:opacity-50"
              >
                {registering ? <Loader2 size={14} className="animate-spin" /> : "Fix"}
              </button>
            </div>
          </div>
        )}

        {/* Webhook OK banner — briefly show after registration */}
        {!loading && hasBot && webhookOk === true && registerMsg?.includes("!") && (
          <div className="mx-4 mb-4 bg-ribbit/10 border border-ribbit/20 rounded-2xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-ribbit" />
            <p className="text-[14px] text-ribbit">Webhook active — Stars payments ready</p>
          </div>
        )}

        {/* TON Wallet row */}
        <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Connected Wallet</p>
        <div className="bg-surface rounded-2xl mx-4 px-4 py-3.5 flex items-center justify-between mb-5">
          <div>
            <p className="text-[16px] text-white">TON Wallet</p>
            <p className="text-[13px] text-label2 mt-0.5">For on-chain payments</p>
          </div>
          <TonConnectButton />
        </div>

        {/* Stars packages */}
        {!loading && hasBot && (
          <>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Top Up with Stars</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4 mb-5">
              {PACKAGES.map((pkg, i) => (
                <button
                  key={pkg.stars}
                  onClick={() => handleBuyStars(pkg)}
                  disabled={buying === pkg.credits || webhookOk === false}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-elevated transition-colors disabled:opacity-50 ${i < PACKAGES.length - 1 ? "border-b border-sep" : ""}`}
                >
                  <div className="w-9 h-9 rounded-[8px] bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Star size={18} className="text-yellow-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[16px] text-white">{pkg.credits} credits</p>
                    <p className="text-[13px] text-label2">{pkg.label}</p>
                  </div>
                  {buying === pkg.credits
                    ? <Loader2 size={17} className="text-label2 animate-spin" />
                    : (
                      <div className="flex items-center gap-1">
                        <Star size={13} className="text-yellow-400" />
                        <span className="text-[15px] font-semibold text-white">{pkg.stars}</span>
                        <ChevronRight size={17} strokeWidth={2.5} className="text-sep ml-1" />
                      </div>
                    )
                  }
                </button>
              ))}
            </div>
          </>
        )}

        {/* Dev top-up — always visible in development, otherwise only when no bot token */}
        {!loading && (!hasBot || process.env.NODE_ENV === "development") && (
          <>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Add Credits</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4 mb-5">
              {DEV_TOPUPS.map((pkg, i) => (
                <button
                  key={pkg.credits}
                  onClick={() => handleDevTopup(pkg.credits)}
                  disabled={buying === pkg.credits}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-elevated transition-colors disabled:opacity-50 ${i < DEV_TOPUPS.length - 1 ? "border-b border-sep" : ""}`}
                >
                  <div className="w-9 h-9 rounded-[8px] bg-ribbit/20 flex items-center justify-center flex-shrink-0">
                    <Plus size={18} className="text-ribbit" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[16px] text-white">{pkg.label}</p>
                    <p className="text-[13px] text-label2">Test credits</p>
                  </div>
                  {buying === pkg.credits
                    ? <Loader2 size={17} className="text-label2 animate-spin" />
                    : <ChevronRight size={17} strokeWidth={2.5} className="text-sep" />
                  }
                </button>
              ))}
            </div>
          </>
        )}

        {/* Transaction history */}
        {!loading && txns.length > 0 && (
          <>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">History</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {txns.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${i < txns.length - 1 ? "border-b border-sep" : ""}`}
                >
                  <div className="w-9 h-9 rounded-[8px] bg-red-500/15 flex items-center justify-center flex-shrink-0">
                    <ArrowDownLeft size={17} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {tx.type === "subscription" ? (
                      <>
                        <p className="text-[15px] text-white truncate">{tx.subscription?.tierName ?? "Subscription"}</p>
                        <p className="text-[13px] text-label2 truncate">{tx.subscription?.creatorName} · {new Date(tx.paidAt).toLocaleDateString()}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[15px] text-white truncate">{tx.post?.title ?? "Unlock"}</p>
                        <p className="text-[13px] text-label2">{new Date(tx.paidAt).toLocaleDateString()}</p>
                      </>
                    )}
                  </div>
                  <span className="text-[15px] font-semibold text-red-400">-{tx.paidCredits}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && txns.length === 0 && (
          <div className="flex flex-col items-center py-10">
            <ArrowUpRight size={32} className="text-sep mb-2" />
            <p className="text-[15px] text-label2">No transactions yet</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
