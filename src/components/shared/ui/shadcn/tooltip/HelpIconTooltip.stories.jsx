import React from 'react';
import HelpIconTooltip from './HelpIconTooltip';
import Button from '../../Button';

export default {
  title: 'Shared/HelpIconTooltip',
  component: HelpIconTooltip,
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

export const InteractionModes = () => (
  <div className="flex flex-col gap-8 p-4">
    {/* Standalone Help Icons */}
    <div className="flex flex-col gap-4">
      <h3 className="foreground font-medium">Standalone Help Icons:</h3>
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="foreground">Click Mode:</span>
          <HelpIconTooltip 
            tooltip="Click me to toggle. Click again to hide." 
            triggerMode="click"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="foreground">Hover Mode:</span>
          <HelpIconTooltip 
            tooltip="Hover over me to show/hide." 
            triggerMode="hover"
          />
        </div>
      </div>
    </div>

    {/* Buttons with Help Icons */}
    <div className="flex flex-col gap-4">
      <h3 className="foreground font-medium">Buttons with Help Icons:</h3>
      <div className="flex items-center gap-4">
        <Button 
          showHelpIcon 
          tooltip="Click the help icon to toggle"
          triggerMode="click"
        >
          With Click Help
        </Button>
        <Button 
          showHelpIcon 
          tooltip="Hover over the help icon"
          triggerMode="hover"
          variant="secondary"
        >
          With Hover Help
        </Button>
      </div>
    </div>

    {/* Inline Text Examples */}
    <div className="flex flex-col gap-4">
      <h3 className="foreground font-medium">Inline with Text:</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="foreground">Important setting</span>
          <HelpIconTooltip 
            tooltip="Click for more information about this setting" 
            triggerMode="click"
          />
          <span className="text-gray-400">|</span>
          <span className="foreground">Another option</span>
          <HelpIconTooltip 
            tooltip="Hover for details about this option" 
            triggerMode="hover"
          />
        </div>
      </div>
    </div>
  </div>
);

export const Positions = () => (
  <div className="flex flex-col gap-8 p-4">
    <h3 className="foreground font-medium">Tooltip Positions:</h3>
    <div className="grid grid-cols-2 gap-8">
      {['top', 'right', 'bottom', 'left'].map((side) => (
        <div key={side} className="flex items-center gap-2">
          <span className="foreground min-w-[80px]">{side}:</span>
          <HelpIconTooltip 
            tooltip={`Tooltip on ${side}`}
            side={side}
            triggerMode="click"
          />
        </div>
      ))}
    </div>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-col gap-8 p-4">
    <h3 className="foreground font-medium">Icon Sizes:</h3>
    <div className="flex items-center gap-8">
      {[16, 20, 24, 32].map((size) => (
        <div key={size} className="flex items-center gap-2">
          <HelpIconTooltip 
            tooltip={`${size}px icon`}
            iconSize={size}
            triggerMode="click"
          />
          <span className="text-gray-400 text-sm">{size}px</span>
        </div>
      ))}
    </div>
  </div>
);

export const Variants = () => (
  <div className="flex flex-col gap-8 p-4">
    <h3 className="foreground font-medium">With Different Button Variants:</h3>
    <div className="flex items-center gap-4">
      <Button 
        variant="primary"
        showHelpIcon 
        tooltip="Primary button help"
        triggerMode="click"
      >
        Primary
      </Button>
      <Button 
        variant="secondary"
        showHelpIcon 
        tooltip="Secondary button help"
        triggerMode="click"
      >
        Secondary
      </Button>
      <Button 
        variant="danger"
        showHelpIcon 
        tooltip="Danger button help"
        triggerMode="click"
      >
        Danger
      </Button>
    </div>
  </div>
); 