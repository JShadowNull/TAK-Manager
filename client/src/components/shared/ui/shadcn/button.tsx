import React, { forwardRef } from 'react';
import type { ReactNode, ElementType } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { HelpIconTooltip } from './tooltip/HelpIconTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip/tooltip';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 break-words whitespace-normal rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-2 py-2 min-h-fit",
        icon: "w-10 h-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  asChild?: boolean;
  tooltip?: string;
  showHelpIcon?: boolean;
  triggerMode?: 'click' | 'hover';
  loading?: boolean;
  loadingText?: string;
  tooltipStyle?: 'material' | 'shadcn';
  tooltipDelay?: number;
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export type { ButtonProps };

type ButtonComponent = ElementType<any>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
  type = 'button',
  asChild = false,
  tooltip = '',
  showHelpIcon = false,
  triggerMode = 'click',
  loading = false,
  loadingText = '',
  tooltipStyle = 'material',
  tooltipDelay = 200,
  tooltipPosition = 'top',
  leadingIcon = null,
  trailingIcon = null,
  iconOnly = false,
  size,
  href,
  target,
  rel,
  ...rest
}, ref) => {
  const Component = href ? ('a' as ButtonComponent) : asChild ? Slot : ('button' as ButtonComponent);

  const linkProps = href ? {
    href,
    target,
    rel: rel || (target === '_blank' ? 'noopener noreferrer' : undefined)
  } : {};

  const renderContent = (): ReactNode => {
    if (loading) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingText || children}
        </>
      );
    }

    return (
      <>
        {leadingIcon && <span className="inline-flex items-center">{leadingIcon}</span>}
        {!iconOnly && children}
        {trailingIcon && <span className="inline-flex items-center">{trailingIcon}</span>}
      </>
    );
  };

  const buttonElement = (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({
          variant,
          size: iconOnly ? 'icon' : 'default',
          className
        }),
        (disabled || loading) && !className.includes('opacity-') ? 'opacity-50 cursor-not-allowed' : '',
      )}
      {...(href ? linkProps : {})}
      {...rest}
    >
      {renderContent()}
    </Component>
  );

  // If using shadcn tooltip
  if (tooltip && !showHelpIcon && tooltipStyle === 'shadcn') {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={tooltipDelay}>
          <TooltipTrigger asChild>
            {buttonElement}
          </TooltipTrigger>
          <TooltipContent side={tooltipPosition}>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // If using Material-UI tooltip
  if (tooltip && !showHelpIcon && tooltipStyle === 'material') {
    return (
      <HelpIconTooltip 
        tooltip={tooltip}
        triggerMode={triggerMode}
        showIcon={false}
        tooltipDelay={tooltipDelay}
      >
        {buttonElement}
      </HelpIconTooltip>
    );
  }

  // If there's a help icon or no tooltip, use the original layout
  return (
    <div className="inline-flex items-center gap-2">
      {buttonElement}
      {showHelpIcon && (
        <HelpIconTooltip 
          tooltip={tooltip} 
          triggerMode={triggerMode}
          className="flex items-center"
        />
      )}
    </div>
  );
});

Button.displayName = 'Button';

export { Button, buttonVariants };
