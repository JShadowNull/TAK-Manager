import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import PreferenceItem from '../shared/PreferenceItem';
import { generateCotStreamItems, validateCotStream } from './cotStreamConfig';

const CotStreamsSection = memo(({ 
  preferences, 
  onPreferenceChange, 
  onEnableChange, 
  onValidationChange,
  socket,
  isConnected
}) => {
  const [certOptions, setCertOptions] = useState([]);
  const count = parseInt(preferences.count?.value || "1", 10);
  const items = generateCotStreamItems(count);
  const hasRequestedCerts = useRef(false);
  const certRequestTimeout = useRef(null);

  // Request certificates function
  const requestCertificates = useCallback(() => {
    if (socket && isConnected && !hasRequestedCerts.current && certOptions.length === 0) {
      console.log('Requesting certificates...');
      socket.emit('get_certificate_files');
      hasRequestedCerts.current = true;
    }
  }, [socket, isConnected, certOptions.length]);

  // Handle certificate response
  const handleCertificateFiles = useCallback((data) => {
    console.log('Received certificate files response:', data);
    if (data.files && Array.isArray(data.files)) {
      const options = data.files.map(file => ({
        value: `cert/${file}`,
        text: file
      }));
      setCertOptions(options);
    } else {
      // If no certificates found, retry after a delay
      hasRequestedCerts.current = false;
      if (certRequestTimeout.current) {
        clearTimeout(certRequestTimeout.current);
      }
      certRequestTimeout.current = setTimeout(requestCertificates, 1000);
    }
  }, [requestCertificates]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) {
      hasRequestedCerts.current = false;
      return;
    }

    // Request certificates immediately when socket is connected
    requestCertificates();

    // Set up event listener
    socket.on('certificate_files', handleCertificateFiles);

    // Cleanup
    return () => {
      socket.off('certificate_files', handleCertificateFiles);
      if (certRequestTimeout.current) {
        clearTimeout(certRequestTimeout.current);
      }
    };
  }, [socket, isConnected, requestCertificates, handleCertificateFiles]);

  // Request certificates when connection status changes
  useEffect(() => {
    if (isConnected) {
      requestCertificates();
    } else {
      hasRequestedCerts.current = false;
    }
  }, [isConnected, requestCertificates]);

  // Initialize preferences only when count changes or new preferences are added
  useEffect(() => {
    const newItems = items.filter(item => !preferences[item.label]);
    
    if (newItems.length > 0) {
      newItems.forEach((item) => {
        onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        onEnableChange(item.label, true);
      });
    }
  }, [count, items, preferences, onPreferenceChange, onEnableChange]);

  // Validate all streams whenever relevant preferences change
  useEffect(() => {
    let allErrors = {};
    
    // Only validate if the stream is enabled
    for (let i = 0; i < count; i++) {
      if (preferences[`enabled${i}`]?.value) {
        const streamErrors = validateCotStream(i, preferences);
        allErrors = { ...allErrors, ...streamErrors };
      }
    }

    // Report validation errors
    if (onValidationChange) {
      onValidationChange('cot_streams', allErrors);
    }
  }, [count, preferences, onValidationChange]);

  const handleSelectAll = useCallback(() => {
    items.forEach((item) => {
      onEnableChange(item.label, true);
    });
  }, [items, onEnableChange]);

  const handleUnselectAll = useCallback(() => {
    items.forEach((item) => {
      onEnableChange(item.label, false);
    });
  }, [items, onEnableChange]);

  return (
    <div className="p-4 bg-backgroundPrimary">
      <button 
        className="hidden cot-streams-select-all"
        onClick={handleSelectAll}
      />
      <button 
        className="hidden cot-streams-unselect-all"
        onClick={handleUnselectAll}
      />
      <div className="divide-y divide-border">
        {items.map((item) => {
          const isCertLocationField = item.label.toLowerCase().includes('location');
          const pref = preferences[item.label] || {};
          
          // Always default to enabled unless explicitly disabled
          const isPreferenceEnabled = pref.enabled !== undefined ? pref.enabled : true;
          
          // Get the current value, using preference value if available
          const fieldValue = pref.value !== undefined ? pref.value : item.value;
          
          // Determine if field is required based on stream enabled state
          const streamIndex = item.label.match(/\d+$/)?.[0];
          const isStreamEnabled = streamIndex !== undefined && 
            preferences[`enabled${streamIndex}`]?.value;
          const isRequired = item.required && isStreamEnabled;
          
          return (
            <div key={item.label} className="py-2 first:pt-0 last:pb-0">
              <PreferenceItem
                name={item.name}
                label={item.label}
                input_type={isCertLocationField ? 'select' : item.input_type}
                value={fieldValue}
                checked={item.input_type === 'checkbox' ? pref.value : undefined}
                options={isCertLocationField ? certOptions : item.options || []}
                isPreferenceEnabled={isPreferenceEnabled}
                required={isRequired}
                placeholder={item.placeholder}
                onChange={(e) => {
                  const value = item.input_type === 'checkbox' 
                    ? e.target.checked 
                    : e.target.value;
                  onPreferenceChange(item.label, value);
                }}
                onPreferenceEnableChange={(enabled) => onEnableChange(item.label, enabled)}
                isCertificateDropdown={isCertLocationField}
                min={item.min}
                max={item.max}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

CotStreamsSection.displayName = 'CotStreamsSection';

export default CotStreamsSection; 