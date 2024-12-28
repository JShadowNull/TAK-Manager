import { useState, useCallback } from 'react';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000';

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
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      return axios
        .get(`${API_BASE_URL}${endpoint}`, axiosConfig)
        .then((response) => handleResponse<T>(response, { rawResponse, validateResponse }))
        .finally(() => setLoading(false));
    } catch (err) {
      const error = err as Error;
      setError(error);
      setLoading(false);
      throw error;
    }
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
        .post(`${API_BASE_URL}${endpoint}`, data, axiosConfig)
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
        .put(`${API_BASE_URL}${endpoint}`, data, axiosConfig)
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
        .delete(`${API_BASE_URL}${endpoint}`, {
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