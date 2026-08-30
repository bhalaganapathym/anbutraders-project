import { useState, useEffect, useMemo } from 'react';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck, Menu, HardHat, Tags, Bell, LogOut, Sun, Moon, Receipt, UserSquare, Settings as SettingsIcon, MapPin, DollarSign, Globe
} from 'lucide-react';
import { useRealtime } from '@/lib/useRealtime';
import { api } from '@/lib/api';
import { useTranslation, translations } from '@/lib/i18n';
import Dashboard from '@/views/Dashboard';
import Customers from '@/views/Customers';
import Products from '@/views/Products';
import Orders from '@/views/Orders';
import Dispatches from '@/views/Dispatches';
import PriceList from '@/views/PriceList';
import Notifications from '@/views/Notifications';
import Login from '@/views/Login';
import GlobalNotificationAlert from '@/components/GlobalNotificationAlert';
import NewOrder from '@/views/NewOrder';
import Drivers from '@/views/Drivers';
import Billing from '@/views/Billing';
import Settings from '@/views/Settings';
import DriverDelivery from '@/views/DriverDelivery';
import DailyReconciliation from '@/views/DailyReconciliation';
import PublicReceipt from '@/views/PublicReceipt';

type NavConfig = { id: string; labelKey: keyof typeof translations['en']; icon: typeof LayoutDashboard };

const navConfigs: NavConfig[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'orders', labelKey: 'estimate', icon: ShoppingCart },
  { id: 'pricelist', labelKey: 'price_list', icon: Tags },
  { id: 'dispatches', labelKey: 'dispatches', icon: Truck },
  { id: 'billing', labelKey: 'billing', icon: Receipt },
  { id: 'reconciliation', labelKey: 'reconciliation', icon: DollarSign },
  { id: 'customers', labelKey: 'customers_ledger', icon: Users },
  { id: 'delivery', labelKey: 'delivery_pod', icon: MapPin },
  { id: 'products', labelKey: 'products', icon: Package },
  { id: 'drivers', labelKey: 'drivers', icon: UserSquare },
  { id: 'notifications', labelKey: 'notifications', icon: Bell },
  { id: 'settings', labelKey: 'settings', icon: SettingsIcon },
];

function AppContent() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('dashboard');
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPublicTrack, setIsPublicTrack] = useState(() => 
    typeof window !== 'undefined' && (window.location.hash.startsWith('#/track/') || window.location.hash.startsWith('#/receipt/'))
  );
  const { t, lang, changeLanguage } = useTranslation();

  // Check URL hash for public tracking route #/track/:id
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/track/') || hash.startsWith('#/receipt/')) {
        setIsPublicTrack(true);
      } else {
        setIsPublicTrack(false);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Theme management
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchUnread = async () => {
    try {
      if (!user) return;
      const data = await api.get('/notifications');
      const applicable = data.filter((n: any) => {
        const t = (n.type || '').toLowerCase();
        if (user.role === 'dispatch') {
          return t === 'order_confirmed' || 
                 t === 'advance_order_booked' || 
                 t === 'bill_generated' || 
                 t === 'ready_for_loading' ||
                 t === 'mismatch_approved' || 
                 t === 'mismatch_rejected' ||
                 t === 'weight_mismatch_decision';
        }
        if (user.role === 'driver') {
          return t === 'bill_generated' || 
                 t === 'ready_for_loading' || 
                 t === 'dispatch_completed';
        }
        return true;
      });
      setUnreadCount(applicable.filter((n: any) => !n.read).length);
    } catch { }
  };

  useEffect(() => {
    if (user) {
      fetchUnread();
      // Auto-sync background push subscription if permission already granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        import('@/lib/push').then(({ subscribeToPushNotifications }) => {
          subscribeToPushNotifications(user.role || 'all', user.id).catch(() => {});
        });
      }
    }
  }, [user]);

  useRealtime('notifications', fetchUnread);

  // Dynamic Nav Items with live translation
  const navItems = useMemo(() => {
    if (!user) return [];
    const allowed = navConfigs.filter(item => {
      if (user.role === 'admin') return true;
      if (user.role === 'billing') {
        return ['dashboard', 'orders', 'pricelist', 'billing', 'reconciliation', 'customers', 'delivery', 'products', 'notifications', 'settings'].includes(item.id);
      }
      if (user.role === 'dispatch') {
        return ['dashboard', 'dispatches', 'delivery', 'products', 'notifications'].includes(item.id);
      }
      if (user.role === 'driver') {
        return ['delivery', 'notifications'].includes(item.id);
      }
      return false;
    });

    return allowed.map(cfg => ({
      id: cfg.id,
      label: cfg.id === 'delivery' && user.role === 'driver' ? 'இன்றைய டெலிவரி (POD)' : t(cfg.labelKey),
      icon: cfg.icon,
    }));
  }, [user, t]);

  // If customer is on public tracking URL, show PublicReceipt without login
  if (isPublicTrack) {
    return <PublicReceipt />;
  }

  if (!user) {
    return <Login />;
  }

  const defaultViewForRole = user.role === 'driver' ? 'delivery' : 'dashboard';
  const activeView = view === 'new_order' ? 'new_order' : (navItems.find((n) => n.id === view)?.id || navItems[0]?.id || defaultViewForRole);

  const navigate = (v: string) => {
    setView(v);
    setSidebarOpen(false);
  };

  if (activeView === 'new_order') {
    return <NewOrder onBack={() => navigate('orders')} orderToEdit={orderToEdit} />;
  }

  const getRoleLabel = () => {
    if (user.role === 'admin') return t('role_admin');
    if (user.role === 'billing') return t('role_billing');
    if (user.role === 'dispatch') return t('role_dispatch');
    if (user.role === 'driver') return 'ஓட்டுநர் (Driver)';
    return user.role;
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <GlobalNotificationAlert />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
            <HardHat size={20} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800 dark:text-slate-100">{t('company_name')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{getRoleLabel()}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-amber-50 dark:bg-slate-800 text-amber-700 dark:text-amber-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800'
                }`}
              >
                <item.icon size={18} />
                {item.label}
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="ml-auto flex h-2.5 w-2.5 relative">
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition"
              title={t('logout')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-45 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        <header className="sticky top-0 z-20 flex shrink-0 h-14 sm:h-16 items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost p-2 lg:hidden text-slate-700 dark:text-slate-200"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold capitalize text-slate-800 dark:text-slate-100">
              {navItems.find((n) => n.id === activeView)?.label ?? t('dashboard')}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Tamil / English Switch */}
            <button
              onClick={() => changeLanguage(lang === 'en' ? 'ta' : 'en')}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-900 dark:text-amber-300 px-3 py-1.5 rounded-lg border border-amber-300/80 dark:border-slate-700 shadow-sm transition"
              title="Toggle Tamil / English"
            >
              <Globe size={14} className="text-amber-600" />
              <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
            </button>

            {/* Quick Mobile Notification Bell */}
            <button
              onClick={() => navigate('notifications')}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
              aria-label={t('notifications')}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                </span>
              )}
            </button>
            <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 capitalize text-xs sm:text-sm font-semibold">{getRoleLabel()}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-8">
          {activeView === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {activeView === 'customers' && <Customers />}
          {activeView === 'products' && <Products />}
          {activeView === 'pricelist' && <PriceList />}
          {activeView === 'orders' && <Orders onNewOrder={() => { setOrderToEdit(null); navigate('new_order'); }} onEditOrder={(o) => { setOrderToEdit(o); navigate('new_order'); }} />}
          {activeView === 'dispatches' && <Dispatches onNavigate={navigate} />}
          {activeView === 'delivery' && <DriverDelivery />}
          {activeView === 'billing' && <Billing onNavigate={navigate} />}
          {activeView === 'reconciliation' && <DailyReconciliation />}
          {activeView === 'drivers' && <Drivers />}
          {activeView === 'notifications' && <Notifications />}
          {activeView === 'settings' && <Settings />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2 shadow-lg lg:hidden">
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            activeView === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard size={20} className={activeView === 'dashboard' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('home')}</span>
        </button>

        {(user.role === 'admin' || user.role === 'billing') && (
          <button
            onClick={() => navigate('orders')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
              activeView === 'orders' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart size={20} className={activeView === 'orders' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('estimate')}</span>
          </button>
        )}

        <button
          onClick={() => navigate('delivery')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            activeView === 'delivery' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin size={20} className={activeView === 'delivery' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('delivery')}</span>
        </button>

        {(user.role === 'admin' || user.role === 'billing') && (
          <button
            onClick={() => navigate('reconciliation')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
              activeView === 'reconciliation' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign size={20} className={activeView === 'reconciliation' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('reconciliation')}</span>
          </button>
        )}

        <button
          onClick={() => navigate('settings')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            activeView === 'settings' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SettingsIcon size={20} className={activeView === 'settings' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">{t('settings')}</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  const [isPublic, setIsPublic] = useState(() =>
    typeof window !== 'undefined' && (window.location.hash.startsWith('#/track/') || window.location.hash.startsWith('#/receipt/'))
  );

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      setIsPublic(hash.startsWith('#/track/') || hash.startsWith('#/receipt/'));
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (isPublic) {
    return <PublicReceipt />;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
