import { CloseIcon } from '../../shared/icons/CloseIcon';
import { LoadingSpinner } from '../Icons/LoadingSpinner';
import CustomScrollbar from '../../CustomScrollbar';

export const FileList = ({ files, uploadingFiles, onDeleteFile, disabled }) => {
  const itemHeight = 36; // py-2 (8px top + 8px bottom) + line height (16px)
  const visibleItems = 4;
  const maxHeight = itemHeight * visibleItems;
  
  const totalItems = files.length + uploadingFiles.size;
  const containerHeight = Math.min(totalItems * itemHeight, maxHeight);

  return (
    (files.length > 0 || uploadingFiles.size > 0) && (
      <div id="file-list" className="text-buttonTextColor rounded-lg text-sm border-1 border-buttonBorder bg-primaryBg">
        <div style={{ height: `${containerHeight}px` }} className="overflow-hidden">
          <CustomScrollbar>
            <div className="divide-y px-4 py-0 divide-accentBoarder rounded-lg">
              {/* Show uploading files first */}
              {Array.from(uploadingFiles).map((filename) => (
                <div 
                  key={`uploading-${filename}`} 
                  className="flex justify-between items-center py-2"
                >
                  <span className="text-buttonTextColor opacity-75">{filename}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-buttonTextColor">Uploading...</span>
                    <LoadingSpinner />
                  </div>
                </div>
              ))}
              
              {/* Show uploaded files */}
              {files.map((filename) => (
                <div 
                  key={filename} 
                  className="flex justify-between items-center py-2"
                >
                  <span className="text-buttonTextColor">{filename}</span>
                  <button
                    onClick={() => onDeleteFile(filename)}
                    className="text-red-500 hover:text-red-700"
                    data-filename={filename}
                    disabled={disabled || uploadingFiles.has(filename)}
                  >
                    <CloseIcon 
                      size="small"
                      color="currentColor"
                      className={disabled || uploadingFiles.has(filename) ? 'opacity-50 cursor-not-allowed' : ''}
                    />
                  </button>
                </div>
              ))}
            </div>
          </CustomScrollbar>
        </div>
      </div>
    )
  );
}; 