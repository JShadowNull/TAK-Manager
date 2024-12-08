import React from 'react';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled } from '@mui/material/styles';
import InputField from '../InputField';

// Create a styled Switch component using Tailwind-like styles
const StyledSwitch = styled(Switch)({
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

function CreateCertificates({
  certFields,
  isMultiple,
  batchName,
  batchGroup,
  prefixType,
  count,
  prefixOptions,
  isLoading,
  onAddCertField,
  onRemoveCertField,
  onCertFieldChange,
  onMultipleChange,
  onBatchNameChange,
  onBatchGroupChange,
  onPrefixTypeChange,
  onCountChange,
  onCreateCertificates,
  getCertificatePreview
}) {
  return (
    <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg">
      <div className="flex items-center gap-4 mb-4">
        <h3 className="text-base font-bold">Create Certificates</h3>
        <button
          onClick={onAddCertField}
          className="text-buttonTextColor p-2 rounded-lg border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-blue-500 transition-all duration-200"
          title="Add Certificate"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>
      <div className="space-y-4">
        {/* Individual Certificate Fields */}
        {certFields.map((field, index) => (
          <div key={index} className="flex gap-4 items-end">
            <div className="flex-1">
              <InputField
                type="text"
                id={`cert-${index}`}
                label={index === 0 ? "Certificate Name" : `Additional Certificate ${index}`}
                value={field.name}
                onChange={(e) => onCertFieldChange(index, 'name', e.target.value)}
                placeholder="Enter certificate name"
                className="text-buttonTextColor placeholder-textSecondary"
              />
            </div>
            <div className="flex-1">
              <InputField
                type="text"
                id={`group-${index}`}
                label="Group"
                value={field.group}
                onChange={(e) => onCertFieldChange(index, 'group', e.target.value)}
                placeholder="Enter group name"
                className="text-buttonTextColor placeholder-textSecondary"
              />
            </div>
            <div className="flex items-center gap-4">
              <FormControlLabel
                control={
                  <StyledSwitch
                    checked={field.isAdmin}
                    onChange={(e) => onCertFieldChange(index, 'isAdmin', e.target.checked)}
                  />
                }
                label={
                  <span className="text-sm text-white">
                    Admin
                  </span>
                }
              />
              {index > 0 && (
                <button
                  onClick={() => onRemoveCertField(index)}
                  className="text-red-500 hover:text-red-600 p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Multiple Certificates Switch */}
        <div className="flex gap-4 items-center">
          <FormControlLabel
            control={
              <StyledSwitch
                checked={isMultiple}
                onChange={onMultipleChange}
              />
            }
            label={
              <span className="text-sm text-white">
                Multiple Certificates
              </span>
            }
          />
        </div>

        {/* Multiple Certificates Options */}
        {isMultiple && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <InputField
                  type="text"
                  id="batchName"
                  label="Base Name"
                  value={batchName}
                  onChange={onBatchNameChange}
                  placeholder="Enter base name (e.g. jake)"
                  className="text-buttonTextColor placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="text"
                  id="batchGroup"
                  label="Group"
                  value={batchGroup}
                  onChange={onBatchGroupChange}
                  placeholder="Enter group name"
                  className="text-buttonTextColor placeholder-textSecondary"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="select"
                  id="prefixType"
                  label="Suffix Type"
                  value={prefixType}
                  onChange={onPrefixTypeChange}
                  options={prefixOptions}
                  className="text-buttonTextColor"
                />
              </div>
              <div className="flex-1">
                <InputField
                  type="number"
                  id="count"
                  label="Number of Certificates"
                  value={count}
                  onChange={onCountChange}
                  min={1}
                  className="text-buttonTextColor"
                />
              </div>
            </div>
            
            {/* Certificate Name Preview */}
            <div className="text-sm text-gray-400 italic">
              Preview: {getCertificatePreview()}
            </div>
          </div>
        )}

        {/* Create Button */}
        <button
          className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
          onClick={onCreateCertificates}
          disabled={isLoading || (certFields.every(f => !f.name.trim()) && (!isMultiple || !batchName.trim()))}
        >
          Create Certificate{(isMultiple || certFields.length > 1) ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

export default CreateCertificates; 