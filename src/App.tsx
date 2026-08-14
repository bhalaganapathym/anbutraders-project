import { useState, useEffect } from 'react';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck, Menu, HardHat, Tags, Bell, LogOut, Sun, Moon, Receipt, UserSquare, Settings as SettingsIcon
} from 'lucide-react';
import { useRealtime } from '@/lib/useRealtime';
import { api } from '@/lib/api';
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

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard };

const allNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pricelist', label: 'Price List', icon: Tags },
  { id: 'orders', label: 'Estimate', icon: ShoppingCart },
  { id: 'dispatches', label: 'Dispatches', icon: Truck },
  { id: 'billing', label: 'Billing', icon: Receipt },
  { id: 'drivers', label: 'Drivers', icon: UserSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function AppContent() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('dashboard');
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const fetchUnread = async () => {
    try {
      if (!user) return;
      const data = await api.get('/notifications');
      // Simple frontend filtering for unread notifications applicable to the user
      const applicable = data.filter((n: any) => {
        if (user.role === 'dispatch') return n.type === 'order_confirmed';
        if (user.role === 'billing') return n.type === 'dispatch_completed' || n.type === 'photo_uploaded' || n.type === 'billing_alert';
        return true;
      });
      setUnreadCount(applicable.filter((n: any) => !n.read).length);
    } catch { }
  };

  useEffect(() => {
    if (user) fetchUnread();
  }, [user]);

  useRealtime('notifications', fetchUnread);

  if (!user) {
    return <Login />;
  }

  const navItems = allNavItems.filter(item => {
    if (user.role === 'admin') return true;
    if (user.role === 'billing') {
      return ['dashboard', 'customers', 'products', 'orders', 'billing', 'notifications', 'settings'].includes(item.id);
    }
    if (user.role === 'dispatch') {
      return ['dashboard', 'products', 'dispatches', 'notifications'].includes(item.id);
    }
    return false;
  });

  const activeView = view === 'new_order' ? 'new_order' : (navItems.find((n) => n.id === view)?.id || navItems[0]?.id || 'dashboard');

  const navigate = (v: string) => {
    setView(v);
    setSidebarOpen(false);
  };

  if (activeView === 'new_order') {
    return <NewOrder onBack={() => navigate('orders')} orderToEdit={orderToEdit} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      <GlobalNotificationAlert />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
            <HardHat size={20} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">Anbu Traders</p>
            <p className="text-xs text-slate-500 capitalize">{user.role} Panel</p>
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
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
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
        
        <div className="shrink-0 border-t border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">{user.username}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition"
              title="Logout"
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
        <header className="sticky top-0 z-20 flex shrink-0 h-14 sm:h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 sm:px-4 backdrop-blur lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost p-2 lg:hidden text-slate-700"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold capitalize text-slate-800">
              {navItems.find((n) => n.id === activeView)?.label ?? 'Dashboard'}
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Quick Mobile Notification Bell */}
            <button
              onClick={() => navigate('notifications')}
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                </span>
              )}
            </button>
            <span className="badge bg-emerald-100 text-emerald-700 capitalize text-xs sm:text-sm">{user.role}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-8">
          {activeView === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {activeView === 'customers' && <Customers />}
          {activeView === 'products' && <Products />}
          {activeView === 'pricelist' && <PriceList />}
          {activeView === 'orders' && <Orders onNewOrder={() => { setOrderToEdit(null); navigate('new_order'); }} onEditOrder={(o) => { setOrderToEdit(o); navigate('new_order'); }} />}
          {activeView === 'dispatches' && <Dispatches />}
          {activeView === 'billing' && <Billing />}
          {activeView === 'drivers' && <Drivers />}
          {activeView === 'notifications' && <Notifications />}
          {activeView === 'settings' && <Settings />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed for single-thumb access on phones) */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur px-2 shadow-lg lg:hidden">
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            activeView === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard size={20} className={activeView === 'dashboard' ? 'scale-110' : ''} />
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </button>

        {(user.role === 'admin' || user.role === 'billing') && (
          <button
            onClick={() => navigate('orders')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
              activeView === 'orders' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart size={20} className={activeView === 'orders' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight">Estimate</span>
          </button>
        )}

        {(user.role === 'admin' || user.role === 'dispatch') && (
          <button
            onClick={() => navigate('dispatches')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
              activeView === 'dispatches' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck size={20} className={activeView === 'dispatches' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight">Dispatch</span>
          </button>
        )}

        {(user.role === 'admin' || user.role === 'billing') && (
          <button
            onClick={() => navigate('billing')}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 transition ${
              activeView === 'billing' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={20} className={activeView === 'billing' ? 'scale-110' : ''} />
            <span className="text-[10px] mt-0.5 tracking-tight">Billing</span>
          </button>
        )}

        <button
          onClick={() => navigate('notifications')}
          className={`relative flex flex-col items-center justify-center flex-1 py-1.5 transition ${
            activeView === 'notifications' ? 'text-amber-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Bell size={20} className={activeView === 'notifications' ? 'scale-110' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Alerts</span>
        </button>

        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1.5 text-slate-500 hover:text-slate-800 transition"
        >
          <Menu size={20} />
          <span className="text-[10px] mt-0.5 tracking-tight">More</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
