import { TransferInfo } from './TransferInfo';

const defaultSteps = [
  {
    label: 'Enable Developer Options',
    description: [
      'Open Settings on your Android device',
      'Scroll down and tap "About phone" (or "About device")',
      'Find "Build number" (might be under "Software information")',
      'Tap "Build number" 7 times quickly',
      'You\'ll see a message saying "You are now a developer!"',
      'Enter your PIN/pattern/password if prompted'
    ]
  },
  {
    label: 'Enable USB Debugging',
    description: [
      'Go back to Settings',
      'Scroll down and tap "Developer options"',
      'Turn on the "Developer options" toggle if not already on',
      'Scroll down to find "USB debugging"',
      'Turn on "USB debugging"',
      'Tap "OK" on the warning message'
    ]
  },
  {
    label: 'Connect to Computer',
    description: [
      'Connect your Android device to your computer using a USB cable',
      'On your device, look for a popup asking to "Allow USB debugging?"',
      'Check "Always allow from this computer" (optional)',
      'Tap "Allow"'
    ]
  },
  {
    label: 'Common Issues',
    description: [
      'Device Not Detected: Try different USB cable or port',
      'Device Shows as "Unauthorized": Unplug and replug USB cable',
      'Developer Options Disappears: Repeat Build number tapping process',
      'Note: Keep USB debugging off when not in use for security'
    ]
  }
];

export default {
  title: 'Transfer/TransferInfo',
  component: TransferInfo,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#1a1b1e'
        }
      ]
    }
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-8 pt-14 p-8 w-[800px]">
        <Story />
      </div>
    ),
  ],
};

export const Default = {
  args: {
    steps: defaultSteps
  }
}; 