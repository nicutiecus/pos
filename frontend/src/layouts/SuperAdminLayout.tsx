import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

const SuperAdminLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const userName = localStorage.getItem('userName') || 'Platform Owner';

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to securely log out of the Command Center?")) {
      localStorage.clear();
      // Route back to the specific Super Admin login page
      navigate('/super-admin/login');
    }
  };

  const navLinks = [
    { name: 'Platform Overview', path: '/super-admin', icon: '🌍' },
    { name: 'Tenants & Billing', path: '/super-admin/tenants', icon: '🏢' },
    { name: 'Global Settings', path: '/super-admin/settings', icon: '⚙️' },
    { name: 'System Logs', path: '/super-admin/logs', icon: '🛡️' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      
      {/* --- SIDEBAR (Desktop) --- */}
      <aside className="hidden md:flex flex-col w-64 bg-gray-900 border-r border-gray-800 shadow-2xl z-20">
        <div className="p-6 flex items-center gap-3 border-b border-gray-800">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/50">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white uppercase">Equest OS</h1>
            <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Command Center</p>
          </div>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? 'bg-red-600/10 text-red-500 border border-red-900/50 shadow-inner' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{link.icon}</span>
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            <span>🚪</span> Secure Logout
          </button>
        </div>
      </aside>

      {/* --- MOBILE OVERLAY --- */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="relative w-64 bg-gray-900 h-full shadow-2xl flex flex-col border-r border-gray-800">
             {/* Mobile Sidebar Content (Same as desktop) */}
             <div className="p-6 flex justify-between items-center border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                         <span className="text-white font-black text-xs">EQ</span>
                    </div>
                    <span className="font-black text-white tracking-tight">EQUEST OS</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
             </div>
             <nav className="flex-1 py-4 px-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold ${
                    location.pathname === link.path ? 'bg-red-600/10 text-red-500' : 'text-gray-400'
                  }`}
                >
                  <span>{link.icon}</span> {link.name}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800">
                <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-400">Logout</button>
            </div>
          </aside>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <header className="h-16 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-4 lg:px-8 shrink-0 z-10 relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-gray-400 hover:text-white focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-bold text-white">{userName}</div>
              <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Super Admin</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-white font-bold shadow-inner">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
            {/* Background ambient glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-900/5 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="relative z-10 h-full">
                <Outlet />
            </div>
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;