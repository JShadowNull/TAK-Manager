import { DeleteIcon } from '../Icons/DeleteIcon';
import { LoadingSpinner } from '../Icons/LoadingSpinner';

export const FileList = ({ files, uploadingFiles, onDeleteFile, disabled }) => {
  return (
    (files.length > 0 || uploadingFiles.size > 0) && (
      <div id="file-list" className="space-y-2 text-buttonTextColor rounded-lg p-2 text-sm border-1 border-buttonBorder bg-buttonColor">
        {/* Show uploading files first */}
        {Array.from(uploadingFiles).map((filename) => (
          <div key={`uploading-${filename}`} className="flex justify-between items-center p-2 rounded-lg bg-buttonColor/50">
            <span className="text-buttonTextColor opacity-75">{filename}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-buttonTextColor">Uploading...</span>
              <LoadingSpinner />
            </div>
          </div>
        ))}
        
        {/* Show uploaded files */}
        {files.map((filename) => (
          <div key={filename} className="flex justify-between items-center p-2 rounded-lg">
            <span className="text-buttonTextColor">{filename}</span>
            <button
              onClick={() => onDeleteFile(filename)}
              className="text-red-500 hover:text-red-700 hover:shadow-soft"
              data-filename={filename}
              disabled={disabled || uploadingFiles.has(filename)}
            >
              <DeleteIcon />
            </button>
          </div>
        ))}
      </div>
    )
  );
}; 