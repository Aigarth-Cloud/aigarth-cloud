"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

export function PageHeader({
  title,
  description,
  action,
  back,
  className,
}: {
  title: string;
  description?: string;
  /**
   * Either a Button config (label/href/onClick/icon/variant) or
   * an arbitrary ReactNode to render in the action slot.
   */
  action?:
    | {
        label: string;
        href?: string;
        onClick?: () => void;
        icon?: React.ComponentType<{ className?: string }>;
        variant?: "default" | "outline" | "ghost";
      }
    | React.ReactNode;
  back?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end", className)}>
      <div>
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>
        )}
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        React.isValidElement(action) ? (
          action
        ) : typeof action === "object" && action !== null && "label" in action ? (
          action.href ? (
            <Link href={action.href}>
              <Button className="gap-1.5">
                {action.icon && <action.icon className="h-3.5 w-3.5" />}
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button onClick={action.onClick} className="gap-1.5">
              {action.icon && <action.icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          )
        ) : null
      )}
    </div>
  );
}
