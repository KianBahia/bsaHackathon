"use client";
import { useEffect, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Render children immediately (no layout shift), but only mount
  // TonConnectUIProvider on the client to avoid SSR hydration mismatch.
  if (!mounted) return <>{children}</>;

  return (
    <TonConnectUIProvider manifestUrl="/api/tonconnect-manifest">
      {children}
    </TonConnectUIProvider>
  );
}
