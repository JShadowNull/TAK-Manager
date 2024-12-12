import React from 'react';
import PropTypes from 'prop-types';

function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  className = '',
  type = 'button'
}) {
  const baseStyles = 'rounded-lg px-4 py-2 text-sm border transition-all duration-200';
  
  const variants = {
    primary: 'text-buttonTextColor border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:bg-selectedColor',
    secondary: 'text-buttonTextColor border-buttonBorder bg-transparent hover:bg-buttonColor/10',
    danger: 'text-red-500 border-red-500 bg-transparent hover:bg-red-500/10'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

export default Button; 