import * as React from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { ScrollArea } from '@/components/shared/ui/shadcn/scroll-area';
import { Button } from '../shared/ui/shadcn/button';

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

export const TransferInfo = ({ steps = defaultSteps }) => {
  const [activeStep, setActiveStep] = React.useState(0);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-lg foreground border border-border">
      <h2 className="text-base font-bold">Setup Android Device for Rapid Transfer</h2>
      <div className="h-[400px] bg-backgroundPrimary rounded-lg">
        <ScrollArea>
          <div className="p-4">
            <Box>
              <Stepper activeStep={activeStep} orientation="vertical" sx={{
                '& .MuiStepLabel-label': { 
                  color: 'rgba(86, 119, 153, 1.000)',
                  fontWeight: 500
                },
                '& .MuiStepLabel-label.Mui-active': { 
                  color: 'rgba(106, 167, 248, 1.000)',
                  fontWeight: 600
                },
                '& .MuiStepLabel-label.Mui-completed': { 
                  color: 'rgba(106, 167, 248, 1.000)',
                  fontWeight: 500
                },
                '& .MuiStepIcon-root': { 
                  color: 'rgba(4, 28, 47, 1.000)',
                  border: '1px solid rgba(21, 39, 67, 1.000)',
                  borderRadius: '50%'
                },
                '& .MuiStepIcon-root.Mui-active': { 
                  color: 'rgba(106, 167, 248, 1.000)',
                  border: 'none'
                },
                '& .MuiStepIcon-root.Mui-completed': { 
                  color: 'rgba(106, 167, 248, 1.000)',
                  border: 'none'
                },
                '& .MuiStepContent-root': { 
                  borderLeft: '1px solid rgba(21, 39, 67, 1.000)',
                  marginLeft: '12px'
                }
              }}>
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel>
                      <Typography>{step.label}</Typography>
                    </StepLabel>
                    <StepContent>
                      <div className="space-y-2 text-sm foreground">
                        {step.description.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex items-start gap-2">
                            <span className="min-w-[20px]">{itemIndex + 1}.</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-x-2">
                        <Button
                          variant="primary"
                          onClick={handleNext}
                        >
                          {index === steps.length - 1 ? 'Finish' : 'Continue'}
                        </Button>
                        {index > 0 && (
                          <Button
                            variant="secondary"
                            onClick={handleBack}
                          >
                            Back
                          </Button>
                        )}
                      </div>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
              {activeStep === steps.length && (
                <Paper 
                  square 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    bgcolor: 'transparent',
                    color: 'rgba(106, 167, 248, 1.000)'
                  }}
                >
                  <Typography>All steps completed - you're ready to transfer</Typography>
                  <div className="mt-4">
                    <Button
                      variant="primary"
                      onClick={handleReset}
                    >
                      Start Over
                    </Button>
                  </div>
                </Paper>
              )}
            </Box>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}; 