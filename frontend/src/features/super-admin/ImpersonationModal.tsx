import React, { useState } from 'react';
import api from '../../api/axiosInstance';

export interface Branch {
  id: string;
  name: string;
  code: string;
}

interface ImpersonationModalProps {
  isOpen: boolean;
  tenantId: string;
  businessName: string;
  branches: Branch[];
  isLoadingBranches: boolean;
  onClose: () => void;
}

const ImpersonationModal: React.FC<ImpersonationModalProps> = ({
  isOpen,
  tenantId,
  businessName,
  branches,
  isLoadingBranches,
  onClose
}) => {
  const [isImpersonating, setIsImpersonating] = useState(false);

  const executeImpersonation = async (type: 'tenant' | 'branch', branchId?: string) => {
    setIsImpersonating(true);
    try {
      const payload = type === 'branch' && branchId ? { branch_id: branchId } : {};
      
      const res = await api.post(`/super-admin/tenants/impersonate/${tenantId}/`, payload);
      const newTenantToken = res.data.access;
      
      const currentSuperToken = localStorage.getItem('accessToken');
      localStorage.setItem('superAdminBackupToken', currentSuperToken || '');
      localStorage.setItem('accessToken', newTenantToken);
      
      localStorage.setItem('userRole', type === 'branch' ? 'Branch_Manager' : 'Tenant_Admin');
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('businessName', businessName);
      localStorage.setItem('isImpersonating', 'true'); 

      api.defaults.headers.common['Authorization'] = `Bearer ${newTenantToken}`;
      window.location.href = '/admin';
      
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to initiate impersonation.");
      console.error(err);
      setIsImpersonating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-black text-gray-900">
              Impersonate {businessName}
            </h3>
            <p className="text-sm text-gray-500 mt-1">Select an access level to troubleshoot this account.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Tenant Admin Option */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Headquarters Access</h4>
            <button
              onClick={() => executeImpersonation('tenant')}
              disabled={isImpersonating}
              className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all flex items-center justify-between group disabled:opacity-50"
            >
              <div>
                <div className="font-black text-gray-900 flex items-center gap-2">
                  🏢 Tenant Admin
                </div>
                <div className="text-xs text-gray-500 mt-1">Full platform access across all branches.</div>
              </div>
              <span className="text-gray-300 group-hover:text-gray-900 transition-colors">➔</span>
            </button>
          </div>

          {/* Branch Manager Options */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Branch Managers</span>
              {isLoadingBranches && <span className="text-blue-500 lowercase tracking-normal">Fetching branches...</span>}
            </h4>
            
            <div className="space-y-3">
              {!isLoadingBranches && branches.length === 0 && (
                <div className="p-4 bg-gray-50 text-center rounded-xl text-sm text-gray-500 border border-dashed border-gray-200">
                  No branches have been created for this tenant yet.
                </div>
              )}

              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => executeImpersonation('branch', branch.id)}
                  disabled={isImpersonating}
                  className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all flex items-center justify-between group disabled:opacity-50"
                >
                  <div>
                    <div className="font-bold text-gray-900">{branch.name}</div>
                    <div className="text-xs text-gray-500 mt-1 font-mono uppercase bg-gray-100 inline-block px-1.5 py-0.5 rounded">
                      {branch.code}
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-600 transition-colors">➔</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ImpersonationModal;