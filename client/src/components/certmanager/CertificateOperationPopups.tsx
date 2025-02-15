import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../shared/ui/shadcn/dialog';
import { Button } from '../shared/ui/shadcn/button';

interface CertificateOperationPopupsProps {
  showSingleDeleteConfirm: boolean;
  showBatchDeleteConfirm: boolean;
  selectedCertName?: string;
  selectedCount?: number;
  onSingleDeleteConfirm: () => void;
  onBatchDeleteConfirm: () => void;
  onClose: () => void;
}

const CertificateOperationPopups: React.FC<CertificateOperationPopupsProps> = ({
  showSingleDeleteConfirm,
  showBatchDeleteConfirm,
  selectedCertName,
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
              Are you sure you want to delete the certificate for "{selectedCertName}"? This action cannot be undone.
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
              Are you sure you want to delete {selectedCount} selected certificates? This action cannot be undone.
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

export default CertificateOperationPopups; 