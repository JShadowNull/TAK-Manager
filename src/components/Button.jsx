const Button = ({ text, hoverColor = "green", type = "button", additionalClasses = "", onClick, disabled }) => (
  <button 
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`
      text-buttonTextColor 
      rounded-lg 
      p-2 
      text-sm 
      border-1 
      border-buttonBorder 
      bg-buttonColor 
      hover:text-black 
      hover:shadow-soft 
      hover:border-black 
      hover:shadow-black 
      hover:bg-${hoverColor}-500 
      transition-colors
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      ${additionalClasses}
    `.replace(/\s+/g, ' ').trim()}
  >
    {text}
  </button>
);

export default Button; 