import React, { useState, type ChangeEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';

// --- Types ---
interface Branch {
  id: number;
  name: string;
  code: string; // Added Branch Code
  location: string;
}

interface Cashier {
  id: number;
  name: string;
  email: string;
  branchId: string | number; 
}

interface TenantFormData {
  businessName: string;
  subdomain: string;
  adminEmail: string;
  adminPassword: string;
  branches: Branch[];
  cashiers: Cashier[];
}

const POSOnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  
  // UI States for the "Chain Reaction"
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(''); // To show "Creating Branch 1..."
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<TenantFormData>({
    businessName: '',
    subdomain:'',
    adminEmail: '',
    adminPassword: '',
    branches: [{ id: Date.now(), name: '', code: '', location: '' }],
    cashiers: []
  });

  // --- Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBranchChange = (id: number, field: keyof Omit<Branch, 'id'>, value: string) => {
    const updatedBranches = formData.branches.map(branch => 
      branch.id === id ? { ...branch, [field]: value } : branch
    );
    setFormData({ ...formData, branches: updatedBranches });
  };

  const addBranch = () => {
    setFormData({
      ...formData,
      branches: [...formData.branches, { id: Date.now(), name: '', code: '', location: '' }]
    });
  };

  {// ... (Cashier handlers remain the same) ...
  /* const addCashier = () => {
    setFormData({
      ...formData,
      cashiers: [...formData.cashiers, { id: Date.now(), name: '', email: '', branchId: '' }]
    });
  }; */}

  {/* const handleCashierChange = (id: number, field: keyof Omit<Cashier, 'id'>, value: string) => {
    const updatedCashiers = formData.cashiers.map(cashier => 
      cashier.id === id ? { ...cashier, [field]: value } : cashier
    );
    setFormData({ ...formData, cashiers: updatedCashiers });
  }; */}

  // --- The Orchestrated Submission ---
  const submitOnboarding = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // --- STEP 1: Register Tenant & Admin ---
      setStatusMessage('Registering Business...');
      
      const registerPayload = {
        company_name: formData.businessName,
        subdomain: formData.subdomain,
        email: formData.adminEmail,
        password: formData.adminPassword
      };

      // 1. POST to Tenant Registration Endpoint
       await api.post('/auth/register/', registerPayload);

       setStatusMessage('Authenticating...');
      
      const loginPayload = {
        email: formData.adminEmail,
        password: formData.adminPassword
      }; 
      
      const loginResponse = await api.post('/auth/login/', loginPayload);

      //Extract Token (Check for 'access' or 'token')
      const token = loginResponse.data.access || loginResponse.data.token;
      

      if (!token) throw new Error("Login failed: Could not retrieve authentication token.");   

      // 3. Set Token in LocalStorage so axiosInstance picks it up for the next calls
      localStorage.setItem('accessToken', token);
      
      // Optional: Set default auth header for immediate subsequent calls in this specific function scope
      // (Just in case the interceptor needs a page reload to pick up the change, though usually it doesn't)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;


      // --- STEP 2: Create Branches ---
      if (formData.branches.length > 0) {
        setStatusMessage('Creating Branches...');
        
        // We use a loop to create them one by one (or Promise.all for parallel)
        // Sequential is often safer for beginners to debug
        for (const branch of formData.branches) {
           if (!branch.name) continue; // Skip empty rows

           const branchPayload = {
             name: branch.name,
             code: branch.code,
             location: branch.location
           };

           await api.post('/branches/', branchPayload); // Adjust URL to your actual endpoint
        }
      }

      // --- STEP 3: Create Cashiers (If you have an endpoint for this too) ---
      // You would loop through formData.cashiers here similarly...
      
      setStatusMessage('Setup Complete!');
      alert("Account and Branches created successfully!");
      navigate('/admin'); // Redirect to dashboard

    } catch (error: unknown) {
      console.error("Onboarding failed:", error);
      if (isAxiosError(error)) {
        const msg = error.response?.data?.message || JSON.stringify(error.response?.data) || error.message;
        setSubmitError(msg);
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    } finally {
      setIsSubmitting(false);
      setStatusMessage('');
    }
  };

  // --- Render Function ---
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
             {/* ... Business Inputs (Same as before) ... */}
            <h2 className="text-xl font-bold text-gray-800">1. Register Business</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Coldroom Business Name</label>
              <input type="text" name="businessName" value={formData.businessName} onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sub-domain/slug</label>
              <input type="text" name="subdomain" value={formData.subdomain} onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Admin Email</label>
              <input type="email" name="adminEmail" value={formData.adminEmail} onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Admin Password</label>
              <input type="password" name="adminPassword" value={formData.adminPassword} onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" required />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">2. Setup Branches</h2>
            <p className="text-sm text-gray-500">Add the physical locations for your coldrooms.</p>
            {formData.branches.map((branch, index) => (
              <div key={branch.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                <div className="flex justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Branch {index + 1}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <input type="text" value={branch.name} onChange={(e) => handleBranchChange(branch.id, 'name', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" placeholder="Branch Name (e.g. Downtown Hub)" />
                    </div>
                    
                    {/* NEW: Branch Code Input */}
                    <div>
                        <input type="text" value={branch.code} onChange={(e) => handleBranchChange(branch.id, 'code', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" placeholder="Code (e.g. LAG-01)" />
                    </div>
                    
                    <div>
                        <input type="text" value={branch.location} onChange={(e) => handleBranchChange(branch.id, 'location', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2 border text-sm" placeholder="Location / Address" />
                    </div>
                </div>
              </div>
            ))}
            <button onClick={addBranch} className="text-blue-600 text-sm font-medium hover:text-blue-800">
              + Add Another Branch
            </button>
          </div>
        );
      case 3:
        // ... (Keep Cashier Step if you still want to collect them, 
        // but note you'll need a loop in submitOnboarding for them too) ...
        return (
            <div className="space-y-4">
                 <h2 className="text-xl font-bold text-gray-800">3. Provision Cashiers</h2>
                 <p className="text-gray-500 text-sm">You can skip this and add cashiers later from the dashboard.</p>
                 {/* ... existing cashier UI ... */}
            </div>
        )
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-xl shadow-lg p-8">
        
        {/* Progress Bar (Same as before) */}
        <div className="flex items-center justify-between mb-8">
            {/* ... */}
        </div>

        {renderStepContent()}

        {/* Status Message for Multi-Step Submission */}
        {statusMessage && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-sm rounded flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {statusMessage}
            </div>
        )}

        {submitError && (
          <div className="mt-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {submitError}
          </div>
        )}

        {/* Buttons (Same as before) */}
        <div className="mt-8 flex justify-between">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 border rounded">Back</button>}
            <div className="ml-auto">
                {step < 3 ? (
                    <button onClick={() => setStep(step + 1)} className="px-6 py-2 bg-blue-600 text-white rounded">Next Step</button>
                ) : (
                    <button onClick={submitOnboarding} disabled={isSubmitting} className="px-6 py-2 bg-green-600 text-white rounded">
                        {isSubmitting ? 'Processing...' : 'Complete Setup'}
                    </button>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default POSOnboardingWizard;