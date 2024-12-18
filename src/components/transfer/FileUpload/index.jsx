import { useRef } from 'react';
import { UploadIcon } from '../Icons/UploadIcon';
import { FileList } from './FileList';

export const FileUpload = ({ 
  files, 
  uploadingFiles, 
  onFileUpload, 
  onDeleteFile, 
  disabled 
}) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    onFileUpload(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-lg foreground border-1 border-border">
      <h2 className="text-base mb-4">File Upload</h2>
      <div className="flex flex-col gap-4">
        <div 
          className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('border-green-500');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-green-500');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-green-500');
            onFileUpload(e.dataTransfer.files);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
        >
          <input
            id="file-input"
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept=".zip,.jpg,.jpeg,.png,.tif,.tiff,.p12,.apk,.sid"
            onChange={handleFileChange}
            disabled={disabled}
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <UploadIcon />
            <p className="mt-1">Drop files here or click to select</p>
            <p className="text-sm text-gray-400">
              Supported files: .zip, .jpg, .jpeg, .png, .tif, .tiff, .p12, .apk, .sid
            </p>
          </label>
        </div>

        <FileList 
          files={files}
          uploadingFiles={uploadingFiles}
          onDeleteFile={onDeleteFile}
          disabled={disabled}
        />
      </div>
    </div>
  );
}; 