"use client";
import Link from "next/link";
import { Lock, LockOpen, Users, Star, Music, FileText, ImageIcon, Video, ChevronRight } from "lucide-react";

interface Post {
  id: string;
  title: string;
  description?: string | null;
  contentType: string;
  previewUrl?: string | null;
  accessType: string;
  creditPrice: number;
  groupUnlockTarget?: number | null;
  groupUnlockCurrent?: number;
  isUnlocked?: boolean;
}

const typeColor: Record<string, string> = {
  IMAGE: "bg-blue-500", VIDEO: "bg-purple-500",
  AUDIO: "bg-orange-500", TEXT: "bg-teal-500", FILE: "bg-gray-600",
};

const TypeIcon = ({ type }: { type: string }) => {
  if (type === "AUDIO") return <Music size={16} className="text-white" />;
  if (type === "VIDEO") return <Video size={16} className="text-white" />;
  if (type === "TEXT")  return <FileText size={16} className="text-white" />;
  return <ImageIcon size={16} className="text-white" />;
};

export function PostCard({ post }: { post: Post }) {
  const isPaid = post.accessType !== "FREE";
  const isUnlocked = post.isUnlocked ?? !isPaid;
  const iconBg = typeColor[post.contentType] ?? "bg-gray-600";

  const badge = () => {
    if (!isPaid) return null;
    if (isUnlocked) return null;
    if (post.accessType === "SUBSCRIBERS_ONLY") return <><Star size={11} className="inline mb-0.5" /> Subs</>;
    if (post.accessType === "GROUP_UNLOCK")     return <><Users size={11} className="inline mb-0.5" /> {post.groupUnlockCurrent}/{post.groupUnlockTarget}</>;
    return <>{post.creditPrice} credits</>;
  };

  const overlayIcon = isPaid
    ? isUnlocked
      ? <LockOpen size={11} className="text-white" />
      : <Lock size={11} className="text-white" />
    : null;

  const overlayBg = isPaid
    ? isUnlocked ? "bg-ribbit/60" : "bg-black/40"
    : "bg-black/30";

  return (
    <Link href={`/post/${post.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-elevated transition-colors">
      <div className="flex-shrink-0 w-11 h-11 rounded-[10px] overflow-hidden">
        {post.previewUrl ? (
          <div className="relative w-full h-full">
            <img src={post.previewUrl} alt="" className={`w-full h-full object-cover ${isPaid && !isUnlocked ? "blur-[2px]" : ""}`} />
            {overlayIcon && <div className={`absolute inset-0 ${overlayBg} flex items-center justify-center`}>{overlayIcon}</div>}
          </div>
        ) : (
          <div className={`relative w-full h-full ${iconBg} flex items-center justify-center`}>
            <TypeIcon type={post.contentType} />
            {overlayIcon && <div className={`absolute inset-0 ${overlayBg} flex items-center justify-center`}>{overlayIcon}</div>}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] text-white line-clamp-1 leading-snug">{post.title}</p>
        <p className="text-[13px] text-label2 mt-0.5">
          {post.contentType.charAt(0) + post.contentType.slice(1).toLowerCase()}
          {isPaid && !isUnlocked && <span className="text-label2"> · {badge()}</span>}
          {isPaid && isUnlocked && <span className="text-ribbit"> · Unlocked</span>}
        </p>
      </div>
      <ChevronRight size={17} strokeWidth={2.5} className="text-sep flex-shrink-0" />
    </Link>
  );
}
