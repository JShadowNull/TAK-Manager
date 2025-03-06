import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  autoScroll?: boolean;
  content?: any; // Content to watch for changes
  flexHeight?: boolean; // Whether to use flexible height based on content
  maxHeight?: string; // Optional max height for flex mode
}

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, autoScroll = false, content, flexHeight = false, maxHeight, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = React.useCallback(() => {
    if (viewportRef.current) {
      const scrollContainer = viewportRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, []);

  // Scroll on content change
  React.useEffect(() => {
    if (!autoScroll || !viewportRef.current) return;

    // Immediate scroll
    scrollToBottom();

    // Delayed scroll to handle dynamic content
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [autoScroll, content, children, scrollToBottom]);

  // Set up resize observer to handle dynamic height changes
  React.useEffect(() => {
    if (!autoScroll || !viewportRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom();
    });

    resizeObserver.observe(viewportRef.current);
    return () => resizeObserver.disconnect();
  }, [autoScroll, scrollToBottom]);

  // For flexHeight mode, we need to use a different approach
  if (flexHeight) {
    return (
      <div 
        className={cn("overflow-auto rounded-md", className)}
        style={maxHeight ? { maxHeight } : undefined}
        {...props as any}
      >
        {children}
      </div>
    );
  }

  // Standard ScrollArea with fixed height
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden h-full", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport 
        ref={viewportRef}
        className="h-full w-full rounded-[inherit] break-words"
        style={{ 
          overflowWrap: 'break-word', 
          wordBreak: 'break-all'
        }}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
})
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
