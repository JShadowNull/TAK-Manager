import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import Button from '../Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

const meta: Meta = {
  title: 'Shared/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#1a1b1e'
        }
      ]
    }
  }
};

export default meta;

type Story = StoryObj<typeof Tooltip>;

export const ButtonTooltips: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Basic Button Tooltip */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-sm mb-2">Basic Button Tooltip:</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button>Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Basic tooltip on hover</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Different Positions */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-sm mb-2">Different Positions:</span>
        <div className="flex gap-4">
          {['top', 'right', 'bottom', 'left'].map((side) => (
            <TooltipProvider key={side}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary">{side}</Button>
                </TooltipTrigger>
                <TooltipContent side={side as 'top' | 'right' | 'bottom' | 'left'}>
                  <p>Tooltip on {side}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Different Button Variants */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-sm mb-2">Button Variants:</span>
        <div className="flex gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="primary">Primary</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Primary button tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Secondary</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Secondary button tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="danger">Danger</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Danger button tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Rich Content */}
      <div className="flex flex-col gap-2">
        <span className="text-white text-sm mb-2">Rich Content:</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button>Rich Content</Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1">
                <p className="font-bold">Rich Content</p>
                <p className="text-sm text-gray-400">With multiple lines</p>
                <p className="text-xs">And different sizes</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}; 