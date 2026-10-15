import { Link } from "react-router-dom";
import { Button, Logo } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <p className="course-code mt-10 text-[104px] leading-none text-ink-3/50">404</p>
      <h1 className="display mt-2 text-[24px]">This page isn't on the shelf</h1>
      <p className="mt-1 text-ink-2">The link may be old, or the room may have closed.</p>
      <Link to="/" className="mt-6">
        <Button variant="secondary">Go to the homepage</Button>
      </Link>
    </div>
  );
}
