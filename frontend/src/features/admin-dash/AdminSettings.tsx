import React, { useState, useEffect, type FormEvent } from 'react';
import api from '../../api/axiosInstance';
import { isAxiosError } from 'axios';

// --- Interfaces ---
interface TenantSettings {
  business_name: string;
  currency_symbol: string;
  receipt_footer: string;
  contact_phone: string;
  contact_email: string;
  business_address: string;
}

const AdminSettings: React.FC = () => {
  // --- State ---
  const [formData, setFormData] = useState<TenantSettings>({
    business_name: '',
    currency_symbol: '₦',
    receipt_footer: 'Thank you for your business!',
    contact_phone: '',
    contact_email: '',
    business_address: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // --- Fetch Current Settings ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/common/settings/');
        // If your backend returns an array, grab the first object. Otherwise, use the object directly.
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        
        if (data) {
          setFormData({
            business_name: data.business_name || '',
            currency_symbol: data.currency_symbol || '₦',
            receipt_footer: data.receipt_footer || '',
            contact_phone: data.contact_phone || '',
            contact_email: data.contact_email || '',
            business_address: data.business_address || '',
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setFeedback({ type: 'error', message: 'Failed to load current settings.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // --- Handlers ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      // Depending on your backend, this might be a POST, PUT, or PATCH request. 
      // Using PATCH is standard for updating specific fields in a settings singleton.
      await api.patch('/common/settings/', formData);
      
      setFeedback({ type: 'success', message: 'Settings saved successfully! Changes will reflect across the system.' });
      
      // Update local storage so the frontend can immediately use the new business name if needed
      if (formData.business_name) {
          localStorage.setItem('businessName', formData.business_name);
      }

    } catch (err: unknown) {
      if (isAxiosError(err)) {
          setFeedback({ type: 'error', message: err.response?.data?.message || err.response?.data?.detail || "Failed to save settings." });
      } else {
          setFeedback({ type: 'error', message: "An unexpected error occurred." });
      }
    } finally {
      setIsSaving(false);
      
      // Auto-hide success message after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500">Loading system settings...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Global Settings</h2>
        <p className="text-sm text-gray-500">Configure your business identity, receipt branding, and system preferences.</p>
      </div>

      {/* FEEDBACK ALERTS */}
      {feedback && (
        <div className={`p-4 rounded-lg shadow-sm border-l-4 font-medium animate-fade-in-down ${
          feedback.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'
        }`}>
          {feedback.type === 'success' ? '✅ ' : '⚠️ '} {feedback.message}
        </div>
      )}

      {/* SETTINGS FORM */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Section 1: Business Identity */}
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Business Identity & Contact</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-100">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Business Name</label>
            <input 
              type="text" 
              name="business_name"
              required
              value={formData.business_name} 
              onChange={handleChange}
              placeholder="e.g. Equest Coldroom"
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Currency Symbol</label>
            <select 
              name="currency_symbol"
              value={formData.currency_symbol} 
              onChange={handleChange}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
            >
              <option value="₦">₦ (Nigerian Naira)</option>
              <option value="$">$ (US Dollar)</option>
              <option value="£">£ (British Pound)</option>
              <option value="€">€ (Euro)</option>
              <option value="GH₵">GH₵ (Ghanaian Cedi)</option>
              <option value="KSh">KSh (Kenyan Shilling)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Support Phone Number</label>
            <input 
              type="text" 
              name="contact_phone"
              value={formData.contact_phone} 
              onChange={handleChange}
              placeholder="e.g. +234 800 000 0000"
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Support Email</label>
            <input 
              type="email" 
              name="contact_email"
              value={formData.contact_email} 
              onChange={handleChange}
              placeholder="e.g. support@equest.com"
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">Headquarters / Main Address</label>
            <textarea 
              name="business_address"
              value={formData.business_address} 
              onChange={handleChange}
              placeholder="Full address of the main business location..."
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
              rows={2}
            />
          </div>
        </div>

        {/* Section 2: Receipt Settings */}
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-800">Receipt Branding</h3>
        </div>
        <div className="p-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">Receipt Footer Message</label>
          <p className="text-xs text-gray-500 mb-2">This text will appear at the very bottom of every thermal receipt printed.</p>
          <textarea 
            name="receipt_footer"
            value={formData.receipt_footer} 
            onChange={handleChange}
            placeholder="e.g. Thank you for shopping with us! No refunds after 24 hours."
            className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
            rows={3}
          />
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end">
          <button 
            type="submit" 
            disabled={isSaving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving Changes...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default AdminSettings;