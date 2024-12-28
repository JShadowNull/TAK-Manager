import { CloseIcon } from './CloseIcon';

export default {
  title: 'Components/Icons/CloseIcon',
  component: CloseIcon,
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
  },
  argTypes: {
    color: { control: 'color' },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
    },
    onClick: { action: 'clicked' },
    className: { control: 'text' },
  },
};

// Default state
export const Default = {
  args: {
    color: '#ef4444',
    size: 'small',
  },
};


// Custom styled variant
export const CustomStyled = {
  args: {
    color: '#2e7d32',
    size: 'medium',
    className: 'bg-gray-100 p-2 rounded-full',
    onClick: () => console.log('Styled icon clicked'),
  },
}; 