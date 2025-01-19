import React from 'react';
import { Input } from '../../shared/ui/shadcn/input';

const ZipNameSection = ({ zipName, onZipNameChange }) => {
  return (
    <div className="p-4 bg-backgroundPrimary">
      <div className="text-lg font-medium py-4">File Name</div>
      <Input
        type="text"
        value={zipName}
        onChange={(e) => onZipNameChange(e.target.value)}
        placeholder="Enter a name for the file"
      />
    </div>
  );
};

export default ZipNameSection; 