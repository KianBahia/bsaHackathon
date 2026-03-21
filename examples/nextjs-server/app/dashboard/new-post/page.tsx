"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lock, Users, Star, Unlock } from "lucide-react";
import { BottomNav } from "../../../components/BottomNav";
import { useInitData } from "../../../components/TelegramProvider";
import { createApiClient } from "../../../lib/api-client";

const ACCESS_TYPES = [
  { value: "FREE",             label: "Free",             Icon: Unlock, desc: "Anyone can view" },
  { value: "ONE_TIME_UNLOCK",  label: "Pay to unlock",    Icon: Lock,   desc: "One-time credit payment" },
  { value: "SUBSCRIBERS_ONLY",label: "Subscribers only", Icon: Star,   desc: "Active subscribers" },
  { value: "GROUP_UNLOCK",     label: "Group unlock",     Icon: Users,  desc: "Unlocks when target reached" },
];

const CONTENT_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT", "FILE"];

export default function NewPostPage() {
  const router   = useRouter();
  const initData = useInitData();
  const [form, setForm] = useState({
    title: "", description: "", contentType: "IMAGE",
    contentUrl: "", previewUrl: "",
    accessType: "FREE", creditPrice: "10", groupUnlockTarget: "5",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.contentUrl) { setError("Title and content URL are required."); return; }
    setSubmitting(true); setError(null);
    const res = await createApiClient(initData)("/api/dashboard/posts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        creditPrice: parseInt(form.creditPrice) || 0,
        groupUnlockTarget: form.accessType === "GROUP_UNLOCK" ? parseInt(form.groupUnlockTarget) : null,
      }),
    });
    if (res.ok) { router.push("/dashboard"); }
    else { setError((await res.json()).error ?? "Failed to publish."); setSubmitting(false); }
  };

  const inputCls = "w-full bg-elevated rounded-xl px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none";

  return (
    <div className="min-h-screen bg-bg font-sans">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-xl h-14 flex items-center px-2">
        <div className="max-w-mobile mx-auto w-full flex items-center justify-between px-2">
          <button onClick={() => router.back()} className="flex items-center gap-0.5 text-tg-blue py-2">
            <ChevronLeft size={22} strokeWidth={2.2} />
            <span className="text-[17px]">Back</span>
          </button>
          <span className="text-[17px] font-semibold text-white">New Post</span>
          <button type="submit" form="post-form" disabled={submitting}
            className="text-[17px] font-semibold text-tg-blue disabled:opacity-40 py-2 px-2">
            {submitting ? "…" : "Post"}
          </button>
        </div>
      </header>

      <main className="max-w-mobile mx-auto pb-28 pt-2">
        <form id="post-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="mx-4 bg-red-950/40 border border-red-500/20 text-red-400 text-[13px] rounded-xl p-3">{error}</div>
          )}

          {/* Title + description */}
          <div>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Content</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              <input value={form.title} onChange={set("title")} placeholder="Title"
                className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep" />
              <textarea value={form.description} onChange={set("description")} placeholder="Description (optional)" rows={3}
                className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none resize-none" />
            </div>
          </div>

          {/* URLs */}
          <div>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Links</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              <input value={form.contentUrl} onChange={set("contentUrl")} placeholder="Content URL *"
                className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none border-b border-sep" />
              <input value={form.previewUrl} onChange={set("previewUrl")} placeholder="Preview URL (blurred teaser)"
                className="w-full bg-transparent px-4 py-3.5 text-[15px] text-white placeholder-label2 focus:outline-none" />
            </div>
          </div>

          {/* Content type */}
          <div>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Content Type</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {CONTENT_TYPES.map((t, i) => (
                <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, contentType: t }))}
                  className={`w-full flex items-center justify-between px-4 py-3.5 active:bg-elevated ${i < CONTENT_TYPES.length - 1 ? "border-b border-sep" : ""}`}>
                  <span className="text-[15px] text-white">{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                  {form.contentType === t && <div className="w-5 h-5 rounded-full bg-tg-blue flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Access type */}
          <div>
            <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Access</p>
            <div className="bg-surface rounded-2xl overflow-hidden mx-4">
              {ACCESS_TYPES.map(({ value, label, Icon, desc }, i) => (
                <button key={value} type="button" onClick={() => setForm((f) => ({ ...f, accessType: value }))}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-elevated ${i < ACCESS_TYPES.length - 1 ? "border-b border-sep" : ""}`}>
                  <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 ${form.accessType === value ? "bg-tg-blue" : "bg-elevated"}`}>
                    <Icon size={17} className={form.accessType === value ? "text-white" : "text-label2"} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-[15px] text-white">{label}</p>
                    <p className="text-[12px] text-label2">{desc}</p>
                  </div>
                  {form.accessType === value && <div className="w-5 h-5 rounded-full bg-tg-blue flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional price/target */}
          {(form.accessType === "ONE_TIME_UNLOCK" || form.accessType === "GROUP_UNLOCK") && (
            <div>
              <p className="text-[13px] font-semibold text-label2 uppercase tracking-wide px-4 mb-1">Pricing</p>
              <div className="bg-surface rounded-2xl overflow-hidden mx-4">
                <div className="flex items-center px-4 border-b border-sep">
                  <span className="text-[15px] text-white w-32">Credit price</span>
                  <input type="number" value={form.creditPrice} onChange={set("creditPrice")} min="1"
                    className="flex-1 bg-transparent py-3.5 text-[15px] text-white text-right focus:outline-none" />
                </div>
                {form.accessType === "GROUP_UNLOCK" && (
                  <div className="flex items-center px-4">
                    <span className="text-[15px] text-white w-32">Target payers</span>
                    <input type="number" value={form.groupUnlockTarget} onChange={set("groupUnlockTarget")} min="2"
                      className="flex-1 bg-transparent py-3.5 text-[15px] text-white text-right focus:outline-none" />
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
      </main>
      <BottomNav />
    </div>
  );
}
