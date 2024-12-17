import React from 'react';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled } from '@mui/material/styles';

// Create a styled Switch component using Tailwind-like styles
const StyledSwitchBase = styled(Switch)({
  '& .MuiSwitch-switchBase': {
    color: '#ffffff',
    '&.Mui-checked': {
      color: '#ffffff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#22C55E',
        opacity: 1,
      },
    },
  },
  '& .MuiSwitch-track': {
    backgroundColor: '#EF4444',
    opacity: 1,
  },
});

const StyledSwitch = ({ checked, onChange, label, labelClassName = "text-sm foreground" }) => {
  return (
    <FormControlLabel
      control={
        <StyledSwitchBase
          checked={checked}
          onChange={onChange}
        />
      }
      label={
        <span className={labelClassName}>
          {label}
        </span>
      }
    />
  );
};

export default StyledSwitch; 