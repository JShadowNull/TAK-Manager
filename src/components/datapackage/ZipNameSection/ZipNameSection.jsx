import React from 'react';
import { Input } from '../../shared/ui/shadcn/input';

const ZipNameSection = ({ zipName, onZipNameChange }) => {
  return (
    <div className="p-4 bg-backgroundPrimary">
      <div className="text-base text-medium mb-4">Zip File Name</div>
      <Input
        type="text"
        value={zipName}
        onChange={(e) => onZipNameChange(e.target.value)}
        placeholder="Enter Zip File Name without .zip"
      />
    </div>
  );
};

export default ZipNameSection; 