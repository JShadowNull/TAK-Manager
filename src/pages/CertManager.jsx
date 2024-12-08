import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Popup from '../components/Popup';
import CreateCertificates from '../components/certmanager/CreateCertificates';
import ExistingCertificates from '../components/certmanager/ExistingCertificates';

// Function to generate alphabetic sequence
const generateAlphabeticSequence = (n) => {
  const sequence = [];
  let len = 1;
  let count = 0;
  
  while (count < n) {
    let str = '';
    let num = count;
    
    for (let i = 0; i < len; i++) {
      str = String.fromCharCode(97 + (num % 26)) + str;
      num = Math.floor(num / 26);
    }
    
    sequence.push(str);
    count++;
    
    if (count === Math.pow(26, len)) {
      len++;
    }
  }
  
  return sequence;
};

function CertManager() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMultiple, setIsMultiple] = useState(false);
  const [certFields, setCertFields] = useState([
    { name: '', isAdmin: false, group: '__ANON__' }
  ]);
  const [batchName, setBatchName] = useState('');
  const [batchGroup, setBatchGroup] = useState('__ANON__');
  const [count, setCount] = useState(1);
  const [prefixType, setPrefixType] = useState('numeric');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const socketRef = useRef(null);
  const terminalRef = useRef(null);

  const prefixOptions = [
    { value: 'numeric', text: 'Numeric (1, 2, 3...)' },
    { value: 'alpha', text: 'Alphabetic (a, b, c...)' }
  ];

  useEffect(() => {
    // Create socket connection to backend
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    socketRef.current = io('/cert-manager', {
      transports: ['websocket'],
      path: '/socket.io'
    });

    // Listen for certificate updates
    socketRef.current.on('connect', () => {
      console.log('Connected to certificate manager service');
      socketRef.current.emit('get_certificates');
      appendToTerminalOutput('Connected to certificate manager service');
    });

    socketRef.current.on('certificates', (data) => {
      setCertificates(data);
    });

    socketRef.current.on('cert_operation_status', (data) => {
      setPopupMessage(data.message);
      appendToTerminalOutput(data.message);
      if (data.success) {
        socketRef.current.emit('get_certificates');
      }
    });

    socketRef.current.on('terminal_output', (data) => {
      appendToTerminalOutput(data.data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const appendToTerminalOutput = (text) => {
    setTerminalOutput(prev => [...prev, text]);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const handleAddCertField = () => {
    setCertFields([...certFields, { name: '', isAdmin: false, group: '__ANON__' }]);
  };

  const handleRemoveCertField = (index) => {
    setCertFields(certFields.filter((_, i) => i !== index));
  };

  const handleCertFieldChange = (index, field, value) => {
    const newFields = [...certFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setCertFields(newFields);
  };

  const handleCreateCertificates = () => {
    setIsLoading(true);
    setShowPopup(true);

    // Handle batch generation
    if (isMultiple && batchName) {
      const suffixes = prefixType === 'alpha' 
        ? generateAlphabeticSequence(count)
        : Array.from({ length: count }, (_, i) => (i + 1).toString());

      appendToTerminalOutput(`Creating ${count} certificate(s) with name pattern: ${batchName}-${batchGroup}-[${suffixes.join(', ')}]`);
      socketRef.current.emit('create_certificates', {
        name: batchName,
        group: batchGroup,
        prefixType: prefixType,
        count: count,
        isAdmin: false,
        includeGroupInName: true
      });
    }

    // Handle individual certificates
    const validCerts = certFields.filter(cert => cert.name.trim() !== '');
    if (validCerts.length > 0) {
      appendToTerminalOutput(`Creating ${validCerts.length} individual certificate(s)`);
      validCerts.forEach(cert => {
        appendToTerminalOutput(`- ${cert.name}${cert.isAdmin ? ' (Admin)' : ''} in group: ${cert.group}`);
      });

      socketRef.current.emit('create_certificates', {
        certificates: validCerts
      });
    }
  };

  const handleDeleteCertificate = (certName) => {
    setIsLoading(true);
    setShowPopup(true);
    appendToTerminalOutput(`Deleting certificate: ${certName}`);
    socketRef.current.emit('delete_certificate', { name: certName });
  };

  const handleBatchDataPackage = () => {
    navigate('/data-package');
  };

  // Preview for batch generation
  const getCertificatePreview = () => {
    if (!isMultiple || !batchName) return null;

    const previewCount = Math.min(count, 5);
    const suffixes = prefixType === 'alpha' 
      ? generateAlphabeticSequence(previewCount)
      : Array.from({ length: previewCount }, (_, i) => (i + 1).toString());

    const preview = suffixes.map(suffix => `${batchName}-${batchGroup}-${suffix}`);
    if (count > 5) {
      preview.push('...');
    }
    return preview.join(', ');
  };

  return (
    <div className="flex flex-col gap-8 pt-14">
      {/* Certificate Creation Section */}
      <CreateCertificates
        certFields={certFields}
        isMultiple={isMultiple}
        batchName={batchName}
        batchGroup={batchGroup}
        prefixType={prefixType}
        count={count}
        prefixOptions={prefixOptions}
        isLoading={isLoading}
        onAddCertField={handleAddCertField}
        onRemoveCertField={handleRemoveCertField}
        onCertFieldChange={handleCertFieldChange}
        onMultipleChange={(e) => setIsMultiple(e.target.checked)}
        onBatchNameChange={(e) => setBatchName(e.target.value)}
        onBatchGroupChange={(e) => setBatchGroup(e.target.value)}
        onPrefixTypeChange={(e) => setPrefixType(e.target.value)}
        onCountChange={(e) => setCount(parseInt(e.target.value))}
        onCreateCertificates={handleCreateCertificates}
        getCertificatePreview={getCertificatePreview}
      />

      {/* Existing Certificates Section */}
      <ExistingCertificates
        certificates={certificates}
        isLoading={isLoading}
        onDeleteCertificate={handleDeleteCertificate}
        onCreateDataPackage={handleBatchDataPackage}
      />

      {/* Popup for operations */}
      <Popup
        id="popup-cert-manager"
        title="Certificate Operations"
        isVisible={showPopup}
        showTerminal={true}
        terminalOutput={terminalOutput}
        terminalRef={terminalRef}
        onClose={() => {
          setShowPopup(false);
          setPopupMessage('');
          setIsLoading(false);
          setTerminalOutput([]);
        }}
        buttons={
          <button
            className="text-buttonTextColor rounded-lg p-2 text-sm border border-buttonBorder bg-buttonColor hover:text-black hover:shadow-md hover:border-black hover:bg-red-500 transition-all duration-200"
            onClick={() => {
              setShowPopup(false);
              setPopupMessage('');
              setIsLoading(false);
              setTerminalOutput([]);
            }}
          >
            Close
          </button>
        }
      >
        <div className="text-center">
          <p className="text-sm text-gray-300">
            {popupMessage}
          </p>
        </div>
      </Popup>
    </div>
  );
}

export default CertManager; 