import { useState, useEffect } from 'react';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck, Menu, HardHat, Tags, Bell, LogOut, Sun, Moon
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

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard };

const allNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pricelist', label: 'Price List', icon: Tags },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'dispatches', label: 'Dispatches', icon: Truck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

function AppContent() {
  const { user, logout } = useAuth();
  const [view, setView] = useState('dashboard');
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
      return ['dashboard', 'customers', 'products', 'orders', 'notifications'].includes(item.id);
    }
    if (user.role === 'dispatch') {
      return ['dashboard', 'products', 'dispatches', 'notifications'].includes(item.id);
    }
    return false;
  });

  const currentNav = navItems.find((n) => n.id === view) || navItems[0];
  const activeView = currentNav?.id || 'dashboard';

  const navigate = (v: string) => {
    setView(v);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden text-slate-800 dark:text-slate-100">
      <GlobalNotificationAlert />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } glass-panel lg:my-4 lg:ml-4 lg:rounded-2xl rounded-r-2xl lg:border border-white/20 dark:border-slate-700/50`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/20 dark:border-slate-700/50 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shadow-inner'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {item.label}
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="ml-auto flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="shrink-0 border-t border-white/20 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            </div>
            <button 
              onClick={logout}
              className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 transition"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <header className="sticky top-0 z-20 flex shrink-0 h-16 items-center gap-3 lg:mx-4 lg:mt-4 lg:rounded-2xl glass-panel px-4 lg:px-6 shadow-sm border-b lg:border border-white/20 dark:border-slate-700/50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost p-2 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold capitalize text-slate-800 dark:text-slate-100">
            {navItems.find((n) => n.id === activeView)?.label ?? 'Dashboard'}
          </h1>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-full" title="Toggle Theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="hidden sm:inline-flex badge bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 capitalize backdrop-blur-md border border-indigo-500/30">
              {user.role}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {activeView === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {activeView === 'customers' && <Customers />}
          {activeView === 'products' && <Products />}
          {activeView === 'pricelist' && <PriceList />}
          {activeView === 'orders' && <Orders />}
          {activeView === 'dispatches' && <Dispatches />}
          {activeView === 'notifications' && <Notifications />}
        </main>
      </div>
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
