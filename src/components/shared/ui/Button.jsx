import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { HelpIconTooltip } from './shadcn/tooltip/HelpIconTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './shadcn/tooltip/tooltip';

const Button = forwardRef(({ 
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
  href = '',
  target = '',
  rel = '',
  ...props
}, ref) => {
  const Comp = href && !asChild ? 'a' : asChild ? Slot : 'button';
  
  // Define linkProps object
  const linkProps = href ? {
    href,
    target,
    rel: rel || (target === '_blank' ? 'noopener noreferrer' : undefined)
  } : {};

  const baseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';
  const paddingStyles = iconOnly ? 'h-10 w-10' : 'h-10 px-4 py-2';

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline'
  };

  const defaultHoverStyles = {
    primary: 'hover:bg-primary/90',
    secondary: 'hover:bg-secondary/80', 
    danger: 'hover:bg-destructive/90',
    outline: 'hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'hover:underline'
  };

  const renderContent = () => {
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
    <Comp
      ref={ref}
      type={!href ? type : undefined}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${paddingStyles}
        ${variants[variant]}
        ${!className.includes('hover:bg-') ? defaultHoverStyles[variant] : ''}
        ${(disabled || loading) && !className.includes('opacity-') ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...linkProps}
      {...props}
    >
      {renderContent()}
    </Comp>
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
        delay={tooltipDelay}
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

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  asChild: PropTypes.bool,
  tooltip: PropTypes.string,
  showHelpIcon: PropTypes.bool,
  triggerMode: PropTypes.oneOf(['click', 'hover']),
  loading: PropTypes.bool,
  loadingText: PropTypes.string,
  tooltipStyle: PropTypes.oneOf(['material', 'shadcn']),
  tooltipPosition: PropTypes.oneOf(['top', 'right', 'bottom', 'left']),
  leadingIcon: PropTypes.node,
  trailingIcon: PropTypes.node,
  iconOnly: PropTypes.bool,
  tooltipDelay: PropTypes.number,
  href: PropTypes.string,
  target: PropTypes.string,
  rel: PropTypes.string,
};

Button.displayName = 'Button';

export default Button; 