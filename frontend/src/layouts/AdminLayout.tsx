import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';

const AdminLayout: React.FC = () => {
  const navigate = useNavigate();

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
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <Link to="/admin" className="p-2 hover:bg-gray-800 rounded">Overview</Link>
          <Link to="/admin/inventory" className="p-2 hover:bg-gray-800 rounded">Inventory</Link>
          <Link to="/admin/branches" className="p-2 hover:bg-gray-800 rounded">Branches</Link>
          <Link to="/admin/users" className="p-2 hover:bg-gray-800 rounded">Users & Roles</Link>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="w-full text-left p-2 hover:bg-gray-800 rounded text-red-400">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;