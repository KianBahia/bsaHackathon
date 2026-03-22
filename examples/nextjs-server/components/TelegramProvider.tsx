"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface TelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

interface TelegramContextType {
  user: TelegramUser | null;
  initData: string | null;
  isReady: boolean;
}

const TelegramCtx = createContext<TelegramContextType>({
  user: null,
  initData: null,
  isReady: false,
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TelegramContextType>({
    user: null,
    initData: null,
    isReady: false,
  });

  useEffect(() => {
    // telegram-web-app.js is loaded via <Script strategy="beforeInteractive"> in layout.tsx
    // so window.Telegram.WebApp is always available here. Reading directly from it is
    // more reliable than going through @telegram-apps/sdk which can fail to parse
    // launch params in some Telegram client versions, causing all users to share the
    // same fallback identity.
    const twa = (window as any).Telegram?.WebApp;

    if (twa?.initData) {
      const rawUser = twa.initDataUnsafe?.user;
      setState({
        user: rawUser
          ? {
              id: rawUser.id,
              firstName: rawUser.first_name,
              lastName: rawUser.last_name,
              username: rawUser.username,
              photoUrl: rawUser.photo_url,
            }
          : null,
        initData: twa.initData,
        isReady: true,
      });
    } else {
      // Not inside Telegram (local browser dev)
      setState({
        user: { id: 123456, firstName: "Dev", username: "devuser" },
        initData: "",
        isReady: true,
      });
    }
  }, []);

  return <TelegramCtx.Provider value={state}>{children}</TelegramCtx.Provider>;
}

export const useTelegram = () => useContext(TelegramCtx);
export const useTelegramUser = () => useContext(TelegramCtx).user;
export const useInitData = () => useContext(TelegramCtx).initData;
