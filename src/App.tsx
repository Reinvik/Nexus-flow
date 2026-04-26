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
  Map as MapIcon,
  DollarSign,
  TrendingUp,
  LogOut,
  User,
  ShieldCheck,
  ChevronRight,
  Bell,
  X
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import LoginView from '@/views/LoginView';

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
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'invoices' | 'settings' | 'routing' | 'aging' | 'forecast'>('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nexus-theme') as 'dark' | 'light') || 'dark';
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-cyan-500 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginView />
      </>
    );
  }

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
    { name: 'Punto de Venta', id: 'sales', icon: ShoppingCart },
    { name: 'Inventario', id: 'inventory', icon: PackageSearch },
    { name: 'Clientes', id: 'customers', icon: Users },
    { name: 'Facturas', id: 'invoices', icon: FileText },
    { name: 'Recaudación', id: 'aging', icon: DollarSign },
    { name: 'Forecast', id: 'forecast', icon: TrendingUp },
    { name: 'Routing', id: 'routing', icon: MapIcon },
    { name: 'Configuración', id: 'settings', icon: Settings },
  ] as const;  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-outfit selection:bg-primary/30 selection:text-white">
      <Toaster position="top-right" />
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - Nexus Lean Style */}
      <aside 
        className={`
          fixed lg:relative inset-y-0 left-0 z-[100] h-full bg-sidebar-bg border-r border-slate-200 dark:border-white/5 
          transition-all duration-500 ease-in-out flex flex-col
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-24 -translate-x-full lg:translate-x-0'}
          ${!sidebarOpen && 'lg:w-24'}
        `}
      >
        {/* Decorative background blur */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col h-full relative z-10">
          {/* Header */}
          <div className="h-16 lg:h-20 flex items-center px-6 gap-3 shrink-0">
            {/* Toggle Button - Desktop Only */}
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="hidden lg:flex p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-400 transition-all duration-300 mr-auto"
            >
              <Menu size={20} />
            </button>

            {/* Close Button - Mobile Only */}
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="lg:hidden p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-400 ml-auto"
            >
              <X size={24} />
            </button>
          </div>
          
          {/* Nav Section */}
          <nav className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-1 py-4">
            {sidebarOpen && (
              <div className="px-4 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] opacity-30">Menú Principal</div>
            )}
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isDesktopCollapsed = !sidebarOpen;

              const activeStyle = isActive ? {
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#0f172a',
                color: '#ffffff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              } : {};

              const inactiveClass = 'text-slate-500 hover:text-primary dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id as any);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative tap-highlight-none ${!isActive ? inactiveClass : ''}`}
                  style={activeStyle}
                  title={isDesktopCollapsed ? item.name : undefined}
                >
                  <Icon
                    size={20}
                    className={`shrink-0 transition-all duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}
                    style={isActive ? { color: '#22d3ee', filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.5))' } : {}}
                  />

                  {(sidebarOpen || window.innerWidth < 1024) && (
                    <span
                      className={`font-black whitespace-nowrap text-sm tracking-wide transition-all duration-300 ${!isActive ? 'opacity-60 group-hover:opacity-100 group-hover:translate-x-1' : ''}`}
                      style={isActive ? { color: '#ffffff', opacity: 1 } : {}}
                    >
                      {item.name}
                    </span>
                  )}

                  {isActive && (sidebarOpen || window.innerWidth < 1024) && (
                    <div className="absolute left-0 w-1.5 h-6 bg-primary rounded-r-full shadow-[0_0_12px_rgba(6,182,212,0.5)]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20">
            <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all duration-300 group cursor-pointer tap-highlight-none">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm border border-slate-200 dark:border-white/10 group-hover:border-cyan-500/50 shadow-lg transition-all">
                  <span className="text-white font-black">{user.email?.charAt(0).toUpperCase()}</span>
                </div>
              </div>

              {(sidebarOpen || window.innerWidth < 1024) && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user.email?.split('@')[0]}</p>
                </div>
              )}
            </div>

            <div className={`mt-3 flex gap-2 ${(!sidebarOpen && window.innerWidth >= 1024) ? 'flex-col' : 'flex-row'}`}>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex-1 flex items-center justify-center p-2.5 rounded-lg bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-500 hover:text-primary dark:hover:text-white transition-all duration-300 tap-highlight-none"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={signOut}
                className="flex-1 flex items-center justify-center p-2.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all duration-300 border border-transparent hover:border-red-500/20 tap-highlight-none"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background relative flex flex-col no-scrollbar">
        {/* Mobile Header */}
        <header className="lg:hidden h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors tap-highlight-none"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-black tracking-tighter text-foreground">
            NEXUS <span className="text-primary">FLOW</span>
          </h1>
          <button className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors tap-highlight-none relative">
            <Bell size={20} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-background" />
          </button>
        </header>

        {/* Content Container */}
        <div className={`w-full max-w-[1700px] mx-auto transition-all duration-500 ${currentView === 'sales' ? 'p-2 md:p-3 lg:p-3' : 'p-3 md:p-4 lg:p-4'}`}>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {currentView === 'dashboard' && <DashboardView onNavigate={setCurrentView} />}
            {currentView === 'inventory' && <InventoryView />}
            {currentView === 'sales' && <SalesView />}
            {currentView === 'customers' && (
              <CustomersView 
                onNavigate={setCurrentView} 
                onSelectInvoice={(id) => setSelectedInvoiceId(id)} 
              />
            )}
            {currentView === 'invoices' && (
              <InvoicesView 
                initialInvoiceId={selectedInvoiceId} 
                onClearInvoice={() => setSelectedInvoiceId(null)} 
              />
            )}
            {currentView === 'aging' && <AgingView />}
            {currentView === 'forecast' && <ForecastView />}

            {currentView === 'routing' && <RoutingView />}
            {currentView === 'settings' && <SettingsView />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

