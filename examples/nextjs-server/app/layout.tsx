import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { TelegramProvider } from "../components/TelegramProvider";
import { TonConnectProvider } from "../components/TonConnectProvider";

export const metadata: Metadata = {
  title: "Ribbit",
  description: "Creator monetization on TON",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-bg" suppressHydrationWarning>
      <body className="bg-bg text-white antialiased" suppressHydrationWarning>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramProvider>
          <TonConnectProvider>{children}</TonConnectProvider>
        </TelegramProvider>
      </body>
    </html>
  );
}
