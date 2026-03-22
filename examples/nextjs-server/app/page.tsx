"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Users, ChevronRight } from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { useTelegram } from "../components/TelegramProvider";
import { createApiClient } from "../lib/api-client";

interface Creator {
  id: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  _count: { posts: number; subscriptions: number };
}

export default function HomePage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, initData, isReady } = useTelegram();
  const router = useRouter();

  useEffect(() => {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam?.startsWith("creator_")) {
      router.replace(`/creator/${startParam.slice("creator_".length)}`);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    createApiClient(initData)("/api/creators")
      .then((r) => r.json())
      .then((data) => setCreators(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [isReady, initData]);

  const filtered = creators.filter(
    (c) =>
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (c.bio ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-bg font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl pt-safe">
        <div className="max-w-mobile mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-[8px] overflow-hidden bg-ribbit flex items-center justify-center">
              <img src="/images/logo.png" alt="Ribbit" className="w-full h-full object-cover" onError={(e) => { const img = e.target as HTMLImageElement; img.src = "/logo-text-white.png"; img.onerror = () => { img.style.display = "none"; }; }} />
            </div>
            <span className="text-[17px] font-semibold text-white">Ribbit</span>
          </div>
          {user && (
            <span className="text-[13px] text-label2">{user.username ? `@${user.username}` : user.firstName}</span>
          )}
        </div>
        {/* iOS-style search */}
        <div className="max-w-mobile mx-auto px-4 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-label2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full bg-elevated rounded-[10px] pl-8 pr-4 py-2 text-[15px] text-white placeholder-label2 focus:outline-none"
            />
          </div>
        </div>
      </header>

      <main className="max-w-mobile mx-auto pb-28 pt-2">
        {loading ? (
          <div className="mx-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 px-4">
                <div className="w-11 h-11 rounded-full bg-surface animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-surface rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-label2 text-[15px] py-20">No creators found</p>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1 mt-2">
              Creators
            </p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {filtered.map((c, i) => (
                <Link key={c.id} href={`/creator/${c.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 active:bg-elevated transition-colors ${i < filtered.length - 1 ? "border-b border-sep" : ""}`}>
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-elevated flex-shrink-0">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-base font-semibold text-label2">
                          {c.displayName[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] text-white leading-snug">{c.displayName}</p>
                      <div className="flex items-center gap-1 text-[13px] text-label2 mt-0.5">
                        <Users size={11} />
                        <span>{c._count.subscriptions} subscribers</span>
                        <span className="mx-1">·</span>
                        <span>{c._count.posts} posts</span>
                      </div>
                    </div>
                    <ChevronRight size={17} strokeWidth={2.5} className="text-sep flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
