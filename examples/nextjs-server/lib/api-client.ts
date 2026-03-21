"use client";

export function createApiClient(initData: string | null) {
  return async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
    const headers = new Headers(options?.headers);
    if (initData) {
      headers.set("x-telegram-init-data", initData);
    }
    return fetch(url, { ...options, headers });
  };
}
