import { Link } from "react-router-dom";
import { Button, Logo } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="course-code mt-10 text-[96px] leading-none text-slate/40">404</p>
      <h1 className="mt-2 text-xl font-bold">This page isn't on the shelf</h1>
      <p className="mt-1 text-slate">The link may be old, or the room may have closed.</p>
      <Link to="/" className="mt-6">
        <Button variant="secondary">Go to the homepage</Button>
      </Link>
    </div>
  );
}
