import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/shared/ui/shadcn/dialog';
import { Button } from '@/components/shared/ui/shadcn/button';

interface PackageOperationPopupsProps {
  showSingleDeleteConfirm: boolean;
  showBatchDeleteConfirm: boolean;
  selectedPackageName?: string;
  selectedCount?: number;
  onSingleDeleteConfirm: () => void;
  onBatchDeleteConfirm: () => void;
  onClose: () => void;
}

const PackageOperationPopups: React.FC<PackageOperationPopupsProps> = ({
  showSingleDeleteConfirm,
  showBatchDeleteConfirm,
  selectedPackageName,
  selectedCount,
  onSingleDeleteConfirm,
  onBatchDeleteConfirm,
  onClose,
}) => {
  return (
    <>
      {/* Single Delete Confirmation Dialog */}
      <Dialog open={showSingleDeleteConfirm}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the data package "{selectedPackageName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onSingleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <Dialog open={showBatchDeleteConfirm}>
        <DialogContent 
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} selected data packages? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onBatchDeleteConfirm}>
              Delete Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PackageOperationPopups; 