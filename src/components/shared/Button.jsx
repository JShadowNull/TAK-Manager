import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Slot } from '@radix-ui/react-slot';
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
  ...props
}, ref) => {
  const Comp = asChild ? Slot : 'button';
  const baseStyles = 'rounded-lg px-4 py-2 text-sm border transition-all duration-200';
  
  const variants = {
    primary: 'text-buttonTextColor border-buttonBorder bg-buttonColor hover:border-transparent hover:text-black hover:shadow-md hover:bg-selectedColor',
    secondary: 'text-buttonTextColor border-buttonBorder bg-transparent hover:bg-selectedColor hover:border-transparent hover:text-black hover:shadow-md',
    danger: 'text-red-500 border-red-500 bg-transparent hover:bg-red-500 hover:border-transparent hover:text-black hover:shadow-md'
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Comp
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={`
          ${baseStyles}
          ${variants[variant]}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
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
  triggerMode: PropTypes.oneOf(['click', 'hover'])
};

Button.displayName = 'Button';

export default Button; 