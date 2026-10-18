import { ApiClient } from './client';
import { createApi } from './endpoints';
import { createTokenStore } from './tokens';

export * from './types';
export * from './errors';
export { ApiClient, buildQuery } from './client';
export { createApi, type Api } from './endpoints';
export { createTokenStore, REFRESH_TOKEN_KEY, type TokenStore } from './tokens';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/v1';

/** App-wide singletons. The AuthProvider wires `onAuthLost`/`onSession` handlers. */
export const tokenStore = createTokenStore();
export const apiClient = new ApiClient({ baseUrl: API_BASE_URL, tokens: tokenStore });
export const api = createApi(apiClient);
