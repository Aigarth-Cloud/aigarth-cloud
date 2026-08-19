"use client";

/**
 * StakeButton: the public button that opens StakeModal.
 *
 * Replaces the previous "Stake" link that navigated to /ipo or the
 * material-science funnel. Now every "Stake" CTA on the marketing
 * site opens the same modal, with a context-aware label and
 * purpose. The modal handles the full Qearn flow (amount, duration,
 * tx preview, success).
 *
 * Usage:
 *
 *   <StakeButton
 *     context={{ label: "Material Research Director",
 *               purpose: "Unlock the Director ANN in the marketplace.",
 *               minStakeQubic: 3_000_000,
 *               successHref: "/dashboard" }}
 *     defaultAmount="3M"
 *   >
 *     Stake
 *   </StakeButton>
 */

import * as React from "react";
import { Coins } from "lucide-react";
import { Button, type ButtonProps } from "@aigarth/ui";
import { StakeModal } from "./StakeModal";
import type { StakeContext } from "./stake-config";

type StakeButtonProps = Omit<ButtonProps, "onClick"> & {
  /** The context shown inside the modal: what the user is unlocking. */
  context: StakeContext;
  /** Optional initial amount (parsed via parseStakeString). */
  defaultAmount?: string;
  /** Button label. Default: "Stake". */
  children?: React.ReactNode;
};

export function StakeButton({
  context,
  defaultAmount,
  children = "Stake",
  ...buttonProps
}: StakeButtonProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        {...buttonProps}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </Button>
      <StakeModal
        open={open}
        onOpenChange={setOpen}
        context={context}
        defaultAmount={defaultAmount}
      />
    </>
  );
}

/**
 * A `StakeButton` pre-configured with the default icon (Coin) and
 * the standard "Stake" label. Use this for marketplace cards and
 * the bottom of detail pages.
 */
export function StakeCTA(props: Omit<StakeButtonProps, "children">) {
  return (
    <StakeButton {...props}>
      <Coins className="mr-1.5 h-3.5 w-3.5" />
      Stake
    </StakeButton>
  );
}
