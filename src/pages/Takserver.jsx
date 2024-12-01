import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Popup from '../components/Popup';
import InputField from '../components/InputField';

function Takserver() {
  // State management
  const [isInstalled, setIsInstalled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  // Add form data state
  const [formData, setFormData] = useState({
    docker_zip_file: null,
    postgres_password: '',
    certificate_password: '',
    organization: '',
    state: '',
    city: '',
    organizational_unit: '',
    name: ''
  });
  
  // Add step tracking state
  const [installStep, setInstallStep] = useState(1);

  // Socket connection setup
  useEffect(() => {
    const socket = io('/takserver', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('status_update', (data) => {
      setIsInstalled(data.installed);
      setIsRunning(data.running);
    });

    return () => socket.disconnect();
  }, []);

  // Handler functions
  const handleInstall = async () => {
    try {
      const formDataToSend = new FormData();
      
      // Append all form data to FormData object
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });

      const response = await fetch('/api/takserver/install-takserver', {
        method: 'POST',
        body: formDataToSend,
      });
      const data = await response.json();
      console.log(data.message);
      setShowInstallPopup(false);
      setInstallStep(1); // Reset step
    } catch (error) {
      console.error('Installation error:', error);
    }
  };

  const handleStartStop = async () => {
    const action = isRunning ? 'stop' : 'start';
    try {
      const response = await fetch(`/takserver-${action}`, {
        method: 'POST',
      });
      const data = await response.json();
      console.log(data.message);
    } catch (error) {
      console.error(`${action} error:`, error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { id, value, files, type } = e.target;
    if (type === 'file') {
      setFormData(prev => ({
        ...prev,
        [id]: files[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [id]: value
      }));
    }
  };

  // Function to handle "Next" button click
  const handleNext = () => {
    setInstallStep(2);
  };

  // Function to handle popup close
  const handleClose = () => {
    setShowInstallPopup(false);
    setInstallStep(1); // Reset step
    setFormData({      // Reset form data
      docker_zip_file: null,
      postgres_password: '',
      certificate_password: '',
      organization: '',
      state: '',
      city: '',
      organizational_unit: '',
      name: ''
    });
  };

  const renderPopupContent = () => {
    if (installStep === 1) {
      return (
        <div className="text-center">
          <p>Are you sure you want to install TAK Server?</p>
          <p className="mt-2 text-yellow-400">This process may take several minutes.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 w-full max-w-2xl p-4">
        {/* Required Fields Note */}
        <div className="text-sm text-yellow-400 mb-2">
          All fields are required
        </div>

        {/* File Upload Section */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-textPrimary">
            Docker ZIP File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            name="docker_zip_file"
            onChange={handleInputChange}
            className="w-full text-sm p-2 rounded-lg bg-inputBg border border-inputBorder focus:border-accentBorder focus:outline-none"
            accept=".zip"
            required
          />
        </div>

        {/* Password Fields Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              PostgreSQL Password <span className="text-red-500">*</span>
            </label>
            <InputField
              type="password"
              id="postgres_password"
              value={formData.postgres_password}
              onChange={(e) => handleInputChange(e)}
              placeholder="Enter PostgreSQL password"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              Certificate Password <span className="text-red-500">*</span>
            </label>
            <InputField
              type="password"
              id="certificate_password"
              value={formData.certificate_password}
              onChange={(e) => handleInputChange(e)}
              placeholder="Enter certificate password"
              required
            />
          </div>
        </div>

        {/* Organization Details Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              Organization <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              id="organization"
              value={formData.organization}
              onChange={(e) => handleInputChange(e)}
              placeholder="Your organization"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              Organizational Unit <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              id="organizational_unit"
              value={formData.organizational_unit}
              onChange={(e) => handleInputChange(e)}
              placeholder="Department or unit"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              State/Province <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              id="state"
              value={formData.state}
              onChange={(e) => handleInputChange(e)}
              placeholder="State or province"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              City <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              id="city"
              value={formData.city}
              onChange={(e) => handleInputChange(e)}
              placeholder="City"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-textPrimary">
              Name <span className="text-red-500">*</span>
            </label>
            <InputField
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange(e)}
              placeholder="Your name"
              required
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      <Popup
        id="install-popup"
        title={installStep === 1 ? "Install TAK Server" : "Installation Configuration"}
        isVisible={showInstallPopup}
        onClose={handleClose}
        buttons={
          installStep === 1 ? (
            <>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={handleClose}
              >
                Close
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleNext}
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
                onClick={() => setInstallStep(1)}
              >
                Back
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleInstall}
              >
                Install
              </button>
            </>
          )
        }
      >
        {renderPopupContent()}
      </Popup>

      <div className="flex flex-wrap gap-8">
        {/* Status Section */}
        <div className="flex-1 border border-accentBoarder bg-cardBg p-6 rounded-lg max-w-md min-w-[28rem]">
          <div className="flex flex-col h-full justify-between">
            <div>
              <h3 className="text-base font-bold mb-4">TAK Server Status</h3>
              <div className="flex justify-center items-center gap-8 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Installation:</span>
                  <span className="text-sm text-center">
                    {isInstalled ? 'Installed' : 'Not Installed'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <span className={`text-sm text-center ${isRunning ? 'text-green-500' : 'text-red-500'}`}>
                    {isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-start gap-4">
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => console.log('Restart')}
              >
                Restart
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={handleStartStop}
              >
                {isRunning ? 'Stop' : 'Start'}
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => setShowInstallPopup(true)}
                disabled={isInstalled}
              >
                Install TAK Server
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Features Section */}
        <div className="flex-1 border border-accentBoarder bg-cardBg p-4 max-w-md min-w-[28rem] rounded-lg">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold">Advanced Features</h3>
            <div className="flex gap-4">
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => console.log('OTA Update')}
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

        {/* Configuration Section */}
        <div className="flex-1 border border-accentBoarder bg-cardBg p-4 rounded-lg max-w-md min-w-[28rem]">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold">Configuration</h3>
            <div className="flex gap-4">
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => console.log('Data Package')}
              >
                Generate Data Package
              </button>
              <button
                className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-green-500 transition-all duration-200"
                onClick={() => console.log('make certs')}
              >
                Generate Certs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Takserver;
