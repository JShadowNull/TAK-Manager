import React, { useState } from 'react';

function AdvancedFeatures() {
  const [showOtaForm, setShowOtaForm] = useState(false);
  const [otaFormData, setOtaFormData] = useState({
    ota_zip_file: null,
  });

  const handleOtaInputChange = (e) => {
    const { id, files } = e.target;
    setOtaFormData(prev => ({
      ...prev,
      [id]: files[0]
    }));
  };

  const handleOtaClose = () => {
    setShowOtaForm(false);
    setOtaFormData({
      ota_zip_file: null,
    });
  };

  const handleOtaSubmit = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('ota_zip_file', otaFormData.ota_zip_file);

      const response = await fetch('/api/takserver/configure-ota', {
        method: 'POST',
        body: formDataToSend,
      });
      const data = await response.json();
      console.log(data.message);
      setShowOtaForm(false);
    } catch (error) {
      console.error('OTA configuration error:', error);
    }
  };

  return (
    <>
      <div className="w-full border border-accentBoarder bg-cardBg p-4 rounded-lg">
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-bold">Advanced Features</h3>
          <div className="flex gap-4">
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={() => setShowOtaForm(true)}
            >
              Configure OTA Updates
            </button>
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={() => console.log('Update Plugins')}
            >
              Update Plugins
            </button>
          </div>
        </div>
      </div>

      {/* OTA Configuration Form */}
      <div className={`w-full border border-accentBoarder bg-cardBg p-6 rounded-lg ${!showOtaForm && 'hidden'}`}>
        <h3 className="text-base font-bold mb-4">OTA Updates Configuration</h3>
        
        <div className="flex flex-col gap-4">
          {/* Purpose Section */}
          <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Purpose</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              OTA (Over-The-Air) updates enable ATAK users to easily discover and install available plugins and ATAK versions directly from their devices. 
              This feature streamlines the distribution of updates and new capabilities to your ATAK users without requiring manual installation.
            </p>
          </div>

          {/* OTA Configuration Summary */}
          <div className="bg-primaryBg border border-accentBoarder p-4 rounded-lg mb-4">
            <h4 className="text-sm font-semibold text-selectedColor mb-2">Configuration Summary</h4>
            <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
              <li>This will configure OTA (Over-The-Air) updates for ATAK clients</li>
              <li>The process will update the Dockerfile and docker-compose configuration</li>
              <li>TAK Server containers will be rebuilt and restarted</li>
              <li>Existing plugins folder will be removed and replaced with the new content</li>
            </ul>
          </div>

          {/* Required Fields Note */}
          <div className="text-sm text-yellow-400 mb-2">
            All fields are required
          </div>

          {/* File Upload Section */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              OTA Updates ZIP File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              id="ota_zip_file"
              onChange={handleOtaInputChange}
              className="w-full text-sm p-2 rounded-lg bg-inputBg border border-inputBorder focus:border-accentBorder focus:outline-none"
              accept=".zip"
              required
            />
          </div>

          <div className="flex justify-end gap-4 mt-4">
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
              onClick={handleOtaClose}
            >
              Cancel
            </button>
            <button
              className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
              onClick={handleOtaSubmit}
            >
              Begin Configuration
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default AdvancedFeatures; 