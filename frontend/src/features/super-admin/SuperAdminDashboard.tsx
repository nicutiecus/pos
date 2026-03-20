import React, { useState, useEffect } from 'react';
import api from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---
interface GlobalStats {
  total_tenants: number;
  active_tenants: number;
  total_platform_revenue: number; // Sum of ALL sales across ALL tenants
  total_users: number;
}

interface Tenant {
  id: string;
  name: string;
  owner_email: string;
  created_at: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL';
  total_branches: number;
  subscription_plan: string;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const fetchSuperAdminData = async () => {
      try {
        // NOTE: These endpoints must be strictly protected by Django's IsAdminUser/IsSuperUser permissions
        const [statsRes, tenantsRes] = await Promise.all([
          api.get('/super-admin/stats/'),
          api.get('/super-admin/tenants/')
        ]);
        
        setStats(statsRes.data);
        // Handle paginated or flat array response
        setTenants(tenantsRes.data.results || tenantsRes.data);
      } catch (err) {
        console.error("Failed to load platform data", err);
        alert("Unauthorized or failed to load Super Admin data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuperAdminData();
  }, []);

  // --- The Impersonation Engine ---
  const handleImpersonate = async (tenantId: string, businessName: string) => {
    if (!window.confirm(`Are you sure you want to login as the admin for ${businessName}?`)) return;
    
    setIsImpersonating(true);
    try {
      // 1. Tell backend to generate a Tenant Admin token for this specific tenant
      const res = await api.post(`/super-admin/tenants/impersonate/${tenantId}/`);

      const newTenantToken = res.data.access;
      
      // 2. Save your current Super Admin token so you can return later
      const currentSuperToken = localStorage.getItem('accessToken');
      localStorage.setItem('superAdminBackupToken', currentSuperToken || '');

      localStorage.setItem('accessToken', newTenantToken);
      
      // 3. Swap in the new Tenant token
      localStorage.setItem('userRole', 'Tenant_admin');
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('businessName', businessName);
      localStorage.setItem('isImpersonating', 'true'); // Flag to show a "Return to Super Admin" banner

      api.defaults.headers.common['Authorization'] = `Bearer ${newTenantToken}`;
      
      // 4. Redirect to the normal Tenant Admin dashboard
      window.location.href = '/admin';
      
    } catch (err) {
      alert("Failed to initiate impersonation.");
      console.error(err);
      setIsImpersonating(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Change tenant status to ${newStatus}?`)) return;

    try {
      await api.patch(`/super-admin/tenants/${tenantId}/`, { status: newStatus });
      setTenants(tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert("Failed to update tenant status.");
    }
  };

  if (isLoading) return <div className="p-10 text-center font-bold text-gray-500 mt-20">Loading Platform Command Center...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      
      {/* HEADER */}
      <div className="bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-800 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>🌍</span> Platform Overview
          </h2>
          <p className="text-sm text-gray-400 mt-1">Global analytics and tenant management.</p>
        </div>
        <div className="text-right">
          <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Super Admin Level</span>
        </div>
      </div>

      {/* GLOBAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Tenants</p>
            <p className="text-3xl font-black text-gray-900">{stats?.total_tenants || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Active Businesses</p>
            <p className="text-3xl font-black text-green-600">{stats?.active_tenants || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Platform Users</p>
            <p className="text-3xl font-black text-gray-900">{stats?.total_users || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-b-4 border-b-blue-600">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Processed Volume</p>
            <p className="text-2xl font-black text-blue-700">₦{Number(stats?.total_platform_revenue || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* TENANT MANAGEMENT TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Registered Tenants</h3>
          <input 
            type="text" 
            placeholder="Search businesses or emails..." 
            className="w-64 p-2 rounded border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Business</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status & Plan</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Scale</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {tenants.map(tenant => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-black text-gray-900">{tenant.name}</div>
                    <div className="text-xs text-gray-500">{tenant.owner_email}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Joined: {new Date(tenant.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                      tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                      tenant.status === 'TRIAL' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tenant.status}
                    </span>
                    <div className="text-xs font-medium text-gray-600 mt-2">Plan: {tenant.subscription_plan}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-sm font-bold text-gray-700">{tenant.total_branches} Branches</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      {/* IMPERSONATE BUTTON */}
                      <button 
                        onClick={() => handleImpersonate(tenant.id, tenant.name)}
                        disabled={isImpersonating}
                        className="bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-black transition-colors"
                        title="Login to their dashboard to fix errors"
                      >
                        🕵️‍♂️ Impersonate
                      </button>
                      
                      {/* SUSPEND/ACTIVATE BUTTON */}
                      <button 
                        onClick={() => handleToggleStatus(tenant.id, tenant.status)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border ${
                          tenant.status === 'ACTIVE' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;