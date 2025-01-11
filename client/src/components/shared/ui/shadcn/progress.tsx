import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Whether the progress is in indeterminate state */
  isIndeterminate?: boolean;
  /** Optional text to display */
  text?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, isIndeterminate, text, ...props }, ref) => (
  <div className="w-full">
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 bg-primary transition-all",
          isIndeterminate && "absolute inset-0 flex-1 translate-x-[-100%] animate-[indeterminate_1s_ease-in-out_infinite]"
        )}
        style={!isIndeterminate ? { transform: `translateX(-${100 - (value || 0)}%)` } : undefined}
      />
    </ProgressPrimitive.Root>
    {text && (
      <div className="mt-2 text-sm text-muted-foreground">
        {text}
      </div>
    )}
  </div>
))

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
export type { ProgressProps }
