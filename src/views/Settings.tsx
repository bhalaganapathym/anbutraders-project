import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';

export default function Settings() {
  const [threshold, setThreshold] = useState<string>('3');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.get('/settings/weight_difference_threshold');
      if (data && data.value) {
        setThreshold(data.value);
      }
    } catch {
      // It's normal for it to 404 on first load if not set
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/weight_difference_threshold', {
        value: threshold,
        description: 'Allowed weight difference in kg before triggering a warning on dispatch'
      });
      toast('Settings saved successfully', 'success');
    } catch {
      toast('Failed to save settings', 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingsIcon size={24} className="text-indigo-600" />
            System Settings
          </h1>
          <p className="text-gray-500">Configure global application parameters.</p>
        </div>
        <button onClick={fetchSettings} className="p-2 text-gray-500 hover:text-indigo-600 bg-white rounded-lg border shadow-sm">
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Dispatch Settings</h2>
          
          <div className="max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allowed Weight Difference (kg)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              The maximum allowed difference between estimated weight and actual recorded weight before blocking dispatch verification.
            </p>
            <div className="flex gap-3 items-center">
              <input
                type="number"
                step="0.1"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="input max-w-[150px]"
              />
              <span className="text-gray-500 font-medium">kg</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
