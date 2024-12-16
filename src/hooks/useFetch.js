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
   * Make a GET request
   * @param {string} endpoint - API endpoint (without base URL)
   * @param {Object} config - Axios config object
   * @returns {Promise} Promise that resolves with the response data
   */
  const get = useCallback(async (endpoint, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}${endpoint}`, config);
      return response.data;
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
   * @param {Object} config - Axios config object
   * @returns {Promise} Promise that resolves with the response data
   */
  const post = useCallback(async (endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, data, config);
      return response.data;
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
   * @param {Object} config - Axios config object
   * @returns {Promise} Promise that resolves with the response data
   */
  const put = useCallback(async (endpoint, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.put(`${API_BASE_URL}${endpoint}`, data, config);
      return response.data;
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
   * @param {Object} config - Axios config object
   * @returns {Promise} Promise that resolves with the response data
   */
  const del = useCallback(async (endpoint, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.delete(`${API_BASE_URL}${endpoint}`, config);
      return response.data;
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