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
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
    },
    showHelpIcon: { control: 'boolean' },
    tooltip: { control: 'text' },
  },
};
const Template = (args) => <Button {...args}>{args.children}</Button>;

export const Primary = Template.bind({});
Primary.args = {
  children: 'Primary Button',
  variant: 'primary',
};

export const PrimaryDisabled = Template.bind({});
PrimaryDisabled.args = {
  children: 'Primary Button',
  variant: 'primary',
  disabled: true,
};

export const Secondary = Template.bind({});
Secondary.args = {
  children: 'Secondary Button',
  variant: 'secondary',
};

export const SecondaryDisabled = Template.bind({});
SecondaryDisabled.args = {
  children: 'Secondary Button',
  variant: 'secondary',
  disabled: true,
};

export const Danger = Template.bind({});
Danger.args = {
  children: 'Danger Button',
  variant: 'danger',
};

export const DangerDisabled = Template.bind({});
DangerDisabled.args = {
  children: 'Danger Button',
  variant: 'danger',
  disabled: true,
};

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

export const WithTooltip = Template.bind({});
WithTooltip.args = {
  children: 'Button with Help',
  variant: 'primary',
  showHelpIcon: true,
  tooltip: 'This is a helpful tooltip message',
};

export const SecondaryWithTooltip = Template.bind({});
SecondaryWithTooltip.args = {
  children: 'Secondary with Help',
  variant: 'secondary',
  showHelpIcon: true,
  tooltip: 'Click this for secondary action',
};

export const DangerWithTooltip = Template.bind({});
DangerWithTooltip.args = {
  children: 'Danger with Help',
  variant: 'danger',
  showHelpIcon: true,
  tooltip: 'Warning: This action cannot be undone',
};

export const DisabledWithTooltip = Template.bind({});
DisabledWithTooltip.args = {
  children: 'Disabled with Help',
  variant: 'primary',
  disabled: true,
  showHelpIcon: true,
  tooltip: 'This button is currently disabled',
}; 