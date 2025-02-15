import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

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
    <div 
      className={`cursor-pointer text-muted-foreground hover:text-foreground transition-colors ${className}`} 
      onClick={handleClick}
    >
      <HelpCircle 
        size={iconSize} 
        className={isOpen ? 'text-foreground' : ''} 
      />
    </div>
  ) : (
    children
  );

  return (
    <TooltipProvider>
      <Tooltip 
        open={triggerMode === 'click' ? isOpen : undefined} 
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