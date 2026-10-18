// Access token: memory only (lost on reload, renewed via the refresh token).
// Refresh token: sessionStorage (per tab, cleared when the tab closes).

export const REFRESH_TOKEN_KEY = 'lottery-admin.refreshToken';

export interface TokenStore {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(accessToken: string, refreshToken: string): void;
  clear(): void;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null; // storage disabled (privacy mode, sandboxed iframe)
  }
}

export function createTokenStore(storage: Storage | null = safeStorage()): TokenStore {
  let accessToken: string | null = null;
  // Fallback when sessionStorage is unavailable: keep the refresh token in memory.
  let memoryRefresh: string | null = null;

  return {
    getAccessToken: () => accessToken,
    getRefreshToken() {
      if (!storage) return memoryRefresh;
      try {
        return storage.getItem(REFRESH_TOKEN_KEY);
      } catch {
        return memoryRefresh;
      }
    },
    setTokens(access, refresh) {
      accessToken = access;
      memoryRefresh = refresh;
      try {
        storage?.setItem(REFRESH_TOKEN_KEY, refresh);
      } catch {
        /* keep in memory only */
      }
    },
    clear() {
      accessToken = null;
      memoryRefresh = null;
      try {
        storage?.removeItem(REFRESH_TOKEN_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
