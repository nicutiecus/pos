import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks'; // 1. Import Hook
import { clearCart } from '../store/slices/cartSlice'; // 2. Import Action

const POSLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch(); // 3. Initialize Dispatch
  const branchName = localStorage.getItem('branchName') || 'Branch';
  const cashierName = localStorage.getItem('userName') || 'Cashier';

  const handleLogout = () => {
    if(window.confirm("End Shift and Logout?")) {
      localStorage.clear();
      navigate('/login');
    }
  };

  // 4. Create a "New Sale" Handler
  const handleNewSale = (e: React.MouseEvent) => {
    // If we are already on the POS page, clicking this should act as a "Reset"
    if (location.pathname === '/pos') {
      e.preventDefault(); // Stop navigation (since we are already here)
      if (window.confirm("Clear current cart and start a new sale?")) {
        dispatch(clearCart());
      }
    }
    // If we are on History page, the <NavLink> will handle the navigation automatically
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top Navbar */}
      <header className="bg-blue-800 text-white shadow-md flex-shrink-0 z-20">
        <div className="flex justify-between items-center px-4 py-2">
          
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-bold tracking-tight">❄️ POS Terminal</h1>
            
            {/* Navigation Tabs */}
            <nav className="flex space-x-1 bg-blue-900 rounded-lg p-1">
              <NavLink 
                to="/pos" 
                end
                onClick={handleNewSale} // 5. Attach Handler
                className={({ isActive }) => 
                  `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-200 hover:text-white'}`
                }
              >
                New Sale
              </NavLink>
              <NavLink 
                to="/pos/history" 
                className={({ isActive }) => 
                  `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-200 hover:text-white'}`
                }
              >
                History
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
             <div className="text-right hidden md:block">
                <div className="text-xs text-blue-300">Logged in as</div>
                <div className="text-sm font-bold">{cashierName} ({branchName})</div>
             </div>
             <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors">
               End Shift
             </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
};

export default POSLayout;