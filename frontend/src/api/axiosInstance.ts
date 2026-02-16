import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Define the shape of our expected error responses
interface ApiErrorResponse {
  message?: string;
  detail?: string;
}

// Create the core instance
const api = axios.create({
  // Use Vite's env variables for different environments (local, staging, prod)
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Request Interceptor ---
// Automatically attach the Authorization token to every outgoing request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // In a real app, you might store this in localStorage, sessionStorage, or Zustand/Redux
    const token = localStorage.getItem('accessToken');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// --- Response Interceptor ---
// Globally handle common errors, like expired tokens
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Any status code that lies within the range of 2xx causes this function to trigger
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Token expired or missing)
    if (error.response?.status === 401 && originalRequest) {
      console.warn('Session expired or unauthorized access.');
      
      // Optional: Implement token refresh logic here
      // const newToken = await refreshMyToken();
      // localStorage.setItem('accessToken', newToken);
      // originalRequest.headers.Authorization = `Bearer ${newToken}`;
      // return api(originalRequest);

      // Standard behavior: Force logout and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tenantId');
      window.location.href = '/login'; 
    }

    // Handle 403 Forbidden (User doesn't have permissions, e.g., Cashier trying to access Admin route)
    if (error.response?.status === 403) {
      console.error('Permission denied: You do not have access to this resource.');
    }

    return Promise.reject(error);
  }
);

export default api;