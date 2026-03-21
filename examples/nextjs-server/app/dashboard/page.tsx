"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Users, FileText, Plus, Lock, ChevronRight,
  Star, PenLine, Check, X,
} from "lucide-react";
import { BottomNav } from "../../components/BottomNav";
import { useTelegram } from "../../components/TelegramProvider";
import { createApiClient } from "../../lib/api-client";

interface Earnings { totalCreditsEarned: number; subscriberCount: number; postCount: number; }
interface Post { id: string; title: string; accessType: string; creditPrice: number; _count: { unlocks: number }; }
interface Profile { id: string; displayName: string; bio?: string | null; avatarUrl?: string | null; }

export default function DashboardPage() {
  const [earnings, setEarnings]     = useState<Earnings | null>(null);
  const [posts, setPosts]           = useState<Post[]>([]);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [notCreator, setNotCreator] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: "", bio: "", avatarUrl: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const { initData, user, isReady } = useTelegram();

  useEffect(() => {
    if (!isReady) return;
    const api = createApiClient(initData);
    Promise.all([
      api("/api/dashboard/earnings"),
      api("/api/dashboard/posts"),
      api("/api/dashboard/profile"),
    ]).then(async ([e, p, pr]) => {
      if (e.status === 404) {
        setNotCreator(true);
      } else {
        const [earningsData, postsData, profileData] = await Promise.all([
          e.json(), p.json(), pr.json(),
        ]);
        setEarnings(earningsData);
        setPosts(Array.isArray(postsData) ? postsData : []);
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
  }, [isReady, initData]);

  const saveProfile = async () => {
    setSavingProfile(true);
    const res = await createApiClient(initData)("/api/dashboard/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profileForm.displayName || undefined,
        bio: profileForm.bio || null,
        avatarUrl: profileForm.avatarUrl || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProfile(updated);
      setNotCreator(false);
      setEditingProfile(false);
      // Reload earnings/posts now that creator exists
      const api = createApiClient(initData);
      const [e, p] = await Promise.all([api("/api/dashboard/earnings"), api("/api/dashboard/posts")]);
      if (e.ok) setEarnings(await e.json());
      if (p.ok) setPosts(await p.json().then((d: Post[] | unknown) => Array.isArray(d) ? d : []));
    }
    setSavingProfile(false);
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
          <div className="w-20 h-20 rounded-full overflow-hidden bg-surface ring-[3px] ring-sep flex items-center justify-center mb-3">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[28px] font-bold text-label2">{initials}</span>
            )}
          </div>
          {!editingProfile ? (
            <>
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
            <div className="w-full mt-2">
              <div className="bg-surface rounded-2xl overflow-hidden mx-0 mb-3">
                <input
                  value={profileForm.displayName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Display name"
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                />
                <input
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Bio (optional)"
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep"
                />
                <input
                  value={profileForm.avatarUrl}
                  onChange={(e) => setProfileForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                  placeholder="Avatar URL (optional)"
                  className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingProfile(false)}
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
            <div className="grid grid-cols-3 gap-2.5 mx-4 mb-5">
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
