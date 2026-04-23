import { useState, useEffect } from 'react';
import { 
  PackageSearch, 
  ShoppingCart, 
  LayoutDashboard, 
  Sun, 
  Moon, 
  Menu, 
  Users, 
  FileText, 
  Settings,
  Truck,
  Map as MapIcon,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// Views
import InventoryView from '@/views/InventoryView';
import SalesView from '@/views/SalesView';
import DashboardView from '@/views/DashboardView';
import CustomersView from '@/views/CustomersView';
import InvoicesView from '@/views/InvoicesView';
import SettingsView from '@/views/SettingsView';
import RoutingView from '@/views/RoutingView';
import AgingView from '@/views/AgingView';
import ForecastView from '@/views/ForecastView';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'invoices' | 'settings' | 'transfers' | 'routing' | 'aging' | 'forecast'>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Punto de Venta', id: 'sales', icon: ShoppingCart },
    { name: 'Inventario', id: 'inventory', icon: PackageSearch },
    { name: 'Clientes', id: 'customers', icon: Users },
    { name: 'Facturas', id: 'invoices', icon: FileText },
    { name: 'Recaudación', id: 'aging', icon: DollarSign },
    { name: 'Forecast', id: 'forecast', icon: TrendingUp },
    { name: 'Traspasos', id: 'transfers', icon: Truck },
    { name: 'Routing', id: 'routing', icon: MapIcon },
    { name: 'Configuración', id: 'settings', icon: Settings },
  ] as const;

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} h-full bg-sidebar-bg border-r border-card-border p-4 transition-all duration-300 flex flex-col justify-between shrink-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8 px-2 overflow-hidden justify-between">
            {sidebarOpen && <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-slate-400 bg-clip-text text-transparent truncate flex-1">Nexus Flow</h1>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-800 text-sidebar-text shrink-0">
              <Menu size={20} />
            </button>
          </div>
          
          <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id as any)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    currentView === item.id
                      ? 'bg-primary text-white shadow-[0_8px_20px_-6px_rgba(59,130,246,0.5)]'
                      : 'text-sidebar-text hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.name : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  {sidebarOpen && <span className="font-medium whitespace-nowrap text-sm">{item.name}</span>}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-2 p-3 w-full justify-center rounded-xl hover:bg-slate-800 text-sidebar-text transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              {sidebarOpen && <span className="text-sm font-medium">{theme === 'dark' ? 'Modo Día' : 'Modo Oscuro'}</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background p-6 lg:p-10">
        <div className="max-w-7xl mx-auto h-full">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'sales' && <SalesView />}
          {currentView === 'customers' && <CustomersView />}
          { currentView === 'invoices' && <InvoicesView /> }
          { currentView === 'aging' && <AgingView /> }
          { currentView === 'forecast' && <ForecastView /> }
          { currentView === 'transfers' && (
            <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
              <Truck size={64} />
              <p className="text-xl font-bold">Módulo de Traspasos próximamente</p>
            </div>
          )}
          {currentView === 'routing' && <RoutingView />}
          {currentView === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

export default App;

