import React, { useState } from 'react';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { styled } from '@mui/material/styles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

interface StyledHelpIconProps {
  $isOpen?: boolean;
}

const StyledHelpIcon = styled(HelpOutlineIcon)<StyledHelpIconProps>(({ theme, $isOpen }) => ({
  fontSize: '16px',
  color: $isOpen ? 'rgba(208, 219, 229, 1.000)' : 'rgba(86, 119, 153, 1.000)',
  transition: 'color 0.2s ease-in-out',
  '&:hover': {
    color: 'rgba(208, 219, 229, 1.000)',
  },
}));

interface HelpIconTooltipProps {
  tooltip: string;
  iconSize?: number;
  className?: string;
  triggerMode?: 'click' | 'hover';
  side?: 'top' | 'right' | 'bottom' | 'left';
  showIcon?: boolean;
  children?: React.ReactNode;
  tooltipDelay?: number;
}

export const HelpIconTooltip = ({
  tooltip,
  iconSize = 16,
  className = '',
  triggerMode = 'click',
  side = 'top',
  showIcon = true,
  children,
  tooltipDelay = 200,
}: HelpIconTooltipProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!tooltip) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (triggerMode === 'click') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(!isOpen);
    }
  };

  const tooltipTrigger = showIcon ? (
    <div className={`cursor-pointer ${className}`} onClick={handleClick}>
      <StyledHelpIcon sx={{ fontSize: iconSize }} $isOpen={isOpen} />
    </div>
  ) : (
    children
  );

  return (
    <TooltipProvider>
      <Tooltip 
        open={triggerMode === 'click' ? isOpen : undefined} 
        disableHover={triggerMode === 'click'}
        delayDuration={tooltipDelay}
      >
        <TooltipTrigger asChild>
          {tooltipTrigger}
        </TooltipTrigger>
        <TooltipContent side={side}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HelpIconTooltip; 