import React from 'react';

const ImpersonationBanner: React.FC = () => {
  // Check if the user is currently impersonating
  const isImpersonating = localStorage.getItem('isImpersonating') === 'true';
  const businessName = localStorage.getItem('businessName') || 'a Tenant';

  // If not impersonating, do not render anything
  if (!isImpersonating) return null;

  const handleEndImpersonation = () => {
    if (!window.confirm("End impersonation and return to the Super Admin command center?")) return;

    // 1. Retrieve the backup Super Admin token
    const superAdminToken = localStorage.getItem('superAdminBackupToken');
    
    if (superAdminToken) {
      // 2. Restore the Super Admin credentials
      localStorage.setItem('accessToken', superAdminToken);
      localStorage.setItem('userRole', 'Super_Admin');
      localStorage.setItem('userName', 'Platform Owner'); 
      
      // 3. Clean up all the impersonation flags and tenant data
      localStorage.removeItem('isImpersonating');
      localStorage.removeItem('superAdminBackupToken');
      localStorage.removeItem('tenantId');
      // Optional: clear branch IDs or other tenant-specific state if you store them globally
      localStorage.removeItem('branchId');
      localStorage.removeItem('branchName');

      // 4. Force a hard reload to the Super Admin dashboard to clear React state completely
      window.location.href = '/super-admin';
    } else {
      // Failsafe: If the backup token was lost, log them out completely for security
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between shadow-md z-[9999] relative">
      <div className="flex items-center space-x-3 mb-2 sm:mb-0">
        <span className="text-xl animate-pulse">🕵️‍♂️</span>
        <p className="text-sm font-bold tracking-wide">
          <span className="opacity-80 font-medium uppercase text-xs mr-2">Warning:</span> 
          You are currently impersonating <span className="underline decoration-red-300 underline-offset-2">{businessName}</span>.
        </p>
      </div>
      
      <button 
        onClick={handleEndImpersonation}
        className="bg-black text-white hover:bg-gray-800 px-4 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-colors border border-gray-700 shadow-sm"
      >
        Return to Super Admin
      </button>
    </div>
  );
};

export default ImpersonationBanner;