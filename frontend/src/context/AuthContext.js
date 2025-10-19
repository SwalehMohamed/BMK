import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    // Optimistically hydrate from storage to avoid UI flicker on refresh
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (_) {
        // If parsing fails, clear corrupted storage
        localStorage.removeItem('user');
      }
    }

    if (token) {
      // Verify token and get user info
      api
        .get('/users/me')
        .then((response) => {
          setCurrentUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        })
        .catch((error) => {
          const status = error?.response?.status;
          if (status === 401 || status === 403) {
            // Token is invalid, remove it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setCurrentUser(null);
          } else {
            // Keep optimistic user on transient errors
            console.warn('Could not verify token, keeping optimistic user:', error?.message || error);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      // Store token in localStorage
      localStorage.setItem('token', token);
      // Store user for faster hydration on refresh
      localStorage.setItem('user', JSON.stringify(user));
      setCurrentUser(user);
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const updateUser = (userData) => {
    setCurrentUser(userData);
  };

  const value = {
    currentUser,
    login,
    logout,
    updateUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}