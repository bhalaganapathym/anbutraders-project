import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { 
  Settings as SettingsIcon, Save, RefreshCw, MessageSquare, HardHat, Check, RotateCcw, Image as ImageIcon,
  Database, Download, Trash2, ShieldCheck
} from 'lucide-react';
import { DEFAULT_WHATSAPP_TEMPLATE, DEFAULT_COMPANY_IMAGE_URL, formatWhatsAppMessage, type WhatsAppTemplateData } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n';

export default function Settings() {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState<string>('3');
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(DEFAULT_WHATSAPP_TEMPLATE);
  const [companyName, setCompanyName] = useState<string>('ANBU TRADERS');
  const [companyPhone, setCompanyPhone] = useState<string>('0413-2964204, 9626325204');
  const [companyImageUrl, setCompanyImageUrl] = useState<string>(DEFAULT_COMPANY_IMAGE_URL);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const availableTags = [
    { tag: '{customer_name}', desc: 'Customer Name' },
    { tag: '{dispatch_no}', desc: 'Dispatch Ref' },
    { tag: '{vehicle_number}', desc: 'Truck No.' },
    { tag: '{driver_name}', desc: 'Driver Name' },
    { tag: '{driver_phone}', desc: 'Driver Mobile' },
    { tag: '{total_amount}', desc: 'Total Amount' },
    { tag: '{paid_amount}', desc: 'Advance Paid' },
    { tag: '{balance_to_collect}', desc: 'Balance to Collect' },
    { tag: '{items_summary}', desc: 'Items Summary' },
    { tag: '{delivery_address}', desc: 'Site Location' },
    { tag: '{image_url}', desc: 'Company Image / Logo URL' },
  ];

  const sampleData: WhatsAppTemplateData = {
    customer_name: 'BHALAGANAPATHY M',
    dispatch_no: 'DSP-0001',
    vehicle_number: 'TN01AB1234',
    driver_name: 'Ravi Kumar',
    driver_phone: '9787305802',
    items_summary: '13 nos SUMANGALA TMT 12mm (132 kg)',
    total_amount: 975.0,
    paid_amount: 400.0,
    balance_to_collect: 575.0,
    delivery_address: 'No.4/5 Pondy Mailam Road, Vanur',
    image_url: companyImageUrl,
    company_name: companyName,
    company_phone: companyPhone,
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const allSettings: any = await api.get('/settings');
      if (Array.isArray(allSettings)) {
        for (const s of allSettings) {
          if (s.key === 'weight_difference_threshold' && s.value) setThreshold(s.value);
          if (s.key === 'whatsapp_dispatch_template' && s.value) setWhatsappTemplate(s.value);
          if (s.key === 'company_name' && s.value) setCompanyName(s.value);
          if (s.key === 'company_phone' && s.value) setCompanyPhone(s.value);
          if (s.key === 'company_image_url' && s.value) setCompanyImageUrl(s.value);
        }
      }
    } catch {
      // Defaults will be used
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInsertTag = (tag: string) => {
    const el = textareaRef.current;
    if (!el) {
      setWhatsappTemplate(prev => prev + ' ' + tag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextText = whatsappTemplate.substring(0, start) + tag + whatsappTemplate.substring(end);
    setWhatsappTemplate(nextText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.put('/settings/weight_difference_threshold', {
          value: threshold,
          description: 'Allowed weight difference in kg before triggering a warning on dispatch'
        }),
        api.put('/settings/whatsapp_dispatch_template', {
          value: whatsappTemplate,
          description: 'Customizable WhatsApp customer dispatch message template'
        }),
        api.put('/settings/company_name', {
          value: companyName,
          description: 'Trading company name'
        }),
        api.put('/settings/company_phone', {
          value: companyPhone,
          description: 'Trading company support phone numbers'
        }),
        api.put('/settings/company_image_url', {
          value: companyImageUrl,
          description: 'Official company logo / banner image URL for WhatsApp previews'
        }),
      ]);
      toast('All settings & WhatsApp template saved successfully', 'success');
    } catch {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewMessage = formatWhatsAppMessage(whatsappTemplate, sampleData);

  if (loading) return <div className="p-6">Loading settings...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <SettingsIcon size={24} className="text-amber-600" />
            {t('settings_title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('company_tagline')}
          </p>
        </div>
        <button onClick={fetchSettings} className="p-2 text-slate-500 hover:text-amber-600 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 1. WHATSAPP TEMPLATE & BRANDING */}
      <div className="card overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{t('whatsapp_template_title')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('company_name_lbl')} & {t('company_logo_lbl')}</p>
            </div>
          </div>

          <button
            onClick={() => {
              setWhatsappTemplate(DEFAULT_WHATSAPP_TEMPLATE);
              setCompanyImageUrl(DEFAULT_COMPANY_IMAGE_URL);
            }}
            className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
            title="Reset to default template"
          >
            <RotateCcw size={13} /> Reset Template
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Template Editor */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company Display Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company Support Phone</label>
                <input
                  type="text"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <ImageIcon size={14} className="text-amber-600" /> Company Logo / Image URL
              </label>
              <input
                type="url"
                value={companyImageUrl}
                onChange={(e) => setCompanyImageUrl(e.target.value)}
                placeholder="https://... (direct image link)"
                className="input text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">This image URL unfurls in WhatsApp showing the Anbu Traders logo to the customer.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Message Content
              </label>
              <textarea
                ref={textareaRef}
                rows={10}
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
                className="input font-mono text-xs leading-relaxed"
                placeholder="Enter WhatsApp message template..."
              />
            </div>

            {/* Quick Variable Tags */}
            <div>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Click to insert dynamic variable tag:</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map(({ tag, desc }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-slate-700 hover:bg-amber-100 transition"
                    title={desc}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live WhatsApp Chat Bubble Preview with Anbu Traders Image */}
          <div className="flex flex-col">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Customer WhatsApp Live Preview</span>
              <span className="text-[11px] font-normal text-slate-400">Simulated Rich Media Preview</span>
            </p>

            <div className="flex-1 bg-[#EFEAE2] dark:bg-[#121b22] rounded-xl p-4 border border-[#e0d6c9] dark:border-slate-800 flex flex-col justify-start relative shadow-inner overflow-hidden min-h-[360px]">
              {/* WhatsApp Chat Header */}
              <div className="bg-[#008069] text-white p-2.5 rounded-lg flex items-center gap-2.5 mb-3 shadow-sm">
                <div className="h-8 w-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden">
                  {companyImageUrl ? (
                    <img src={companyImageUrl} alt="Logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                  ) : (
                    <HardHat size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs truncate">{companyName}</p>
                  <p className="text-[10px] text-emerald-100 truncate">Official Verified Business Account</p>
                </div>
              </div>

              {/* Message Balloon */}
              <div className="self-end max-w-[95%] sm:max-w-[85%] bg-[#D9FDD3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tr-sm p-3.5 shadow text-xs whitespace-pre-wrap font-sans leading-relaxed border border-emerald-200/40">
                {/* Media Preview Card */}
                {companyImageUrl && (
                  <div className="mb-2.5 bg-white dark:bg-slate-900/80 rounded-xl overflow-hidden border border-emerald-300/50 dark:border-slate-700 shadow-sm">
                    <div className="h-28 w-full bg-amber-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                      <img src={companyImageUrl} alt="Anbu Traders" className="h-full w-full object-contain p-1" />
                    </div>
                    <div className="p-2 text-[11px] font-bold text-slate-800 dark:text-slate-200 border-t border-slate-100 dark:border-slate-800">
                      🏢 {companyName} Official Dispatch
                    </div>
                  </div>
                )}

                {previewMessage}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-emerald-200/80 mt-1">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <Check size={12} className="text-blue-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. DISPATCH TOLERANCE SETTINGS */}
      <div className="card p-5 border border-slate-200 dark:border-slate-800">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3">Weight Verification Settings</h2>
        <div className="max-w-md">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Allowed Weight Difference Threshold (kg)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            The allowable tolerance variance in kg before triggering an overweight / underweight alert.
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.1"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="input max-w-[140px] text-sm"
            />
            <span className="text-slate-500 font-medium text-sm">kg</span>
          </div>
        </div>
      </div>

      {/* 3. DATABASE STORAGE SAFEGUARD & EXCEL BACKUP */}
      <div className="card p-5 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Database Storage Safeguard & Data Backup</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Protect your Supabase 500MB free-tier limits with 1-click historical Excel backups and safe archival.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* 1-Click Complete Backup */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Download size={14} className="text-blue-600" /> Full System Data Export (JSON/Excel)
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Downloads complete backup of all Customers, Orders, Dispatches, and Billing ledgers to your device.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const [custs, ords, disps, notifs] = await Promise.all([
                    api.get('/customers'),
                    api.get('/orders'),
                    api.get('/dispatches'),
                    api.get('/notifications')
                  ]);
                  const backupObj = {
                    backup_date: new Date().toISOString(),
                    company: 'Anbu Traders',
                    customers: custs,
                    orders: ords,
                    dispatches: disps,
                    notifications: notifs
                  };
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
                  const dlAnchor = document.createElement('a');
                  dlAnchor.setAttribute('href', dataStr);
                  dlAnchor.setAttribute('download', `Anbu_Traders_Full_Backup_${new Date().toISOString().split('T')[0]}.json`);
                  document.body.appendChild(dlAnchor);
                  dlAnchor.click();
                  document.body.removeChild(dlAnchor);
                  toast('Full database backup downloaded successfully', 'success');
                } catch {
                  toast('Failed to generate system backup', 'error');
                }
              }}
              className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1.5 w-full font-bold"
            >
              <Download size={14} /> Download System Backup
            </button>
          </div>

          {/* Clean Up Old Notifications & Bloat */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" /> Storage Optimizer & Cleanup
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Clears read notifications and temporary photo logs to ensure Supabase storage stays under 25MB.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Clear all notifications to optimize Supabase database storage?')) return;
                try {
                  await api.delete('/notifications/clear-all');
                  toast('Database optimized! All notification storage freed.', 'success');
                } catch {
                  toast('Failed to optimize storage', 'error');
                }
              }}
              className="text-xs py-2 px-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-100 flex items-center justify-center gap-1.5 w-full transition"
            >
              <Trash2 size={14} /> Optimize & Free Database Storage
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-md shadow-amber-600/20"
        >
          <Save size={18} /> {saving ? 'Saving Settings...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
