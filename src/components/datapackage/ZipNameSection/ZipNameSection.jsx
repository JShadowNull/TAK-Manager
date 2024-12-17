import React from 'react';
import InputField from '../../shared/ui/InputField';

const ZipNameSection = ({ zipName, onZipNameChange }) => {
  return (
    <div className="p-4 bg-backgroundPrimary">
      <div className="text-base text-medium mb-4">Zip File Name</div>
      <InputField
        type="text"
        value={zipName}
        onChange={(e) => onZipNameChange(e.target.value)}
        placeholder="Enter Zip File Name without .zip"
      />
    </div>
  );
};

export default ZipNameSection; 