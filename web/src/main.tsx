import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { ApiError } from "./lib/api";
import { router } from "./router";
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
        toastOptions={{
          className: "!bg-surface !text-ink !border-2 !border-ink !font-sans !rounded-2xl !shadow-[3px_3px_0_var(--hard)]",
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
