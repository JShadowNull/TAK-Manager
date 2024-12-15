import Button from './Button';

export default {
  title: 'Shared/Button',
  component: Button,
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
    onClick: { action: 'clicked' },
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    loadingText: { control: 'text' },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
    },
    showHelpIcon: { control: 'boolean' },
    tooltip: { control: 'text' },
  },
};

const Template = (args) => <Button {...args}>{args.children}</Button>;

// Basic Variants
export const Primary = Template.bind({});
Primary.args = {
  children: 'Primary Button',
  variant: 'primary',
};

export const Secondary = Template.bind({});
Secondary.args = {
  children: 'Secondary Button',
  variant: 'secondary',
};

export const Danger = Template.bind({});
Danger.args = {
  children: 'Danger Button',
  variant: 'danger',
};

// Loading States
export const PrimaryLoading = Template.bind({});
PrimaryLoading.args = {
  children: 'Submit',
  variant: 'primary',
  loading: true,
  loadingText: 'Submitting...',
};

export const SecondaryLoading = Template.bind({});
SecondaryLoading.args = {
  children: 'Process',
  variant: 'secondary',
  loading: true,
  loadingText: 'Processing...',
};

export const DangerLoading = Template.bind({});
DangerLoading.args = {
  children: 'Delete',
  variant: 'danger',
  loading: true,
  loadingText: 'Deleting...',
};

export const LoadingWithoutText = Template.bind({});
LoadingWithoutText.args = {
  children: 'Loading Example',
  variant: 'primary',
  loading: true,
};

// Disabled States
export const PrimaryDisabled = Template.bind({});
PrimaryDisabled.args = {
  children: 'Primary Button',
  variant: 'primary',
  disabled: true,
};

export const SecondaryDisabled = Template.bind({});
SecondaryDisabled.args = {
  children: 'Secondary Button',
  variant: 'secondary',
  disabled: true,
};

export const DangerDisabled = Template.bind({});
DangerDisabled.args = {
  children: 'Danger Button',
  variant: 'danger',
  disabled: true,
};

// With Tooltips
export const WithTooltip = Template.bind({});
WithTooltip.args = {
  children: 'Button with Help',
  variant: 'primary',
  showHelpIcon: true,
  tooltip: 'This is a helpful tooltip message',
};

export const LoadingWithTooltip = Template.bind({});
LoadingWithTooltip.args = {
  children: 'Process Action',
  variant: 'primary',
  loading: true,
  loadingText: 'Processing...',
  showHelpIcon: true,
  tooltip: 'This action is in progress',
};

// Other Variants
export const CustomClassName = Template.bind({});
CustomClassName.args = {
  children: 'Custom Class Button',
  className: 'w-64 h-12',
};

export const SubmitButton = Template.bind({});
SubmitButton.args = {
  children: 'Submit Form',
  type: 'submit',
  variant: 'primary',
};
 