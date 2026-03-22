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
        <Script id="suppress-tonconnect-analytics" strategy="beforeInteractive">{`
          (function(){
            var _fetch = window.fetch;
            window.fetch = function(input, init) {
              var url = String(typeof input === 'string' ? input : input && input.url ? input.url : input);
              if (url.indexOf('tonapi.io') !== -1 || url.indexOf('ton-connect') !== -1 || url.indexOf('analytics') !== -1) {
                return Promise.resolve(new Response('{}', { status: 200 }));
              }
              return _fetch.apply(this, arguments);
            };
            var _ce = console.error;
            console.error = function() {
              var m = String(arguments[0] || '');
              if (m.indexOf('TON_CONNECT_SDK') !== -1) return;
              _ce.apply(console, arguments);
            };
            window.addEventListener('unhandledrejection', function(ev) {
              var m = String((ev.reason && ev.reason.message) || ev.reason || '');
              if (m.indexOf('TON_CONNECT') !== -1 || m.indexOf('Analytics') !== -1) ev.preventDefault();
            }, true);
          })();
        `}</Script>
        <TelegramProvider>
          <TonConnectProvider>{children}</TonConnectProvider>
        </TelegramProvider>
      </body>
    </html>
  );
}
