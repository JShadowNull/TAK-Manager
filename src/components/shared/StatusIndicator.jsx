import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCircleCheck, 
  faCircleXmark, 
  faSpinner,
  faCircleInfo
} from '@fortawesome/free-solid-svg-icons';

function StatusIndicator({ 
  status = 'idle',
  text,
  className = ''
}) {
  const statusConfig = {
    idle: {
      icon: faCircleInfo,
      color: 'text-gray-400'
    },
    loading: {
      icon: faSpinner,
      color: 'text-blue-400',
      spin: true
    },
    success: {
      icon: faCircleCheck,
      color: 'text-green-400'
    },
    error: {
      icon: faCircleXmark,
      color: 'text-red-500'
    }
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <FontAwesomeIcon
        icon={config.icon}
        className={`${config.color} ${config.spin ? 'animate-spin' : ''}`}
      />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}

StatusIndicator.propTypes = {
  status: PropTypes.oneOf(['idle', 'loading', 'success', 'error']),
  text: PropTypes.string,
  className: PropTypes.string
};

export default StatusIndicator; 