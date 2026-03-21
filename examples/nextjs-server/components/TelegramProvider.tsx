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
    // Dynamic import to prevent SSR crash
    const init = async () => {
      try {
        const sdk = await import("@telegram-apps/sdk");

        if (!sdk.isTMA()) {
          // Dev mode: use mock user
          setState({
            user: { id: 123456, firstName: "Dev", username: "devuser" },
            initData: "",
            isReady: true,
          });
          return;
        }

        sdk.init();
        // Use camelCase=true for better type inference
        const launchParams = sdk.retrieveLaunchParams(true) as {
          initData?: { user?: { id: number; firstName?: string; lastName?: string; username?: string; photoUrl?: string } };
          initDataRaw?: string;
        };
        setState({
          user: launchParams.initData?.user
            ? {
                id: launchParams.initData.user.id,
                firstName: launchParams.initData.user.firstName,
                lastName: launchParams.initData.user.lastName,
                username: launchParams.initData.user.username,
                photoUrl: launchParams.initData.user.photoUrl,
              }
            : null,
          initData: launchParams.initDataRaw ?? null,
          isReady: true,
        });
      } catch {
        // Fallback for dev
        setState({
          user: { id: 123456, firstName: "Dev", username: "devuser" },
          initData: "",
          isReady: true,
        });
      }
    };

    init();
  }, []);

  return <TelegramCtx.Provider value={state}>{children}</TelegramCtx.Provider>;
}

export const useTelegram = () => useContext(TelegramCtx);
export const useTelegramUser = () => useContext(TelegramCtx).user;
export const useInitData = () => useContext(TelegramCtx).initData;
