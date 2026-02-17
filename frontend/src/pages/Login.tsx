import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import { isAxiosError } from 'axios';

// 1. Match the Django SimpleJWT + Custom 'validate' response structure
interface LoginResponse {
  access: string;  // SimpleJWT default key for the token
  refresh: string; // Refresh token
  user: {
    id: number;
    email: string;
    role: 'Tenant_Admin' | 'Branch_Manager' | 'Cashier';
    tenant_id: number | null;
    branch_id: number | null;
    first_name: string;
    branch_name: string;

  };
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 2. Call your backend
      const response = await api.post<LoginResponse>('/auth/login/', credentials);

      // DEBUG: Look at this in your browser console to see exactly what the backend sends
      console.log("Full Login Response:", response.data);

      // DEBUG: See exactly what the server sent
      //console.log("SERVER RESPONSE:", response.data);
      
      const { access, refresh, user } = response.data;

      // DEBUG: Check the role specifically
      //console.log("USER ROLE:", user.role); 
      //console.log("IS ADMIN CHECK:", user.role === 'Tenant_Admin');

      // 3. Store the 'access' token
      localStorage.setItem('accessToken', access); 
      localStorage.setItem('refreshToken', refresh); // Good practice to store this too
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', user.first_name || ''); 
      localStorage.setItem('branchName', user.branch_name || '');
      localStorage.setItem('branchId', user.branch_id?.toString() ||'' );
      
      
      if (user.tenant_id) {
        localStorage.setItem('tenantId', user.tenant_id.toString());
      }
      
      // Update global headers immediately
      api.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // 4. Route based on Role
      if (user.role === 'Tenant_Admin') {
        console.log("Redirecting to Admin..."); // DEBUG
        navigate('/admin');
      } else if (user.role === 'Branch_Manager') {
        navigate('/manager'); // Or a manager specific dashboard
      } else if (user.role === 'Cashier') {
        navigate('/pos');
      } else {
        console.warn("Role not recognized:", user.role); //debug
        navigate('/');
      }

    } catch (err) {
      console.error("Login failed:", err);
      if (isAxiosError(err)) {
        // SimpleJWT usually returns 401 for bad credentials
        if (err.response?.status === 401) {
          setError('Invalid email or password.');
        } else {
          setError('Login failed. Please check your connection.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ... (JSX render remains the same as previous step)
  return (
      // ... Render logic ...
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to Coldroom POS
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={credentials.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={credentials.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;