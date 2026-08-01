import { useState } from 'react';
import { ToastProvider } from '@/components/Toast';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Truck, Menu, X, HardHat, Tags, Bell,
} from 'lucide-react';
import Dashboard from '@/views/Dashboard';
import Customers from '@/views/Customers';
import Products from '@/views/Products';
import Orders from '@/views/Orders';
import Dispatches from '@/views/Dispatches';
import PriceList from '@/views/PriceList';
import Notifications from '@/views/Notifications';

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard };

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'pricelist', label: 'Price List', icon: Tags },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'dispatches', label: 'Dispatches', icon: Truck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

function App() {
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (v: string) => {
    setView(v);
    setSidebarOpen(false);
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-100">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
              <HardHat size={20} />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-800">Anbu Traders</p>
              <p className="text-xs text-slate-500">Shop Management</p>
            </div>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const active = view === item.id;
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
                </button>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4">
            <p className="text-xs text-slate-400">Order & Dispatch System</p>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-ghost p-2 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-bold capitalize text-slate-800">
              {navItems.find((n) => n.id === view)?.label ?? 'Dashboard'}
            </h1>
            <div className="ml-auto hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <span className="badge bg-emerald-100 text-emerald-700">Operational</span>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8">
            {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
            {view === 'customers' && <Customers />}
            {view === 'products' && <Products />}
            {view === 'pricelist' && <PriceList />}
            {view === 'orders' && <Orders />}
            {view === 'dispatches' && <Dispatches />}
            {view === 'notifications' && <Notifications />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;
