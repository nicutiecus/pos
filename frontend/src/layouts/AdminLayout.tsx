import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  
  // State to manage the Inventory dropdown
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Persistent Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800 text-lg font-bold">
          Admin Dashboard
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <Link to="/admin" className="p-2 hover:bg-gray-800 rounded transition-colors">Overview</Link>
          <Link to="/POS" className="p-2 hover:bg-gray-800 rounded transition-colors">POS</Link>
          <Link to="/admin/categories" className="p-2 hover:bg-gray-800 rounded transition-colors">Product Categories</Link>
          
          {/* --- INVENTORY MANAGEMENT DROPDOWN --- */}
          <div className="flex flex-col">
            <button 
              onClick={() => setIsInventoryOpen(!isInventoryOpen)}
              className="w-full p-2 hover:bg-gray-800 rounded flex justify-between items-center transition-colors outline-none"
            >
              <span className="font-medium">Inventory Management</span>
              <svg 
                className={`w-4 h-4 transform transition-transform duration-200 ${isInventoryOpen ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Expanded Links */}
            {isInventoryOpen && (
              <div className="flex flex-col mt-1 ml-4 pl-2 border-l-2 border-gray-700 space-y-1 animate-fade-in">
                <Link to="/admin/inventory" className="p-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
                  Branch Stock
                </Link>
                <Link to="/admin/organization-stock" className="p-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
                  Organization Stock
                </Link>
                <Link to="/admin/transfer" className="p-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
                  Stock Transfers
                </Link>
                <Link to="/admin/inventory-logs" className="p-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
                  Audit Logs
                </Link>
              </div>
            )}
          </div>
          {/* --- END DROPDOWN --- */}

          <Link to="/admin/branches" className="p-2 hover:bg-gray-800 rounded transition-colors">Branches</Link>
          <Link to="/admin/customers" className="p-2 hover:bg-gray-800 rounded transition-colors">Customers</Link>
          <Link to="/admin/users" className="p-2 hover:bg-gray-800 rounded transition-colors">Users & Roles</Link>
          <Link to="/admin/reports" className="p-2 hover:bg-gray-800 rounded transition-colors">Reports</Link>
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout} 
            className="w-full bg-red-600 hover:bg-red-700 p-2 rounded font-bold transition-colors shadow-sm"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;