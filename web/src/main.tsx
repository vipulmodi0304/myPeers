import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { ApiError } from "./lib/api";
import { router } from "./router";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/archivo/wdth-italic.css";
import "@fontsource/fragment-mono/400.css";
import "@fontsource-variable/shantell-sans/full.css";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime events keep data fresh, so don't refetch on every focus.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Don't retry requests that failed for a reason retrying won't fix.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* "user": motion follows the device's reduce-motion setting everywhere. */}
      <MotionConfig reducedMotion="user">
        <LazyMotion strict features={() => import("./lib/motionFeatures").then((m) => m.default)}>
          <RouterProvider router={router} />
        </LazyMotion>
      </MotionConfig>
      <Toaster
        position="bottom-right"
        mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
        toastOptions={{
          className: "!bg-paper !text-ink !border !border-rule-strong !font-sans !rounded-[10px] !shadow-sheet",
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
