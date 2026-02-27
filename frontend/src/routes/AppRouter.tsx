import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

//Import Protected routes


// Import Layouts and Guards
import AuthLayout from '../layouts/AuthLayout';
import POSLayout from '../layouts/POSLayout';
import AdminLayout from '../layouts/AdminLayout';
import Login from '../pages/Login';
import ProtectedRoute from './ProtectedRoute';
import ManagerLayout from '../layouts/ManagerLayout';
import ManagerDashboard from '../features/manager-dash/ManagerDashboard';
import AdminDashboard from '../features/admin-dash/AdminDashboard';


// Import features
import POSOnboardingWizard from '../features/onboarding/Onboarding';
import BranchManagement from '../features/admin-dash/BranchManagement';
import UserManagement from '../features/admin-dash/UserManagement';
import ProductCatalog from '../features/inventory/ProductCatalog';
import ProductList from '../features/inventory/ProductList';
import InventoryReceiving from '../features/inventory/InventoryReceiving';
import StockTransferForm from '../features/inventory/transfers/StockTransferForm';
import CategoryManagement from '../features/inventory/CategoryManagement';
import InventoryManagement from '../features/inventory/InventoryManagement';
import ReportsDashboard from '../features/reports/ReportsDashboard';
import CustomerManagement from '../features/customers/CustomerManagement';
//new transfer form
import StockTransfers from '../features/inventory/transfers/StockTransfers';
// import POS
import POSMain from '../features/pos/POSMain';
import SalesHistory from '../features/pos/SalesHistory';



const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Default redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* PUBLIC/AUTH ROUTES (Wrapped in AuthLayout) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/onboard" element={<POSOnboardingWizard />} />
      </Route>

      {/* CASHIER POS ROUTES (Wrapped in POSLayout) */}
      <Route element={<POSLayout />}>
        <Route path="/pos" element={<POSMain />} />
        {/* The History Screen */}
        <Route path="/pos/history" element={<SalesHistory />} />
      </Route>

      {/* Protected ADMIN ROUTES (Wrapped in AdminLayout) */}
      <Route element={<ProtectedRoute allowedRoles={['Tenant_Admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
        {/* Default admin page redirects to branches for now */}
            <Route index element={<Navigate to ='dashboard'/>} /> {/* Matches /admin */}
            <Route path="inventory" element={<InventoryManagement/>} />
            <Route path="inventory/receive" element={<InventoryReceiving/>}/>
            <Route path="branches" element={<BranchManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="products" element={<ProductList />} />
            <Route path ="categories" element={<CategoryManagement/>}/>
            <Route path ="reports" element={<ReportsDashboard/>}/>
            <Route path ="customers" element={<CustomerManagement/>}/>
            <Route path="dashboard" element={<AdminDashboard/>}/>
        </Route>
      </Route>

      {/* BRANCH MANAGER ROUTES */}
<Route element={<ProtectedRoute allowedRoles={['Branch_Manager']} />}>
  <Route path="/manager" element={<ManagerLayout />}>
  {/* Stock transfer */}
  <Route path="transfer" element={<StockTransferForm />} />
  <Route path="transfer2" element={<StockTransfers />} />
    {/* Dashboard Home */}
    <Route index element={<ManagerDashboard />} />
    
    {/* Reusing the Inventory components we built earlier */}
    <Route path="products" element={<ProductList />} />
    <Route path="receive" element={<InventoryReceiving />} />
    <Route path="product-catalog" element={<ProductCatalog />} />
    <Route path="inventory" element={<InventoryManagement/>} />
    
    <Route path ="reports" element={<ReportsDashboard/>}/>
    {/* Placeholder for staff management */}
    <Route path="cashiers" element={<div className="p-8">Cashier Management coming soon...</div>} />
    <Route path ="customers" element={<CustomerManagement/>}/>
    
    
  </Route>
</Route>
      

      {/* Catch-all 404 Route */}
      <Route path="*" element={<div className="p-10 text-center text-red-600 text-xl font-bold">404 - Page Not Found</div>} />
    </Routes>
  );
};

export default AppRouter;