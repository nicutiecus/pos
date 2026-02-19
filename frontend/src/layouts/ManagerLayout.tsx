import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

const ManagerLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const branchId = localStorage.getItem('branchId');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold tracking-wide">Branch Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Branch ID: {branchId || 'Unknown'}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/manager" 
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive('/manager') ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
            <span>📊</span>
            <span className="font-medium">Overview</span>
          </Link>
          
          <Link to="/manager/receive" 
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive('/manager/receive') ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
            <span>🚛</span>
            <span className="font-medium">Receive Stock</span>
          </Link>

          <Link to="/manager/products" 
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive('/manager/products') ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
            <span>📦</span>
            <span className="font-medium">Inventory List</span>
          </Link>

          <Link to="/manager/product-catalog" 
            className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${isActive('/manager/product-catalog') ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
            <span>📦</span>
            <span className="font-medium">Product Catalog</span>
          </Link>

          {/* Placeholder for future features */}
          <div className="pt-4 mt-4 border-t border-slate-700">
            <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff</span>
            <Link to="/manager/cashiers" className="flex items-center space-x-3 p-3 mt-2 rounded-lg hover:bg-slate-700 text-slate-300">
              <span>👥</span>
              <span className="font-medium">My Cashiers</span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <button onClick={handleLogout} className="flex items-center space-x-2 text-red-400 hover:text-red-300 w-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default ManagerLayout;