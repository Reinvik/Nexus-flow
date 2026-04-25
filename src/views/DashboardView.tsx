import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Users, 
  FileText, 
  AlertCircle, 
  MapPin, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
  ChevronRight,
  TrendingDown,
  BarChart3,
  Target,
  Zap,
  Globe,
  ArrowRight,
  Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/formatters';

interface DashboardProps {
  onNavigate?: (view: any) => void;
}

export default function DashboardView({ onNavigate }: DashboardProps) {
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    totalInvoices: 0,
    totalClients: 0,
    criticalStock: 0,
    weeklyExpirations: 0,
    overdueDebt: 0,
    debtByCommune: [] as { commune: string; amount: number }[],
    loading: true
  });

  useEffect(() => {
    async function fetchMetrics() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      const endOfWeek = new Date(now.setDate(diff + 6));
      startOfWeek.setHours(0, 0, 0, 0);
      endOfWeek.setHours(23, 59, 59, 999);

      try {
        const [
          { data: sales },
          { count: invoicesCount },
          { count: clients },
          { count: stock },
          { data: pendingInvoices }
        ] = await Promise.all([
          supabase.from('nf_sales').select('total_with_tax').gte('created_at', todayStart.toISOString()),
          supabase.from('nf_invoices').select('*', { count: 'exact', head: true }),
          supabase.from('nf_clients').select('*', { count: 'exact', head: true }),
          supabase.from('nf_products').select('*', { count: 'exact', head: true }).lte('stock', 5),
          supabase.from('nf_invoices')
            .select(`
              total_amount, 
              paid_amount, 
              payment_due_date,
              issued_at,
              client:nf_clients!nf_invoices_client_id_fkey (commune)
            `)
            .neq('status', 'Pagada')
        ]);

        const todayTotal = sales?.reduce((acc, s) => acc + Number(s.total_with_tax), 0) || 0;
        
        const communeDebtMap: Record<string, number> = {};
        let weeklyTotal = 0;
        let overdueTotal = 0;

        pendingInvoices?.forEach(inv => {
          const debt = Number(inv.total_amount) - Number(inv.paid_amount);
          const commune = (inv.client as any)?.commune || 'Sin Comuna';
          
          communeDebtMap[commune] = (communeDebtMap[commune] || 0) + debt;

          let dueDate: Date | null = null;
          if (inv.payment_due_date) {
            dueDate = new Date(inv.payment_due_date);
          } else if (inv.issued_at) {
            dueDate = new Date(inv.issued_at);
            dueDate.setDate(dueDate.getDate() + 30);
          }

          if (dueDate) {
            dueDate.setHours(0, 0, 0, 0);
            if (dueDate >= startOfWeek && dueDate <= endOfWeek) weeklyTotal += debt;
            if (dueDate < todayStart) overdueTotal += debt;
          }
        });

        const debtByCommune = Object.entries(communeDebtMap)
          .map(([commune, amount]) => ({ commune, amount }))
          .sort((a, b) => b.amount - a.amount);

        setMetrics({
          todaySales: todayTotal,
          totalInvoices: invoicesCount || 0,
          totalClients: clients || 0,
          criticalStock: stock || 0,
          weeklyExpirations: weeklyTotal,
          overdueDebt: overdueTotal,
          debtByCommune: debtByCommune.slice(0, 8),
          loading: false
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    }

    fetchMetrics();
  }, []);

  const stats = [
    { 
      name: 'Flujo del Día', 
      value: metrics.todaySales, 
      icon: TrendingUp, 
      color: 'text-cyan-500',
      label: 'Performance 24h',
      trend: '+12.5%'
    },
    { 
      name: 'Vencimientos', 
      value: metrics.weeklyExpirations, 
      icon: Clock, 
      color: 'text-indigo-500',
      label: 'Próximos 7 días',
      trend: 'Preventivo'
    },
    { 
      name: 'Cartera Vencida', 
      value: metrics.overdueDebt, 
      icon: AlertCircle, 
      color: 'text-rose-500',
      label: 'Riesgo Activo',
      trend: 'Crítico'
    },
    { 
      name: 'Quiebre Stock', 
      value: metrics.criticalStock, 
      icon: Activity, 
      color: 'text-amber-500',
      label: 'Reabastecimiento',
      trend: 'Logística'
    },
  ];

  return (
    <div className="space-y-4 lg:h-[calc(100vh-120px)] flex flex-col font-outfit animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-3 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Zap size={14} className="text-white" fill="currentColor" />
             </div>
             <p className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.4em]">Nexus Intelligence</p>
          </div>
          <h2 className="text-xl font-black tracking-tighter text-foreground uppercase leading-none">Dashboard <span className="text-slate-500 dark:text-slate-400">Operativo</span></h2>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-2 rounded-xl backdrop-blur-3xl">
            <button onClick={() => window.location.reload()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary transition-all active:scale-95 shadow-sm">
              <Activity size={16} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-10 space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.name} className="glass-card p-3 rounded-xl relative overflow-hidden group hover:bg-slate-200/10 dark:hover:bg-white/[0.01] transition-all duration-700 shadow-sm border-slate-200 dark:border-white/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.02] blur-[40px] -mr-12 -mt-12 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-2">
                 <div className={`w-6 h-6 rounded-lg bg-slate-200/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-700`}>
                   <stat.icon size={12} />
                 </div>
              </div>
              
              <div className="space-y-0">
                <p className="text-[7px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-[0.3em]">{stat.name}</p>
                 <h3 className="text-lg font-black text-foreground tracking-tighter leading-tight tabular-nums">
                  {metrics.loading ? (
                     <div className="h-5 w-16 bg-slate-200/50 dark:bg-white/5 animate-pulse rounded-md" />
                  ) : (
                    stat.name === 'Quiebre Stock' ? `${stat.value} Un` : formatCurrency(stat.value)
                  )}
                </h3>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Geo-Debt Analysis */}
          <div className="lg:col-span-7 glass-card p-4 rounded-2xl relative overflow-hidden border border-slate-200 dark:border-white/5">
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/[0.02] blur-[60px] -ml-16 -mb-16 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                   <Globe size={10} className="text-cyan-500" />
                   <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.3em]">Concentración</span>
                </div>
                 <h3 className="text-lg font-black text-foreground tracking-tighter uppercase leading-none">Análisis Geográfico</h3>
              </div>
            </div>

            <div className="space-y-3 px-2">
              {metrics.loading ? (
                 [1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-200/50 dark:bg-white/5 rounded-lg animate-pulse" />)
              ) : metrics.debtByCommune.length > 0 ? (
                metrics.debtByCommune.slice(0, 5).map((item, idx) => {
                  const maxDebt = metrics.debtByCommune[0].amount;
                  const percentage = (item.amount / maxDebt) * 100;
                  return (
                    <div key={item.commune} className="group">
                      <div className="flex justify-between items-end mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400 dark:text-slate-600 tabular-nums">{idx + 1}</span>
                            <span className="text-[10px] font-black text-foreground dark:text-slate-200 uppercase tracking-wide group-hover:text-primary transition-colors">{item.commune}</span>
                         </div>
                         <span className="text-sm font-black text-foreground tracking-tighter tabular-nums">{formatCurrency(item.amount)}</span>
                       </div>
                       <div className="h-1 w-full bg-slate-200 dark:bg-white/[0.05] rounded-full overflow-hidden">
                         <div 
                           className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-[2s] ease-out shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                           style={{ width: `${percentage}%` }}
                         />
                       </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center opacity-10">
                  <BarChart3 size={24} strokeWidth={1} className="mx-auto" />
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Alarms */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="glass-card p-5 rounded-[2rem] flex-1 relative overflow-hidden shadow-xl border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.02]">
               <h4 className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.4em] mb-5 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Accesos Rápidos
               </h4>
               <div className="grid grid-cols-2 gap-3">
                 {[
                   { label: 'POS', icon: ShoppingCart, view: 'sales', color: 'bg-cyan-500 text-white shadow-cyan-500/20' },
                   { label: 'Clientes', icon: Users, view: 'customers', color: 'bg-blue-500 text-white shadow-blue-500/20' },
                   { label: 'Facturas', icon: FileText, view: 'invoices', color: 'bg-indigo-500 text-white shadow-indigo-500/20' },
                   { label: 'Forecast', icon: Target, view: 'forecast', color: 'bg-purple-500 text-white shadow-purple-500/20' },
                 ].map((action) => (
                    <button 
                      key={action.view}
                      onClick={() => onNavigate?.(action.view)}
                      className="w-full h-14 bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center px-4 transition-all group active:scale-95 shadow-sm"
                    >
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${action.color}`}>
                         <action.icon size={14} />
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-tight">{action.label}</span>
                     </div>
                   </button>
                 ))}
               </div>
            </div>

             <div className="glass-card p-5 rounded-[2rem] bg-rose-500/[0.04] dark:bg-rose-500/[0.02] border border-rose-500/20 relative overflow-hidden group shadow-xl">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                   <Activity size={14} className="animate-pulse" />
                 </div>
                 <h4 className="text-[8px] font-black uppercase tracking-[0.4em] text-rose-500">Alertas Críticas</h4>
               </div>
               
               <div className="space-y-3 relative z-10">
                  <div className="flex justify-between items-center bg-white dark:bg-black/40 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Stock Crítico</p>
                      <p className="text-xl font-black text-foreground dark:text-white tracking-tighter uppercase">{metrics.criticalStock} <span className="text-slate-400">UNIDADES</span></p>
                    </div>
                  </div>
                 
                  <div className="flex justify-between items-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 shadow-sm">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest leading-none">Mora Detectada</p>
                      <p className="text-xl font-black text-rose-500 tracking-tighter uppercase">{formatCurrency(metrics.overdueDebt)}</p>
                    </div>
                  </div>
                 
                 <button 
                   onClick={() => onNavigate?.('aging')}
                   className="w-full h-14 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-500/30 hover:bg-rose-600 transition-all duration-700 active:scale-95 mt-2 flex items-center justify-center gap-2"
                 >
                   Auditar Protocolos <ArrowRight size={14} />
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
