import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  PackageSearch, 
  Users, 
  FileText, 
  AlertCircle, 
  MapPin, 
  CalendarClock, 
  ArrowUpRight, 
  TrendingUp, 
  Activity, 
  ChevronRight,
  TrendingDown,
  BarChart3,
  CreditCard,
  Target,
  Zap,
  Globe,
  Layers,
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
      icon: Layers, 
      color: 'text-amber-500',
      label: 'Reabastecimiento',
      trend: 'Logística'
    },
  ];

  return (
    <div className="space-y-12 lg:h-[calc(100vh-180px)] flex flex-col font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                <Zap size={20} className="text-white" fill="currentColor" />
             </div>
             <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em]">Nexus Intelligence</p>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-foreground uppercase leading-none">Dashboard <span className="text-slate-400 dark:text-slate-800">Operativo</span></h2>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-3xl backdrop-blur-3xl">
           <div className="flex flex-col text-right pr-4 border-r border-slate-200 dark:border-white/10">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Estado Sistema</span>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 justify-end">
                Sincronizado <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </span>
           </div>
            <button onClick={() => window.location.reload()} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary transition-all active:scale-95 shadow-sm">
              <Activity size={20} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 space-y-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.name} className="glass-card p-10 rounded-[3.5rem] relative overflow-hidden group hover:bg-slate-200/10 dark:hover:bg-white/[0.01] transition-all duration-700">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.02] blur-[80px] -mr-24 -mt-24 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8">
                 <div className={`w-14 h-14 rounded-2xl bg-slate-200/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform duration-700`}>
                   <stat.icon size={24} />
                 </div>
                 <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/[0.02] text-slate-500`}>
                   {stat.trend}
                 </span>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">{stat.name}</p>
                 <h3 className="text-4xl font-black text-foreground tracking-tighter leading-tight">
                  {metrics.loading ? (
                     <div className="h-10 w-32 bg-slate-200/50 dark:bg-white/5 animate-pulse rounded-2xl" />
                  ) : (
                    stat.name === 'Quiebre Stock' ? `${stat.value} Unidades` : formatCurrency(stat.value)
                  )}
                </h3>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest pt-2">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Geo-Debt Analysis */}
          <div className="lg:col-span-7 glass-card p-14 rounded-[4.5rem] relative overflow-hidden border border-slate-200 dark:border-white/5">
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/[0.02] blur-[120px] -ml-48 -mb-48 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-14">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                   <Globe size={16} className="text-cyan-500" />
                   <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Cartografía Operativa</span>
                </div>
                 <h3 className="text-4xl font-black text-foreground tracking-tighter uppercase leading-none">Concentración Geográfica</h3>
              </div>
               <div className="w-16 h-16 rounded-3xl bg-slate-200/50 dark:bg-white/[0.01] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 dark:text-slate-800">
                <MapPin size={28} />
              </div>
            </div>

            <div className="space-y-10">
              {metrics.loading ? (
                 [1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200/50 dark:bg-white/5 rounded-[2.5rem] animate-pulse" />)
              ) : metrics.debtByCommune.length > 0 ? (
                metrics.debtByCommune.map((item, idx) => {
                  const maxDebt = metrics.debtByCommune[0].amount;
                  const percentage = (item.amount / maxDebt) * 100;
                  return (
                    <div key={item.commune} className="group">
                      <div className="flex justify-between items-end mb-5 px-3">
                        <div className="flex items-center gap-6">
                            <span className="text-[11px] font-black text-slate-400 dark:text-slate-600 tabular-nums">0{idx + 1}</span>
                            <span className="text-base font-black text-foreground dark:text-slate-200 uppercase tracking-wide group-hover:text-primary transition-colors">{item.commune}</span>
                         </div>
                         <span className="text-2xl font-black text-foreground tracking-tighter">{formatCurrency(item.amount)}</span>
                       </div>
                       <div className="h-3 w-full bg-slate-200 dark:bg-white/[0.05] rounded-full overflow-hidden border border-slate-200 dark:border-white/10">
                         <div 
                           className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-[2s] ease-out shadow-[0_0_30px_rgba(34,211,238,0.4)]" 
                           style={{ width: `${percentage}%` }}
                         />
                       </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-32 text-center space-y-6 opacity-10">
                  <BarChart3 size={72} strokeWidth={1} className="mx-auto" />
                  <p className="text-[11px] font-black uppercase tracking-[0.6em]">Sin desviaciones detectadas</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Alarms */}
          <div className="lg:col-span-5 flex flex-col gap-10">
            <div className="glass-card p-12 rounded-[4.5rem] flex-1 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-slate-200/50 dark:bg-white/[0.01] blur-[100px] -mr-32 -mt-32" />
               <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] mb-12 ml-4 flex items-center gap-3">
                 <ChevronRight size={14} className="text-cyan-500" /> Accesos de Alta Velocidad
               </h4>
               <div className="grid grid-cols-1 gap-5">
                 {[
                   { label: 'Punto de Venta', icon: ShoppingCart, view: 'sales', color: 'bg-cyan-500/10 text-cyan-500' },
                   { label: 'Clientes & Deuda', icon: Users, view: 'customers', color: 'bg-blue-500/10 text-blue-500' },
                   { label: 'Registro Maestro', icon: FileText, view: 'invoices', color: 'bg-indigo-500/10 text-indigo-500' },
                   { label: 'Proyecciones', icon: Target, view: 'forecast', color: 'bg-purple-500/10 text-purple-500' },
                 ].map((action) => (
                    <button 
                      key={action.view}
                      onClick={() => onNavigate?.(action.view)}
                      className="w-full h-24 bg-slate-100/50 dark:bg-white/[0.01] hover:bg-white dark:hover:bg-white/5 text-slate-500 hover:text-primary dark:hover:text-white rounded-[2.5rem] border border-slate-200 dark:border-white/5 hover:border-primary/20 flex items-center justify-between px-10 transition-all duration-700 group active:scale-[0.98] shadow-sm hover:shadow-2xl hover:shadow-primary/20"
                    >
                     <div className="flex items-center gap-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${action.color} group-hover:bg-primary/20 group-hover:text-primary`}>
                         <action.icon size={22} />
                       </div>
                       <span className="text-[12px] font-black uppercase tracking-[0.2em]">{action.label}</span>
                     </div>
                     <ArrowUpRight size={20} className="opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
                   </button>
                 ))}
               </div>
            </div>

             <div className="glass-card p-12 rounded-[4.5rem] bg-rose-500/[0.03] dark:bg-rose-500/[0.01] border-rose-500/20 dark:border-rose-500/10 relative overflow-hidden group">
               <div className="absolute -bottom-12 -right-12 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000">
                 <AlertCircle size={200} />
               </div>
               
               <div className="flex items-center gap-5 mb-10">
                 <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.2)]">
                   <Activity size={22} className="animate-pulse" />
                 </div>
                 <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-rose-500">Alertas de Intervención</h4>
               </div>
               
               <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-center bg-slate-200/50 dark:bg-black/20 p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Stock Crítico</p>
                      <p className="text-2xl font-black text-foreground tracking-tighter uppercase">{metrics.criticalStock} RECAUDOS</p>
                    </div>
                    <ArrowRight size={20} className="text-slate-400 dark:text-slate-800" />
                  </div>
                 
                 <div className="flex justify-between items-center bg-rose-500/5 p-6 rounded-[2.5rem] border border-rose-500/10">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-rose-500/50 uppercase tracking-widest">Mora Detectada</p>
                      <p className="text-2xl font-black text-rose-500 tracking-tighter uppercase">{formatCurrency(metrics.overdueDebt)}</p>
                    </div>
                    <TrendingDown size={20} className="text-rose-500" />
                 </div>
                 
                 <button 
                   onClick={() => onNavigate?.('aging')}
                   className="w-full h-20 bg-rose-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl shadow-rose-500/30 hover:bg-rose-600 transition-all duration-700 active:scale-95 mt-4"
                 >
                   Auditar Protocolos
                 </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
