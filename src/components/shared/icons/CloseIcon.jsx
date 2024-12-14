import CancelIcon from '@mui/icons-material/Cancel';
import PropTypes from 'prop-types';

export const CloseIcon = ({ 
  color = 'currentColor',
  className = '',
  size = 'small',
  onClick
}) => (
  <div className={`flex items-center justify-center ${className}`}>
    <CancelIcon 
      sx={{ 
        color,
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          opacity: 0.8,
          transform: 'scale(1.2)'
        }
      }}
      fontSize={size}
      onClick={onClick}
      className="cursor-pointer"
    />
  </div>
); 

CloseIcon.propTypes = {
  color: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onClick: PropTypes.func
};
