/**
 * Upload file with progress tracking
 * 
 * @param url - API endpoint URL
 * @param formData - FormData object with file and other fields
 * @param onProgress - Callback for upload progress updates (0-100)
 * @param timeout - Request timeout in milliseconds (default: 3600000 = 1 hour)
 * @returns Promise with the response
 */
export const uploadWithProgress = (
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void,
  timeout: number = 3600000
): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Set up progress event
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });
    
    // Set up load event
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Create a Response object to mimic fetch API
        const response = new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers({
            'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json'
          })
        });
        resolve(response);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    });
    
    // Set up error event
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    // Set up timeout
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload request timed out'));
    });
    xhr.timeout = timeout;
    
    // Open and send the request
    xhr.open('POST', url);
    xhr.send(formData);
  });
}; 