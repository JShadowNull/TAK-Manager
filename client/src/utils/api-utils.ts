/**
 * API utility functions for making fetch requests
 */

/**
 * Configure default fetch behavior for the app
 * This is called once at app startup
 */
export const configureFetch = () => {
  // Nothing to specifically configure for fetch
  // This function exists for backward compatibility with previous axios-config.ts
  console.log('Fetch API configured');
};

/**
 * Get common headers for API requests
 */
export const getDefaultHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Helper function for handling API errors
 */
export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage: string;
  
  try {
    // Try to parse error as JSON
    const errorData = await response.json();
    errorMessage = errorData.detail || `Request failed with status ${response.status}`;
  } catch (err) {
    // If not JSON, use text or status
    errorMessage = await response.text().catch(() => `Request failed with status ${response.status}`);
  }

  console.error(`API request failed: ${response.url}`, response.status, errorMessage);
  throw new Error(errorMessage);
};

/**
 * Helper function to make API requests with consistent error handling
 */
export const apiRequest = async <T>(
  method: string,
  url: string,
  data?: any,
  options: RequestInit = {}
): Promise<T> => {
  try {
    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        ...getDefaultHeaders(),
        ...(options.headers || {})
      },
      ...options
    };

    // Add body for non-GET requests if data is provided
    if (method !== 'GET' && data) {
      requestOptions.body = 
        data instanceof FormData || typeof data === 'string'
          ? data 
          : JSON.stringify(data);
    }

    // Make the request
    const response = await fetch(url, requestOptions);

    // Handle error responses
    if (!response.ok) {
      await handleApiError(response);
    }

    // Handle empty responses (like 204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T;
    }

    // Parse JSON response
    const result = await response.json();
    return result as T;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`API request failed: ${method} ${url}`, error.message);
      throw error;
    }
    throw new Error(`Unknown error during API request: ${method} ${url}`);
  }
};

// Convenience methods for common HTTP methods
export const get = <T>(url: string, options?: RequestInit) => 
  apiRequest<T>('GET', url, undefined, options);

export const post = <T>(url: string, data?: any, options?: RequestInit) => 
  apiRequest<T>('POST', url, data, options);

export const put = <T>(url: string, data?: any, options?: RequestInit) => 
  apiRequest<T>('PUT', url, data, options);

export const del = <T>(url: string, data?: any, options?: RequestInit) => 
  apiRequest<T>('DELETE', url, data, options); 