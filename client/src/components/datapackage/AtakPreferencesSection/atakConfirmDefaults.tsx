import { RotateCcw } from 'lucide-react';
import { Button } from "@/components/shared/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/shared/ui/shadcn/dialog";

interface AtakConfirmDefaultsProps {
  handleReset: () => void;
  showDefaultDialog: boolean;
  onDefaultDialogChange: (open: boolean) => void;
}

export const AtakConfirmDefaults = ({ 
  handleReset, 
  showDefaultDialog,
  onDefaultDialogChange 
}: AtakConfirmDefaultsProps) => (
  <Dialog open={showDefaultDialog} onOpenChange={onDefaultDialogChange}>
    <DialogTrigger asChild>
      <Button variant="outline">
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Reset to Defaults
        </span>
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Confirm Reset</DialogTitle>
        <DialogDescription>
          Are you sure you want to reset all settings to default values?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button 
          variant="danger"
          onClick={() => {
            handleReset();
            onDefaultDialogChange(false);
          }}
        >
          Confirm Reset
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
