import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button, Logo } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper px-6">
      <header className="py-5">
        <Link to="/" aria-label="myPeers home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center pb-24">
        <p className="title text-[clamp(88px,22vw,150px)] leading-none">
          <span className="hl swipe" style={{ "--hl": "var(--you)" } as CSSProperties}>
            404
          </span>
        </p>
        <h1 className="heading mt-6 text-[28px]">This page isn't in your notes</h1>
        <p className="mt-2 text-ink-2">The link may be old, or the room may have closed.</p>
        <Link to="/" className="mt-7 w-fit">
          <Button>Go to the homepage</Button>
        </Link>
      </main>
    </div>
  );
}
