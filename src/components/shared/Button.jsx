import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import HelpIconTooltip from './HelpIconTooltip';

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
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';
  const baseStyles = 'rounded-lg px-4 py-2 text-sm border transition-all duration-200';
  
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

  const buttonContent = loading ? (
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {loadingText || children}
    </div>
  ) : children;

  return (
    <div className="inline-flex items-center gap-2">
      <Comp
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`
          ${baseStyles}
          ${variants[variant]}
          ${!className.includes('hover:bg-') ? defaultHoverStyles[variant] : ''}
          ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      >
        {buttonContent}
      </Comp>
      {showHelpIcon && <HelpIconTooltip tooltip={tooltip} triggerMode={triggerMode} />}
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
  loadingText: PropTypes.string
};

Button.displayName = 'Button';

export default Button; 