import '@fontsource/noto-sans-lao/lao-400.css';
import '@fontsource/noto-sans-lao/lao-700.css';
import './styles/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { isApiError } from './api/errors';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Retry only transient failures; 4xx answers (validation, permission, ...) are final.
      retry: (count, error) =>
        count < 2 && (!isApiError(error) || error.code === 'NETWORK' || error.status >= 500),
    },
    mutations: { retry: false },
  },
});

// Vite `base` is /admin/; BASE_URL keeps the router in sync with it. The trailing slash is kept
// so that the home route is /admin/ (the URL nginx and `vite preview` serve), not /admin.
const basename = import.meta.env.BASE_URL;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
