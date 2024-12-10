import React from 'react';
import InputField from '../../InputField';

const ZipNameSection = ({ zipName, onZipNameChange }) => {
  return (
    <div className="p-4 bg-backgroundPrimary rounded-lg border border-accentBoarder">
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