"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../../../../lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps extends React.ComponentProps<typeof TooltipPrimitive.Root> {
  disableHover?: boolean;
  delayDuration?: number;
}

// Add helper type for tooltip placement
export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';
export type TooltipTriggerMode = 'click' | 'hover';

const Tooltip = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Root>,
  TooltipProps
>(({ disableHover, delayDuration = 200, ...props }, ref) => (
  <TooltipPrimitive.Root 
    {...props}
    delayDuration={disableHover ? 0 : delayDuration}
    // Disable hover behavior if disableHover is true
    disableHoverableContent={disableHover}
    onOpenChange={(open) => {
      if (disableHover) {
        // In click mode, let the component handle its own open state
        props.onOpenChange?.(open);
      } else {
        // In hover mode, allow all state changes
        props.onOpenChange?.(open);
      }
    }}
  />
))
Tooltip.displayName = TooltipPrimitive.Root.displayName

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-lg break-words max-w-[20rem] bg-background border border-border px-3 py-1.5 text-sm text-muted-foreground shadow-md animate-in fade-in-50 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
