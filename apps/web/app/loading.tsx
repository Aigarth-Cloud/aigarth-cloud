import { Logo } from "@/components/brand/logo";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo size="lg" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-garden-500" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-garden-500 [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-garden-500 [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
