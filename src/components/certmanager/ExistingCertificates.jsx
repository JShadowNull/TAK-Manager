import React from 'react';
import CustomScrollbar from '../CustomScrollbar';

function ExistingCertificates({
  certificates,
  isLoading,
  onDeleteCertificate,
  onCreateDataPackage
}) {
  return (
    <div className="border border-accentBoarder bg-cardBg p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold">Existing Certificates</h3>
        <button
          className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-blue-500 transition-all duration-200"
          onClick={onCreateDataPackage}
        >
          Create Data Packages
        </button>
      </div>
      <div className="h-[400px]">
        <CustomScrollbar>
          <div className="space-y-2">
            {certificates.map((cert) => (
              <div key={cert.name} className="flex justify-between items-center p-2 border border-accentBoarder rounded bg-primaryBg">
                <div className="flex items-center gap-2">
                  <span className="text-textPrimary">{cert.name}</span>
                  {cert.isAdmin && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Admin</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                    onClick={() => onDeleteCertificate(cert.name)}
                    disabled={isLoading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
}

export default ExistingCertificates; 