import { m } from "motion/react";
import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { FullPageSpinner } from "./components/ui";
import { SocketProvider } from "./lib/socket";

/** Which "page" a path belongs to. Switching threads inside Messages is not a page change. */
function pageKey(pathname: string) {
  return pathname.startsWith("/app/messages") ? "/app/messages" : pathname;
}

/** Signed-in layout: socket connection + navigation. Loaded lazily so the landing page stays light. */
export default function AppLayout() {
  const { pathname } = useLocation();
  return (
    <SocketProvider enabled>
      <AppShell>
        <Suspense fallback={<FullPageSpinner />}>
          {/* Each page rises in slightly when you navigate to it. */}
          <m.div
            key={pageKey(pathname)}
            className="h-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Outlet />
          </m.div>
        </Suspense>
      </AppShell>
    </SocketProvider>
  );
}
