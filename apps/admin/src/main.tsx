import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useNavigate, useHref } from "react-router-dom";
import { App } from "./App";
import { SessionProvider } from "./lib/session";
import { LanguageProvider } from "./lib/i18n";
import { ThemeProvider, ToastProvider } from "./lib/ui";
import { ApiError } from "./lib/api";
import { RouterProvider } from "@heroui/react";
import "./styles/taraz.css";

function HeroRouting() {
  const navigate = useNavigate();
  return <RouterProvider navigate={navigate} useHref={useHref}><App /></RouterProvider>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // An expired token is handled by the session, not by retrying it.
      retry: (count, error) => !(error instanceof ApiError) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ToastProvider>
              <BrowserRouter>
                <HeroRouting />
              </BrowserRouter>
            </ToastProvider>
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
