import React from 'react';

function Configuration() {
  return (
    <div className="w-full border border-accentBoarder bg-cardBg p-4 rounded-lg">
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
  );
}

export default Configuration; 