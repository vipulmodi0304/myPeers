import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { FullPageSpinner } from "./components/ui";
import { canUseApp, useMe } from "./lib/auth";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage, SignupPage, VerifyPage, ForgotPasswordPage } from "./pages/AuthPages";
import { NotFoundPage } from "./pages/NotFoundPage";

// The signed-in pages are split into their own chunks so the landing page loads fast.
const AppLayout = lazy(() => import("./AppLayout"));
const PeersPage = lazy(() => import("./pages/PeersPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const RoomsPage = lazy(() => import("./pages/RoomsPage"));
const RoomPage = lazy(() => import("./pages/RoomPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

/** Signed-in, verified users only. Everyone else is sent to the right step. */
function RequireApp() {
  const { data: me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <FullPageSpinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!canUseApp(me)) return <Navigate to="/verify" replace />;
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AppLayout />
    </Suspense>
  );
}

/** Login and signup pages bounce people who are already in. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <FullPageSpinner />;
  if (canUseApp(me)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: "/signup", element: <GuestOnly><SignupPage /></GuestOnly> },
  { path: "/forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: "/verify", element: <VerifyPage /> },
  {
    path: "/app",
    element: <RequireApp />,
    children: [
      { index: true, element: <PeersPage /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "messages/:userId", element: <MessagesPage /> },
      { path: "rooms", element: <RoomsPage /> },
      { path: "rooms/:code", element: <RoomPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
