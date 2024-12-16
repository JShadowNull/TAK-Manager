import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import HelpIcon from '@mui/icons-material/Help';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './shadcn/tooltip';

export const HelpIconTooltip = ({ 
  tooltip,
  iconSize = 16,
  className = '',
  triggerMode = 'click', // 'click' or 'hover'
  side = 'top',
  showIcon = true,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!tooltip) return null;

  const handleClick = useCallback((e) => {
    if (triggerMode === 'click') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(!isOpen);
    }
  }, [triggerMode, isOpen]);

  const handleOpenChange = useCallback((open) => {
    if (triggerMode === 'click') {
      // In click mode, only toggle on click (handled by handleClick)
      return;
    }
    // In hover mode, follow the hover state
    setIsOpen(open);
  }, [triggerMode]);

  const tooltipTrigger = showIcon ? (
    <div 
      className={`cursor-pointer ${className}`}
      onClick={handleClick}
    >
      <HelpIcon 
        sx={{ 
          fontSize: iconSize,
          color: isOpen ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
          transition: 'color 0.2s ease-in-out'
        }} 
      />
    </div>
  ) : children;

  return (
    <TooltipProvider>
      <Tooltip 
        open={isOpen}
        onOpenChange={handleOpenChange}
        disableHover={triggerMode === 'click'}
      >
        <TooltipTrigger asChild>
          {tooltipTrigger}
        </TooltipTrigger>
        <TooltipContent side={side}>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

HelpIconTooltip.propTypes = {
  tooltip: PropTypes.string.isRequired,
  iconSize: PropTypes.number,
  className: PropTypes.string,
  triggerMode: PropTypes.oneOf(['click', 'hover']),
  side: PropTypes.oneOf(['top', 'right', 'bottom', 'left']),
  showIcon: PropTypes.bool,
  children: PropTypes.node
};

export default HelpIconTooltip; 