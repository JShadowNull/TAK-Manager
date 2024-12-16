import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { HelpIconTooltip } from './HelpIconTooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './shadcn/tooltip';

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
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';
  const baseStyles = 'rounded-lg transition-all duration-200 text-sm border inline-flex items-center justify-center gap-2';
  const paddingStyles = iconOnly ? 'p-2' : 'px-4 py-2';
  
  const variants = {
    primary: 'text-buttonTextColor border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-transparent',
    secondary: 'text-buttonTextColor border-buttonBorder bg-transparent hover:text-black hover:shadow-md hover:border-transparent',
    danger: 'text-red-500 border-red-500 bg-transparent hover:text-black hover:shadow-md hover:border-transparent'
  };

  const defaultHoverStyles = {
    primary: 'hover:bg-selectedColor',
    secondary: 'hover:bg-selectedColor',
    danger: 'hover:bg-red-500'
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
      type={type}
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
};

Button.displayName = 'Button';

export default Button; 