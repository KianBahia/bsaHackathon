"use client";
import { useEffect, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

// Prefer a permanent IPFS-hosted manifest (required for wallets to fetch it
// independently of ngrok/localhost). Falls back to the local API route for
// browser-only dev testing where the wallet is not involved.
const MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  `${APP_URL}/api/tonconnect-manifest`;

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only mount TonConnectUIProvider on the client to avoid SSR/React 19
  // hydration conflicts with @tonconnect/ui-react's bundled React copy.
  if (!mounted) return <>{children}</>;

  return (
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      actionsConfiguration={
        BOT_USERNAME
          ? { twaReturnUrl: `https://t.me/${BOT_USERNAME}` as `https://${string}` }
          : undefined
      }
    >
      {children}
    </TonConnectUIProvider>
  );
}
