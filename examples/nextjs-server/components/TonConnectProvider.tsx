"use client";
import { Component, ReactNode, useEffect, useState } from "react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";


const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

const MANIFEST_URL =
  process.env.NEXT_PUBLIC_TONCONNECT_MANIFEST_URL ??
  `${APP_URL}/api/tonconnect-manifest`;

// Error boundary that catches TonConnect "provider not set" errors during the
// brief window before the provider mounts. Once mounted it clears and re-renders.
class TonConnectErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    if (this.state.hasError) this.setState({ hasError: false });
  }

  render() {
    // Swallow the error — the provider will mount on the next tick and re-render
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function TonConnectProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Wrap in error boundary so any TonConnect hook calls before mount
    // are silently caught rather than crashing the whole page.
    return <TonConnectErrorBoundary>{children}</TonConnectErrorBoundary>;
  }

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
