import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      {/* Outlet is where the child route (like your Wizard) will render */}
      <Outlet />
    </div>
  );
};

export default AuthLayout;