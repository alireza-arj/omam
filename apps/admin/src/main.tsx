import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { SessionProvider } from "./lib/session";
import { ThemeProvider, ToastProvider } from "./lib/ui";
import { ApiError } from "./lib/api";
import "./styles/taraz.css";

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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
