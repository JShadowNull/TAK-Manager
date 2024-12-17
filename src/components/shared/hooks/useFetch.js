import { useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000';

/**
 * Custom hook for making HTTP requests to the Flask backend
 * @returns {Object} Object containing fetch methods and state
 */
const useFetch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Handle response based on config
   * @param {Object} response - Axios response object
   * @param {Object} config - Request config
   * @returns {any} Processed response data
   */
  const handleResponse = (response, config = {}) => {
    // If raw response is requested, return the entire response
    if (config.rawResponse) {
      return response;
    }

    // If response validation is provided, use it
    if (config.validateResponse) {
      const validationResult = config.validateResponse(response.data);
      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Response validation failed');
      }
    }

    // Default behavior: return response.data
    return response.data;
  };

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} config - Axios config object with additional options:
   *   - rawResponse: boolean - If true, returns entire response instead of response.data
   *   - validateResponse: function - Custom validation function for response data
   * @returns {Promise} Promise that resolves with the response data
   */
  const get = useCallback(async (endpoint, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, axiosConfig);
      return handleResponse(response, { rawResponse, validateResponse });
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} data - Request body data
   * @param {Object} config - Axios config object with additional options:
   *   - rawResponse: boolean - If true, returns entire response instead of response.data
   *   - validateResponse: function - Custom validation function for response data
   * @returns {Promise} Promise that resolves with the response data
   */
  const post = useCallback(async (endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data, axiosConfig);
      return handleResponse(response, { rawResponse, validateResponse });
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} data - Request body data
   * @param {Object} config - Axios config object with additional options:
   *   - rawResponse: boolean - If true, returns entire response instead of response.data
   *   - validateResponse: function - Custom validation function for response data
   * @returns {Promise} Promise that resolves with the response data
   */
  const put = useCallback(async (endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      const response = await axios.put(`${API_BASE_URL}${endpoint}`, data, axiosConfig);
      return handleResponse(response, { rawResponse, validateResponse });
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} config - Axios config object with additional options:
   *   - rawResponse: boolean - If true, returns entire response instead of response.data
   *   - validateResponse: function - Custom validation function for response data
   * @returns {Promise} Promise that resolves with the response data
   */
  const del = useCallback(async (endpoint, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { rawResponse, validateResponse, ...axiosConfig } = config;
      const response = await axios.delete(`${API_BASE_URL}${endpoint}`, axiosConfig);
      return handleResponse(response, { rawResponse, validateResponse });
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
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
};

export default useFetch; 