import { Link } from "react-router-dom";
import { Button, Logo } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <p className="sticker poster mt-10 -rotate-3 rounded-2xl bg-surface px-5 pt-3 pb-1 text-[110px]">404</p>
      <h1 className="display mt-8 text-[30px] leading-tight">This page isn't on the shelf</h1>
      <p className="mt-1 text-ink-2">The link may be old, or the room may have closed.</p>
      <Link to="/" className="mt-6">
        <Button variant="sticker">Go to the homepage</Button>
      </Link>
    </div>
  );
}
