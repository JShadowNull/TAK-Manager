import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import io from 'socket.io-client';
import PreferenceItem from '../shared/PreferenceItem';
import { generateCotStreamItems, validateCotStream } from './cotStreamConfig';

const CotStreamsSection = memo(({ 
  preferences, 
  onPreferenceChange, 
  onEnableChange, 
  onValidationChange
}) => {
  const [certOptions, setCertOptions] = useState([]);
  const count = parseInt(preferences.count?.value || "1", 10);
  const items = generateCotStreamItems(count);
  const socketRef = useRef(null);
  const renderCount = useRef(0);

  // Debug re-renders
  useEffect(() => {
    renderCount.current += 1;
    console.log('CotStreamsSection: Rendering, count:', renderCount.current);
  });

  // Socket connection for certificate options
  useEffect(() => {
    console.log('CotStreamsSection: Setting up socket connection');
    const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socket = io('/data-package', {
      transports: ['websocket'],
      path: '/socket.io'
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('CotStreamsSection: Socket connected');
      socket.emit('get_certificate_files');
    });

    socket.on('disconnect', () => {
      console.log('CotStreamsSection: Socket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('CotStreamsSection: Socket connection error:', error);
    });

    socket.on('certificate_files', (data) => {
      console.log('CotStreamsSection: Received certificate files');
      if (data.files && Array.isArray(data.files)) {
        const options = data.files.map(file => ({
          value: `cert/${file}`,
          text: file
        }));
        setCertOptions(options);
      }
    });

    return () => {
      console.log('CotStreamsSection: Cleaning up socket connection');
      if (socketRef.current) {
        console.log('CotStreamsSection: Socket exists, removing listeners');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('certificate_files');
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
        console.log('CotStreamsSection: Socket cleanup complete');
      }
    };
  }, []);

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

  // Initialize all preferences as enabled by default
  useEffect(() => {
    items.forEach((item) => {
      const pref = preferences[item.label];
      
      if (!pref) {
        // For new preferences, set both value and enabled state
        onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        onEnableChange(item.label, true);
      } else {
        // For existing preferences, ensure they're enabled if not explicitly set
        if (pref.enabled === undefined) {
          onEnableChange(item.label, true);
        }
        // Initialize value if undefined
        if (pref.value === undefined) {
          onPreferenceChange(item.label, item.input_type === 'checkbox' ? true : (item.value || ''));
        }
      }
    });
  }, [count]);

  // Validate all streams whenever preferences change
  useEffect(() => {
    let allErrors = {};
    
    // Validate each stream
    for (let i = 0; i < count; i++) {
      const streamErrors = validateCotStream(i, preferences);
      allErrors = { ...allErrors, ...streamErrors };
    }

    // Report validation errors
    if (onValidationChange) {
      onValidationChange('cot_streams', allErrors);
    }
  }, [preferences, count, onValidationChange]);

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

      <div className="divide-y divide-accentBoarder">
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