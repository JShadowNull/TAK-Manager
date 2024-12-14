import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

interface CustomTooltipProps {
  children: React.ReactNode;
  content: string;
  delayDuration?: number;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  children,
  content,
  delayDuration = 200,
}) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}; 