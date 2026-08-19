import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@aigarth/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground",
        success:
          "border-transparent bg-mint-100 dark:bg-mint-900/30 text-mint-700 dark:text-mint-300",
        warning:
          "border-transparent bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
        glow: "border-garden-500/30 bg-garden-500/10 text-garden-600 dark:text-garden-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

