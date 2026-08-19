import Link from "next/link";
import { Button } from "@aigarth/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="text-7xl font-medium tracking-tight md:text-8xl text-gradient-garden">
          404
        </div>
        <h1 className="mt-4 text-2xl font-medium tracking-tight">Page not found</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/">
            <Button>Go home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Open the console</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
