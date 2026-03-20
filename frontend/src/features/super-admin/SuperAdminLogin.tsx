import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

const SuperAdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // NOTE: Adjust the endpoint if your Django backend uses a specific URL for super admin auth
      const res = await api.post('/auth/login/', { email, password });
      console.log("THE BACKEND RETURNED THIS ROLE:", res.data.user.role);
      
      const{access, refresh} = res.data
      const { role, first_name, last_name } = res.data.user;
      //const actualRole = res.data.user.role

      // --- CRITICAL SECURITY CHECK ---
      // Reject the login if the user is not a Super Admin, even if the password is correct
      if (role !== 'Super_Admin') {
        throw new Error("Unauthorized. This portal is strictly for Platform Owners.");
      }

      // Store credentials
      localStorage.setItem('accessToken', access);
      if (refresh) localStorage.setItem('refreshToken', refresh);
       localStorage.setItem('userRole', role);
      localStorage.setItem('userName', `${first_name} ${last_name}` || email);

      // Route to the command center
      navigate('/super-admin', { replace: true });

    } catch (err: any) {
      if (err instanceof Error && err.message.includes("Unauthorized")) {
         setError(err.message);
      } else if (isAxiosError(err)) {
        setError(err.response?.data?.detail || "Invalid credentials. Access denied.");
      } else {
        setError("A network error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-900/50">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Platform Owner</h1>
          <p className="text-sm text-gray-400 mt-2 tracking-widest uppercase">System Command Center</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-8">
          
          {error && (
            <div className="bg-red-950 border-l-4 border-red-500 p-4 rounded mb-6 flex items-start">
                <span className="text-red-500 mr-2">⚠️</span>
                <p className="text-sm text-red-200 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Master Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@platform.com"
                className="w-full bg-gray-950 border border-gray-800 text-white p-4 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder-gray-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Passcode</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-gray-950 border border-gray-800 text-white p-4 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder-gray-700"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-red-600 text-white p-4 rounded-xl font-black tracking-wide hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-900/30 flex justify-center items-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'INITIALIZE OVERRIDE'
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center text-xs font-medium text-gray-600">
          Unauthorized access attempts are strictly logged.
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;