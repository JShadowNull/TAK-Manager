import { useState, useCallback, useEffect } from 'react';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import axios from 'axios';

// Add retry logic and connection handling
const axiosInstance = axios.create({
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
axiosInstance.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
);

// Ensure endpoint starts with a slash
const getApiUrl = (endpoint: string): string => {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface FetchConfig extends Omit<AxiosRequestConfig, 'validateResponse'> {
  rawResponse?: boolean;
  validateResponse?: (data: any) => ValidationResult;
}

type HttpMethod = <T = any>(
  endpoint: string,
  data?: any,
  config?: FetchConfig
) => Promise<T>;

interface FetchHook {
  get: HttpMethod;
  post: HttpMethod;
  put: HttpMethod;
  delete: HttpMethod;
  loading: boolean;
  error: Error | null;
  clearError: () => void;
}

function useFetch(): FetchHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Add reconnection logic
  useEffect(() => {
    const reconnect = () => {
      // Clear any existing errors when we reconnect
      setError(null);
    };

    window.addEventListener('focus', reconnect);
    return () => window.removeEventListener('focus', reconnect);
  }, []);

  // Add retry logic to requests
  const withRetry = async (request: () => Promise<any>, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await request();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
  };

  function handleResponse<T>(
    response: AxiosResponse,
    config: FetchConfig = {}
  ): T {
    if (config.rawResponse) {
      return response as unknown as T;
    }

    if (config.validateResponse) {
      const validationResult = config.validateResponse(response.data);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Response validation failed');
      }
    }

    return response.data;
  }

  const get = useCallback(<T = any>(
    endpoint: string,
    _data?: never,
    config: FetchConfig = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    return withRetry(() => 
      axiosInstance
        .get(getApiUrl(endpoint), config)
        .then((response) => handleResponse<T>(response, config))
        .finally(() => setLoading(false))
    ).catch((err) => {
      const error = err as Error;
      setError(error);
      setLoading(false);
      throw error;
    });
  }, []);

  const post = useCallback(<T = any>(
    endpoint: string,
    data?: any,
    config: FetchConfig = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      return axios
        .post(getApiUrl(endpoint), data, axiosConfig)
        .then((response) => handleResponse<T>(response, { rawResponse, validateResponse }))
        .finally(() => setLoading(false));
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      throw error;
    }
  }, []);

  const put = useCallback(<T = any>(
    endpoint: string,
    data?: any,
    config: FetchConfig = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      return axios
        .put(getApiUrl(endpoint), data, axiosConfig)
        .then((response) => handleResponse<T>(response, { rawResponse, validateResponse }))
        .finally(() => setLoading(false));
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      throw error;
    }
  }, []);

  const del = useCallback(<T = any>(
    endpoint: string,
    data?: any,
    config: FetchConfig = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      return axios
        .delete(getApiUrl(endpoint), {
          ...axiosConfig,
          headers: {
            'Content-Type': 'application/json',
            ...(axiosConfig.headers || {})
          },
          data
        })
        .then((response) => handleResponse<T>(response, { rawResponse, validateResponse }))
        .catch((err) => {
          console.error('Delete request failed:', err);
          throw err;
        })
        .finally(() => setLoading(false));
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      throw error;
    }
  }, []);

  return {
    get,
    post,
    put,
    delete: del,
    loading,
    error,
    clearError: () => setError(null)
  };
}

export default useFetch; 