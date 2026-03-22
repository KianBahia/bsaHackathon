"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Users, FileText, Plus, Lock, ChevronRight,
  Star, PenLine, Check, X, Trash2, Crown, Wallet, Loader2, CheckCircle2,
} from "lucide-react";
import { useTonWallet, TonConnectButton } from "@tonconnect/ui-react";
import { BottomNav } from "../../components/BottomNav";
import { FileUpload } from "../../components/FileUpload";
import { useTelegram } from "../../components/TelegramProvider";
import { createApiClient } from "../../lib/api-client";

interface Earnings { totalCreditsEarned: number; unlockCredits: number; subscriptionCredits: number; subscriberCount: number; postCount: number; withdrawableBalance: number; }
interface Post { id: string; title: string; accessType: string; creditPrice: number; _count: { unlocks: number }; }
interface Profile { id: string; displayName: string; bio?: string | null; avatarUrl?: string | null; }
interface Tier { id: string; name: string; creditsPerMonth: number; description?: string | null; perks?: string | null; }

export default function DashboardPage() {
  const [earnings, setEarnings]     = useState<Earnings | null>(null);
  const [posts, setPosts]           = useState<Post[]>([]);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [tiers, setTiers]           = useState<Tier[]>([]);
  const [loading, setLoading]       = useState(true);
  const [notCreator, setNotCreator] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "", avatarUrl: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError]         = useState<string | null>(null);
  // Tier management state
  const [showTierForm, setShowTierForm]   = useState(false);
  const [editingTier, setEditingTier]     = useState<Tier | null>(null);
  const [tierForm, setTierForm]           = useState({ name: "", creditsPerMonth: "", description: "", perks: "" });
  const [savingTier, setSavingTier]       = useState(false);
  const [tierError, setTierError]         = useState<string | null>(null);
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);
  // Withdrawal state
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCredits, setWithdrawCredits] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ success: boolean; message: string } | null>(null);
  const { initData, user, isReady } = useTelegram();
  const tonWallet = useTonWallet();

  useEffect(() => {
    if (!isReady) return;
    const api = createApiClient(initData);
    Promise.all([
      api("/api/dashboard/earnings"),
      api("/api/dashboard/posts"),
      api("/api/dashboard/profile"),
      api("/api/dashboard/tiers"),
    ]).then(async ([e, p, pr, t]) => {
      if (e.status === 404) {
        setNotCreator(true);
        // Pre-fill display name from Telegram user for first-time setup
        if (user) {
          const fallback = user.username ? `@${user.username}` : (user.firstName ?? "");
          setProfileForm((f) => ({ ...f, displayName: f.displayName || fallback }));
        }
      } else {
        const [earningsData, postsData, profileData, tiersData] = await Promise.all([
          e.json(), p.json(), pr.json(), t.json(),
        ]);
        setEarnings(earningsData);
        setPosts(Array.isArray(postsData) ? postsData : []);
        setTiers(Array.isArray(tiersData) ? tiersData : []);
        if (profileData && !profileData.error) {
          setProfile(profileData);
          setProfileForm({
            displayName: profileData.displayName ?? "",
            bio: profileData.bio ?? "",
            avatarUrl: profileData.avatarUrl ?? "",
          });
        }
      }
      setLoading(false);
    });
  }, [isReady, initData, user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    setSaveError(null);
    try {
      const res = await createApiClient(initData)("/api/dashboard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileForm.displayName.trim(),
          bio: profileForm.bio.trim() || null,
          avatarUrl: profileForm.avatarUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setProfile(data);
      setNotCreator(false);
      setEditingProfile(false);
      setSaveError(null);
      // Reload stats now that creator exists
      const api = createApiClient(initData);
      const [e, p] = await Promise.all([api("/api/dashboard/earnings"), api("/api/dashboard/posts")]);
      if (e.ok) setEarnings(await e.json());
      if (p.ok) setPosts(await p.json().then((d: Post[] | unknown) => Array.isArray(d) ? d : []));
    } catch (err) {
      setSaveError("Network error — please try again");
    } finally {
      setSavingProfile(false);
    }
  };

  const openNewTierForm = () => {
    setEditingTier(null);
    setTierForm({ name: "", creditsPerMonth: "", description: "", perks: "" });
    setTierError(null);
    setShowTierForm(true);
  };

  const openEditTierForm = (tier: Tier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      creditsPerMonth: String(tier.creditsPerMonth),
      description: tier.description ?? "",
      perks: tier.perks ?? "",
    });
    setTierError(null);
    setShowTierForm(true);
  };

  const saveTier = async () => {
    if (!tierForm.name.trim()) { setTierError("Name is required"); return; }
    const credits = parseInt(tierForm.creditsPerMonth, 10);
    if (!credits || credits < 1) { setTierError("Price must be at least 1 credit/month"); return; }
    setSavingTier(true);
    setTierError(null);
    try {
      const api = createApiClient(initData);
      const url = editingTier ? `/api/dashboard/tiers/${editingTier.id}` : "/api/dashboard/tiers";
      const res = await api(url, {
        method: editingTier ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tierForm.name.trim(),
          creditsPerMonth: credits,
          description: tierForm.description.trim() || null,
          perks: tierForm.perks.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setTierError(data.error ?? "Save failed"); return; }
      setTiers((prev) =>
        editingTier
          ? prev.map((t) => (t.id === editingTier.id ? data : t))
          : [...prev, data]
      );
      setShowTierForm(false);
      setEditingTier(null);
    } catch {
      setTierError("Network error — please try again");
    } finally {
      setSavingTier(false);
    }
  };

  const deleteTier = async (id: string) => {
    setDeletingTierId(id);
    try {
      const res = await createApiClient(initData)(`/api/dashboard/tiers/${id}`, { method: "DELETE" });
      if (res.ok) setTiers((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingTierId(null);
    }
  };

  const handleWithdraw = async () => {
    const credits = parseInt(withdrawCredits, 10);
    const toAddress = tonWallet?.account?.address;
    if (!toAddress) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await createApiClient(initData)("/api/dashboard/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, toAddress }),
      });
      const data = await res.json();
      if (res.ok) {
        setWithdrawResult({ success: true, message: data.message ?? `${data.tonAmount} TON sent!` });
        setEarnings((prev) => prev ? { ...prev, withdrawableBalance: prev.withdrawableBalance - credits } : prev);
        setWithdrawCredits("");
      } else {
        setWithdrawResult({ success: false, message: data.error ?? "Withdrawal failed" });
      }
    } catch {
      setWithdrawResult({ success: false, message: "Network error — please try again" });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-tg-blue border-t-transparent animate-spin" />
    </div>
  );

  const displayName = profile?.displayName ?? (user?.username ? `@${user.username}` : "Creator");
  const initials = displayName.replace("@", "")[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-bg font-sans">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl h-14 flex items-center px-4">
        <div className="max-w-mobile mx-auto w-full flex items-center justify-between">
          <span className="text-[17px] font-semibold text-white">Create</span>
          {!notCreator && (
            <Link
              href="/dashboard/new-post"
              className="flex items-center gap-1.5 bg-tg-blue text-white text-[14px] font-semibold px-3.5 py-1.5 rounded-xl active:opacity-80"
            >
              <Plus size={15} />New Post
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-mobile mx-auto pb-28 pt-2">
        {/* Profile card — always shown */}
        <div className="flex flex-col items-center py-6 px-4">
          {!editingProfile ? (
            <>
              <div className="w-20 h-20 rounded-full overflow-hidden bg-surface ring-[3px] ring-sep flex items-center justify-center mb-3">
                {profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[28px] font-bold text-label2">{initials}</span>
                )}
              </div>
              <h1 className="text-[20px] font-bold text-white">{displayName}</h1>
              {profile?.bio && <p className="text-[14px] text-label2 mt-1 text-center max-w-xs">{profile.bio}</p>}
              <button
                onClick={() => setEditingProfile(true)}
                className="flex items-center gap-1.5 mt-3 text-tg-blue text-[14px]"
              >
                <PenLine size={14} />
                Edit Profile
              </button>
            </>
          ) : (
            <div className="w-full">
              {/* Avatar upload */}
              <FileUpload
                endpoint="avatar"
                value={profileForm.avatarUrl}
                onChange={(url) => setProfileForm((f) => ({ ...f, avatarUrl: url }))}
                shape="circle"
              />

              {/* Name + bio fields */}
              <div className="bg-surface rounded-2xl overflow-hidden mt-4 mb-3">
                <input
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Display name *"
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                />
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Bio — tell people what you create"
                  rows={3}
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none resize-none"
                />
              </div>

              {saveError && (
                <div className="bg-red-950/40 border border-red-500/20 text-red-400 text-[13px] rounded-xl px-4 py-3 mb-3">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setEditingProfile(false); setSaveError(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-surface text-label2 font-semibold py-3 rounded-2xl text-[15px] active:opacity-80"
                >
                  <X size={16} />Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={savingProfile || !profileForm.displayName.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-tg-blue text-white font-semibold py-3 rounded-2xl text-[15px] active:opacity-80 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <><Check size={16} />Save</>
                  )}
                </button>
              </div>
              {!profileForm.displayName.trim() && (
                <p className="text-[12px] text-label2 text-center mt-2">Display name is required</p>
              )}
            </div>
          )}
        </div>

        {notCreator && !editingProfile ? (
          /* First-time empty state */
          <div className="flex flex-col items-center px-8 text-center">
            <p className="text-[15px] text-label2 mb-6">Set up your profile to start publishing content</p>
            <button
              onClick={() => setEditingProfile(true)}
              className="w-full bg-tg-blue text-white font-semibold py-4 rounded-2xl text-[17px] active:opacity-80"
            >
              Set Up Creator Profile
            </button>
            <div className="mt-4 w-full">
              <Link href="/dashboard/new-post"
                className="w-full flex items-center justify-center gap-2 bg-surface text-white font-semibold py-4 rounded-2xl text-[17px] active:opacity-80">
                <Plus size={18} />Create First Post
              </Link>
            </div>
          </div>
        ) : !notCreator && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5 mx-4 mb-3">
              {[
                { label: "Earned",      value: earnings?.totalCreditsEarned ?? 0, Icon: TrendingUp, color: "text-ribbit" },
                { label: "Subscribers", value: earnings?.subscriberCount ?? 0,    Icon: Users,      color: "text-tg-blue" },
                { label: "Posts",       value: earnings?.postCount ?? 0,           Icon: FileText,   color: "text-label2" },
              ].map(({ label, value, Icon, color }) => (
                <div key={label} className="bg-surface rounded-2xl p-3 text-center">
                  <Icon size={17} className={`${color} mx-auto mb-1.5`} />
                  <p className="text-[22px] font-bold text-white leading-none">{value}</p>
                  <p className="text-[11px] text-label2 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Withdrawable balance + withdraw form */}
            <div className="mx-4 mb-5 bg-ribbit/10 border border-ribbit/20 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-label2">Available to withdraw</p>
                  <p className="text-[20px] font-bold text-ribbit leading-tight">
                    {earnings?.withdrawableBalance ?? 0} credits
                    <span className="text-[13px] font-normal text-label2 ml-2">
                      ≈ {((earnings?.withdrawableBalance ?? 0) / (parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10))).toFixed(2)} TON
                    </span>
                  </p>
                </div>
                {(earnings?.withdrawableBalance ?? 0) >= parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10) && (
                  <button
                    onClick={() => { setShowWithdraw((v) => !v); setWithdrawResult(null); }}
                    className="flex items-center gap-1.5 bg-ribbit/20 text-ribbit text-[13px] font-semibold px-3 py-1.5 rounded-xl active:opacity-80"
                  >
                    <Wallet size={14} />Withdraw
                  </button>
                )}
              </div>

              {showWithdraw && (
                <div className="border-t border-ribbit/20 px-4 py-3 space-y-3">
                  {/* TON wallet connection */}
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-label2">Send to wallet</p>
                    <TonConnectButton />
                  </div>

                  {tonWallet ? (
                    <>
                      <p className="text-[11px] text-label2 font-mono truncate">
                        {tonWallet.account.address}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={withdrawCredits}
                          onChange={(e) => setWithdrawCredits(e.target.value)}
                          placeholder={`Credits (min ${process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100"})`}
                          className="flex-1 bg-bg border border-ribbit/30 text-white text-[14px] px-3 py-2 rounded-xl focus:outline-none focus:border-ribbit"
                          min={parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10)}
                          max={earnings?.withdrawableBalance ?? 0}
                          step={parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10)}
                        />
                        <button
                          onClick={() => setWithdrawCredits(String(earnings?.withdrawableBalance ?? 0))}
                          className="text-[13px] text-ribbit px-3 py-2 rounded-xl bg-ribbit/10 active:opacity-70"
                        >
                          Max
                        </button>
                      </div>
                      {withdrawCredits && (
                        <p className="text-[12px] text-label2">
                          = {(parseInt(withdrawCredits, 10) / parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10)).toFixed(2)} TON
                        </p>
                      )}
                      {withdrawResult && (
                        <div className={`flex items-start gap-2 text-[13px] rounded-xl p-3 ${withdrawResult.success ? "bg-ribbit/10 text-ribbit" : "bg-red-950/40 text-red-400"}`}>
                          {withdrawResult.success && <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
                          {withdrawResult.message}
                        </div>
                      )}
                      <button
                        onClick={handleWithdraw}
                        disabled={withdrawing || !withdrawCredits || parseInt(withdrawCredits, 10) < parseInt(process.env.NEXT_PUBLIC_CREDITS_PER_TON ?? "100", 10)}
                        className="w-full flex items-center justify-center gap-2 bg-ribbit text-white font-semibold py-2.5 rounded-xl text-[15px] disabled:opacity-50 active:opacity-80"
                      >
                        {withdrawing
                          ? <><Loader2 size={16} className="animate-spin" />Sending…</>
                          : "Withdraw to TON Wallet"
                        }
                      </button>
                    </>
                  ) : (
                    <p className="text-[13px] text-label2 pb-1">Connect your TON wallet above to withdraw</p>
                  )}
                </div>
              )}
            </div>

            {/* Subscription Tiers */}
            <div className="mx-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide">Subscription Tiers</p>
                {!showTierForm && (
                  <button onClick={openNewTierForm} className="flex items-center gap-1 text-tg-blue text-[13px]">
                    <Plus size={14} />Add Tier
                  </button>
                )}
              </div>

              {/* Inline tier form */}
              {showTierForm && (
                <div className="bg-surface rounded-2xl overflow-hidden mb-3">
                  <p className="text-[13px] font-semibold text-white px-4 pt-3.5 pb-1">
                    {editingTier ? "Edit Tier" : "New Tier"}
                  </p>
                  <div className="border-t border-sep">
                    <input
                      value={tierForm.name}
                      onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Tier name *"
                      className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                    />
                    <input
                      value={tierForm.creditsPerMonth}
                      onChange={(e) => setTierForm((f) => ({ ...f, creditsPerMonth: e.target.value }))}
                      placeholder="Credits / month *"
                      type="number"
                      min={1}
                      className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                    />
                    <input
                      value={tierForm.description}
                      onChange={(e) => setTierForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Short description (optional)"
                      className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                    />
                    <textarea
                      value={tierForm.perks}
                      onChange={(e) => setTierForm((f) => ({ ...f, perks: e.target.value }))}
                      placeholder={"Perks — e.g. Early access, DMs, custom content (optional)"}
                      rows={2}
                      className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-label2 focus:outline-none resize-none"
                    />
                  </div>
                  {tierError && (
                    <div className="bg-red-950/40 border-t border-red-500/20 text-red-400 text-[13px] px-4 py-2.5">
                      {tierError}
                    </div>
                  )}
                  <div className="flex gap-0 border-t border-sep">
                    <button
                      onClick={() => { setShowTierForm(false); setEditingTier(null); setTierError(null); }}
                      className="flex-1 flex items-center justify-center gap-1.5 text-label2 py-3.5 text-[15px] border-r border-sep active:opacity-60"
                    >
                      <X size={15} />Cancel
                    </button>
                    <button
                      onClick={saveTier}
                      disabled={savingTier}
                      className="flex-1 flex items-center justify-center gap-1.5 text-tg-blue font-semibold py-3.5 text-[15px] active:opacity-60 disabled:opacity-50"
                    >
                      {savingTier
                        ? <div className="w-4 h-4 rounded-full border-2 border-tg-blue border-t-transparent animate-spin" />
                        : <><Check size={15} />{editingTier ? "Update" : "Create"}</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Tiers list */}
              {tiers.length === 0 && !showTierForm ? (
                <div className="bg-surface rounded-2xl px-4 py-6 flex flex-col items-center text-center">
                  <Crown size={24} className="text-sep mb-2" />
                  <p className="text-[14px] text-label2 mb-3">No subscription tiers yet</p>
                  <button
                    onClick={openNewTierForm}
                    className="flex items-center gap-1.5 bg-tg-blue text-white text-[13px] font-semibold px-3.5 py-2 rounded-xl active:opacity-80"
                  >
                    <Plus size={13} />Create First Tier
                  </button>
                </div>
              ) : tiers.length > 0 && (
                <div className="bg-surface rounded-2xl overflow-hidden">
                  {tiers.map((tier, i) => (
                    <div
                      key={tier.id}
                      className={`flex items-center gap-3 px-4 py-3.5 ${i < tiers.length - 1 ? "border-b border-sep" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-[8px] bg-elevated flex items-center justify-center flex-shrink-0">
                        <Crown size={16} className="text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-white truncate">{tier.name}</p>
                        <p className="text-[13px] text-label2 mt-0.5">{tier.creditsPerMonth} credits / month</p>
                        {tier.description && (
                          <p className="text-[12px] text-label2 mt-0.5 truncate">{tier.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditTierForm(tier)}
                          className="p-2 text-label2 active:text-white active:opacity-60"
                        >
                          <PenLine size={15} />
                        </button>
                        <button
                          onClick={() => deleteTier(tier.id)}
                          disabled={deletingTierId === tier.id}
                          className="p-2 text-label2 active:text-red-400 disabled:opacity-40"
                        >
                          {deletingTierId === tier.id
                            ? <div className="w-3.5 h-3.5 rounded-full border-2 border-label2 border-t-transparent animate-spin" />
                            : <Trash2 size={15} />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Posts list */}
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Your Posts</p>
            {posts.length === 0 ? (
              <div className="bg-surface rounded-2xl mx-4 px-4 py-8 flex flex-col items-center">
                <FileText size={28} className="text-sep mb-2" />
                <p className="text-[15px] text-label2 mb-4">No posts yet</p>
                <Link href="/dashboard/new-post"
                  className="flex items-center gap-1.5 bg-tg-blue text-white text-[14px] font-semibold px-4 py-2.5 rounded-xl active:opacity-80">
                  <Plus size={15} />Create Post
                </Link>
              </div>
            ) : (
              <div className="bg-surface rounded-2xl overflow-hidden mx-4">
                {posts.map((post, i) => (
                  <div
                    key={post.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${i < posts.length - 1 ? "border-b border-sep" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-[8px] bg-elevated flex items-center justify-center flex-shrink-0">
                      {post.accessType === "FREE"
                        ? <FileText size={16} className="text-label2" />
                        : post.accessType === "SUBSCRIBERS_ONLY"
                        ? <Star size={16} className="text-yellow-400" />
                        : <Lock size={16} className="text-label2" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-white truncate">{post.title}</p>
                      <p className="text-[13px] text-label2 mt-0.5">
                        {post.accessType === "FREE" ? "Free" : `${post.creditPrice} cr`}
                        {" · "}{post._count.unlocks} unlock{post._count.unlocks !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight size={17} strokeWidth={2.5} className="text-sep flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
