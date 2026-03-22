"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Users, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from "@ton/core";
import { BottomNav } from "../../../components/BottomNav";
import { useInitData } from "../../../components/TelegramProvider";
import { createApiClient } from "../../../lib/api-client";

interface Post {
  id: string; title: string; description?: string | null;
  contentType: string; contentUrl?: string; previewUrl?: string | null;
  accessType: string; creditPrice: number;
  groupUnlockTarget?: number | null; groupUnlockCurrent: number;
  creator?: { id: string; displayName: string; avatarUrl?: string | null };
  isUnlocked?: boolean; userBalance?: number;
}

const CREDITS_PER_TON = parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10);

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initData = useInitData();
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();

  useEffect(() => {
    if (initData === null) return; // wait until TelegramProvider is ready
    createApiClient(initData)(`/api/posts/${id}/preview`)
      .then((r) => r.json())
      .then((data) => {
        setPost(data);
        // Preview now returns contentUrl + isUnlocked:true if user has already
        // paid or is subscribed — no extra request or charge needed.
        if (data.isUnlocked && data.contentUrl) {
          setContentUrl(data.contentUrl);
        }
      })
      .finally(() => setLoading(false));
  }, [id, initData]);

  const handleUnlock = async () => {
    if (!post) return;
    setUnlocking(true);
    setError(null);
    const apiFetch = createApiClient(initData);
    try {
      const res = await apiFetch(`/api/posts/${id}/content`);

      if (res.ok) { const data = await res.json(); setContentUrl(data.contentUrl); setUnlocking(false); return; }
      if (res.status !== 402) { setError("Unexpected error. Please try again."); setUnlocking(false); return; }

      const paymentRequiredHeader = res.headers.get("PAYMENT-REQUIRED");
      if (!paymentRequiredHeader) { setError("Payment info missing."); setUnlocking(false); return; }

      let paymentDetails: { accepts: Array<{ amount: string; payTo: string; asset: string; queryId?: string }> };
      try { paymentDetails = JSON.parse(atob(paymentRequiredHeader)); }
      catch { setError("Could not decode payment details."); setUnlocking(false); return; }

      const payInfo = paymentDetails.accepts?.[0];
      if (!payInfo) { setError("No payment method available."); setUnlocking(false); return; }

      if (!wallet) { await tonConnectUI.openModal(); setUnlocking(false); return; }

      const queryId = payInfo.queryId ?? `${Date.now()}`;
      const commentPayload = beginCell()
        .storeUint(0, 32).storeStringTail(`x402:${queryId}`)
        .endCell().toBoc().toString("base64");

      let result: { boc: string };
      try {
        result = await tonConnectUI.sendTransaction({
          validUntil: Math.floor(Date.now() / 1000) + 360,
          messages: [{ address: payInfo.payTo, amount: payInfo.amount, payload: commentPayload }],
        });
      } catch { setError("Transaction cancelled or failed."); setUnlocking(false); return; }

      const payRes = await apiFetch(`/api/posts/${id}/pay`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boc: result.boc, queryId, fromAddress: wallet.account.address }),
      });

      if (!payRes.ok) { const d = await payRes.json().catch(() => ({})); setError(d.error ?? "Payment verification failed."); setUnlocking(false); return; }

      const payData = await payRes.json();
      setContentUrl(payData.contentUrl);
      if (payData.txHash) setTxHash(payData.txHash);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setUnlocking(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader2 size={24} className="text-tg-blue animate-spin" />
    </div>
  );
  if (!post) return <div className="min-h-screen bg-bg flex items-center justify-center text-label2 text-[15px]">Post not found</div>;

  const isUnlocked = contentUrl !== null;
  const isLocked = post.accessType !== "FREE" && !isUnlocked;

  return (
    <div className="min-h-screen bg-bg font-sans">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl h-14 flex items-center px-2">
        <div className="max-w-mobile mx-auto w-full flex items-center gap-1">
          <button onClick={() => router.back()} className="flex items-center gap-0.5 text-tg-blue px-2 py-2">
            <ChevronLeft size={22} strokeWidth={2.2} />
            <span className="text-[17px]">Back</span>
          </button>
        </div>
      </header>

      <main className="max-w-mobile mx-auto pb-28">
        {/* Media */}
        <div className="mx-4 mt-2">
          {isUnlocked ? (
            <>
              {post.contentType === "IMAGE" && <img src={contentUrl!} alt={post.title} className="w-full rounded-2xl" />}
              {post.contentType === "VIDEO" && <video src={contentUrl!} controls className="w-full rounded-2xl" />}
              {post.contentType === "AUDIO" && (
                <div className="bg-surface rounded-2xl p-5">
                  <audio src={contentUrl!} controls className="w-full" />
                </div>
              )}
              {(post.contentType === "TEXT" || post.contentType === "FILE") && (
                <div className="bg-surface rounded-2xl p-4">
                  <a href={contentUrl!} target="_blank" rel="noopener noreferrer"
                    className="text-tg-blue text-[15px] flex items-center gap-2">
                    <ExternalLink size={16} />View Content
                  </a>
                </div>
              )}
              {txHash && !txHash.startsWith("sim-") && (
                <div className="flex items-center gap-1.5 mt-2.5 text-[13px] text-label2">
                  <CheckCircle2 size={13} className="text-ribbit" />
                  <a href={`https://testnet.tonscan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="text-tg-blue flex items-center gap-0.5">
                    Verified on TON <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </>
          ) : (
            post.previewUrl ? (
              <div className="relative">
                <img src={post.previewUrl} alt="" className="w-full rounded-2xl blur-md opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-surface/80 backdrop-blur rounded-2xl px-5 py-3 flex items-center gap-2">
                    <Lock size={16} className="text-label2" />
                    <span className="text-[15px] text-white font-medium">Locked</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-2xl h-44 flex items-center justify-center">
                <Lock size={30} className="text-elevated" />
              </div>
            )
          )}
        </div>

        {/* Info */}
        <div className="px-4 mt-4">
          {post.creator && (
            <p className="text-[13px] text-label2 mb-1">{post.creator.displayName}</p>
          )}
          <h1 className="text-[20px] font-bold text-white leading-snug">{post.title}</h1>
          {post.description && (
            <p className="text-[15px] text-label2 mt-2 leading-relaxed">{post.description}</p>
          )}
        </div>

        {/* Group unlock progress */}
        {post.accessType === "GROUP_UNLOCK" && !isUnlocked && (
          <div className="mx-4 mt-4 bg-surface rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-[13px] text-label2"><Users size={13} />Group Unlock</div>
              <span className="text-[13px] font-semibold text-white">{post.groupUnlockCurrent} / {post.groupUnlockTarget}</span>
            </div>
            <div className="h-2 bg-elevated rounded-full overflow-hidden">
              <div className="h-full bg-ribbit rounded-full" style={{ width: `${Math.min(100, ((post.groupUnlockCurrent ?? 0) / (post.groupUnlockTarget ?? 1)) * 100)}%` }} />
            </div>
            <p className="text-[12px] text-label2 mt-1.5">{(post.groupUnlockTarget ?? 0) - (post.groupUnlockCurrent ?? 0)} more to unlock for everyone</p>
          </div>
        )}

        {/* Unlock CTA */}
        {isLocked && (
          <div className="px-4 mt-6">
            {error && (
              <div className="bg-red-950/50 border border-red-500/20 text-red-400 text-[13px] rounded-xl p-3 mb-3">{error}</div>
            )}
            {!wallet && (
              <button onClick={() => tonConnectUI.openModal()}
                className="w-full bg-surface text-tg-blue font-semibold py-4 rounded-2xl text-[17px] mb-3 active:opacity-80">
                Connect Wallet
              </button>
            )}
            {post.accessType !== "SUBSCRIBERS_ONLY" ? (
              <>
                <button onClick={handleUnlock} disabled={unlocking}
                  className="w-full bg-tg-blue text-white font-semibold py-4 rounded-2xl text-[17px] disabled:opacity-50 flex items-center justify-center gap-2 active:opacity-80">
                  {unlocking
                    ? <><Loader2 size={18} className="animate-spin" />Processing…</>
                    : <><Lock size={17} />Unlock · {post.creditPrice} credits</>
                  }
                </button>
                {post.userBalance !== undefined && (
                  <p className="text-center text-[12px] text-label2 mt-2">
                    Your balance: {post.userBalance} credits
                    {post.userBalance < post.creditPrice && " — top up in Wallet"}
                  </p>
                )}
              </>
            ) : (
              <div className="bg-surface rounded-2xl p-4 text-center">
                <p className="text-[15px] text-label2">Subscribers only — join a tier on the creator&apos;s profile</p>
              </div>
            )}
            <p className="text-center text-[12px] text-label2 mt-2">1 TON = {CREDITS_PER_TON} credits</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
