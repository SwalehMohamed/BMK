import axios from 'axios';
// Allow overriding via environment: REACT_APP_API_URL
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // or wherever you store your JWT
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Improve visibility of network errors and unify error shape
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network error contacting API at', baseURL);
    }
    return Promise.reject(error);
  }
);

export default api;