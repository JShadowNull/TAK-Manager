import React from 'react';
import PreferenceItem from './PreferenceItem';

export const COT_STREAM_ITEMS = [
  {
    name: "Number of CoT (Cursor on Target) streams configured",
    label: "count",
    input_type: "text",
    value: "1"
  },
  {
    name: "Description of the first CoT stream",
    label: "description0",
    input_type: "text",
    value: "Your-Server-Name"
  },
  {
    name: "Whether the first CoT stream is enabled",
    label: "enabled0",
    input_type: "checkbox",
    checked: true
  },
  {
    name: "Connection string for the first CoT stream (IP:Port:Protocol)",
    label: "connectString0",
    input_type: "text",
    value: "192.168.1.20:8089:ssl"
  },
  {
    name: "Path to the CA certificate for the first CoT stream",
    label: "caLocation0",
    input_type: "select",
    options: [],
    value: "cert/truststore-intermediate.p12",
    isCertificateDropdown: true
  },
  {
    name: "Path to the client certificate for the first CoT stream",
    label: "certificateLocation0",
    input_type: "select",
    options: [],
    value: "cert/client.p12",
    isCertificateDropdown: true
  },
  {
    name: "Password for the client certificate for the first CoT stream",
    label: "clientPassword0",
    input_type: "password",
    value: "atakatak"
  },
  {
    name: "Password for the CA certificate for the first CoT stream",
    label: "caPassword0",
    input_type: "password",
    value: "atakatak"
  }
];

function CotStreams({ preferences, onPreferenceChange, onEnableChange }) {
  return (
    <div className="divide-y divide-accentBoarder">
      {COT_STREAM_ITEMS.map((item) => (
        <div key={item.label} className="py-2 first:pt-0 last:pb-0">
          <PreferenceItem
            name={item.name}
            label={item.label}
            input_type={item.input_type}
            value={preferences[item.label]?.value || item.value}
            checked={item.input_type === 'checkbox' ? preferences[item.label]?.value : undefined}
            options={item.options}
            isEnabled={preferences[item.label]?.enabled || false}
            onChange={(e) => {
              const value = item.input_type === 'checkbox' 
                ? e.target.checked 
                : e.target.value;
              onPreferenceChange(item.label, value);
            }}
            onEnableChange={(enabled) => onEnableChange(item.label, enabled)}
          />
        </div>
      ))}
    </div>
  );
}

export default CotStreams; 