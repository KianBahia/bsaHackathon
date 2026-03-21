"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PenLine } from "lucide-react";

const tabs = [
  { href: "/", label: "Discover", Icon: Home },
  { href: "/wallet", label: "Wallet", Icon: Wallet },
  { href: "/dashboard", label: "Create", Icon: PenLine },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-sep">
      <div className="max-w-mobile mx-auto flex justify-around items-end px-2 pt-2 pb-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-[3px] px-6 py-1">
              <Icon size={25} strokeWidth={active ? 2.1 : 1.5} className={active ? "text-tg-blue" : "text-label2"} />
              <span className={`text-[10px] font-medium tracking-tight ${active ? "text-tg-blue" : "text-label2"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
