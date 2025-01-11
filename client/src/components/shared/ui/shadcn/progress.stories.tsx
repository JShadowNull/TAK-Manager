import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './progress';

const meta = {
  title: 'UI/Progress',
  component: Progress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
    isIndeterminate: {
      control: 'boolean',
    },
    text: {
      control: 'text',
    },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
  },
};

export const WithText: Story = {
  args: {
    value: 75,
    text: "Uploading files...",
  },
};

export const Indeterminate: Story = {
  args: {
    isIndeterminate: true,
    text: "Initializing...",
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    text: "Complete!",
  },
}; 