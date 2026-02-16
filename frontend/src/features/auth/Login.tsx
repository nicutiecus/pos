import React, { useState, type ChangeEvent,type  FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Send credentials to your backend
      const response = await api.post('/auth/login', credentials);
      
      // Assume backend returns { token: '...', user: { role: 'ADMIN', tenantId: 1 } }
      const { token, user } = response.data;

      // Store auth data globally
      localStorage.setItem('accessToken', token);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('tenantId', user.tenantId);

      // Route based on role
      if (user.role === 'ADMIN' || user.role === 'MANAGER') {
        navigate('/admin');
      } else if (user.role === 'CASHIER') {
        navigate('/pos');
      }

    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Invalid email or password.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Coldroom POS Login</h2>
      
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}
      
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input type="email" name="email" value={credentials.email} onChange={handleChange} required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input type="password" name="password" value={credentials.password} onChange={handleChange} required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <button type="submit" disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default Login;