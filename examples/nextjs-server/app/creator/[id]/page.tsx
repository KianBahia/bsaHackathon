"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronLeft, Users } from "lucide-react";
import { PostCard } from "../../../components/PostCard";
import { BottomNav } from "../../../components/BottomNav";
import { useInitData } from "../../../components/TelegramProvider";
import { createApiClient } from "../../../lib/api-client";

interface SubscriptionTier { id: string; name: string; creditsPerMonth: number; description?: string | null; perks?: string | null; }
interface Post { id: string; title: string; description?: string | null; contentType: string; previewUrl?: string | null; accessType: string; creditPrice: number; groupUnlockTarget?: number | null; groupUnlockCurrent: number; isUnlocked?: boolean; }
interface Creator { id: string; displayName: string; bio?: string | null; avatarUrl?: string | null; tiers: SubscriptionTier[]; _count: { subscriptions: number }; posts: Post[]; }

export default function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  // Set of tier IDs the user is actively subscribed to for this creator
  const [subscribedTiers, setSubscribedTiers] = useState<Set<string>>(new Set());
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [lastCharged, setLastCharged] = useState<number | null>(null);
  const initData = useInitData();

  useEffect(() => {
    if (initData === null) return;
    const api = createApiClient(initData);
    Promise.all([
      api(`/api/creators/${id}`).then((r) => r.json()),
      api(`/api/subscriptions`).then((r) => r.json()),
      api(`/api/wallet/balance`).then((r) => r.json()),
    ]).then(([creatorData, subs, walletData]) => {
      setCreator(creatorData);
      setUserBalance(walletData.creditBalance ?? 0);
      const active = new Set<string>(
        (Array.isArray(subs) ? subs : [])
          .filter((s: any) => s.creator?.id === id && s.status === "ACTIVE")
          .map((s: any) => s.tier?.id)
          .filter(Boolean)
      );
      setSubscribedTiers(active);
    }).finally(() => setLoading(false));
  }, [id, initData]);

  const handleSubscribe = async (tierId: string) => {
    setSubscribing(tierId);
    try {
      const res = await createApiClient(initData)("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, creatorId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubscribedTiers((prev) => new Set(prev).add(tierId));
        if (data.creditsCharged != null) {
          setLastCharged(data.creditsCharged);
          setUserBalance((prev) => (prev != null ? prev - data.creditsCharged : null));
        }
      } else {
        alert(data.error ?? "Failed to subscribe");
      }
    } finally {
      setSubscribing(null);
    }
  };

  const handleUnsubscribe = async (tierId: string) => {
    const confirmed = window.confirm("Unsubscribe? You will lose access to subscriber-only content.");
    if (!confirmed) return;

    setSubscribing(tierId);
    try {
      const res = await createApiClient(initData)("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: id }),
      });
      if (res.ok) {
        setSubscribedTiers((prev) => {
          const next = new Set(prev);
          next.delete(tierId);
          return next;
        });
      } else {
        alert("Failed to unsubscribe");
      }
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-tg-blue border-t-transparent animate-spin" />
    </div>
  );
  if (!creator) return (
    <div className="min-h-screen bg-bg flex items-center justify-center text-label2 text-[15px]">Creator not found</div>
  );

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
        {/* Profile header */}
        <div className="flex flex-col items-center pt-4 pb-6 px-4">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-elevated mb-3 ring-[3px] ring-sep">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt={creator.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-semibold text-label2 bg-surface">
                {creator.displayName[0]}
              </div>
            )}
          </div>
          <h1 className="text-[22px] font-bold text-white">{creator.displayName}</h1>
          {creator.bio && <p className="text-[14px] text-label2 text-center mt-1 leading-snug max-w-xs">{creator.bio}</p>}
          <div className="flex items-center gap-1.5 mt-2 text-[13px] text-label2">
            <Users size={13} /><span>{creator._count.subscriptions} subscribers</span>
          </div>
        </div>

        {/* Tiers */}
        {creator.tiers.length > 0 && (
          <div className="mb-5">
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Membership</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {creator.tiers.map((tier, i) => {
                const isSubscribed = subscribedTiers.has(tier.id);
                const isBusy = subscribing === tier.id;
                const perks: string[] = tier.perks
                  ? tier.perks.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)
                  : [];
                return (
                  <div key={tier.id} className={`px-4 py-3.5 ${i < creator.tiers.length - 1 ? "border-b border-sep" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[16px] text-white font-medium">{tier.name}</p>
                        <p className="text-[13px] text-ribbit font-medium mt-0.5">{tier.creditsPerMonth} credits / month</p>
                        {tier.description && <p className="text-[13px] text-label2 mt-1 leading-snug">{tier.description}</p>}
                        {perks.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {perks.map((p, j) => (
                              <li key={j} className="flex items-center gap-1.5 text-[13px] text-label2">
                                <Check size={12} className="text-ribbit flex-shrink-0" />{p}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {isSubscribed ? (
                        <button
                          onClick={() => handleUnsubscribe(tier.id)}
                          disabled={isBusy}
                          className="flex-shrink-0 flex items-center gap-1.5 bg-ribbit/15 text-ribbit text-[14px] font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50 transition-opacity"
                        >
                          {isBusy ? "…" : <><CheckCircle2 size={14} />Joined</>}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(tier.id)}
                          disabled={isBusy}
                          className="flex-shrink-0 bg-tg-blue text-white text-[14px] font-semibold px-4 py-1.5 rounded-xl disabled:opacity-50 transition-opacity"
                        >
                          {isBusy ? "…" : "Join"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {userBalance !== null && (
              <p className="text-[12px] text-label2 text-center mt-2 px-4">
                Your balance: {userBalance} credits
                {lastCharged != null && lastCharged > 0 && (
                  <span className="text-ribbit ml-1">· {lastCharged} credits charged</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Posts */}
        <div>
          <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Posts</p>
          {creator.posts.length === 0 ? (
            <p className="text-[15px] text-label2 text-center py-10">No posts yet</p>
          ) : (
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {creator.posts.map((post, i) => (
                <div key={post.id} className={i < creator.posts.length - 1 ? "border-b border-sep" : ""}>
                  <PostCard post={post} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
