import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { FullPageSpinner } from "./components/ui";
import { SocketProvider } from "./lib/socket";

/** Signed-in layout: socket connection + navigation. Loaded lazily so the landing page stays light. */
export default function AppLayout() {
  return (
    <SocketProvider enabled>
      <AppShell>
        <Suspense fallback={<FullPageSpinner />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </SocketProvider>
  );
}
