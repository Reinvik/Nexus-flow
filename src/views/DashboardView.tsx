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
import { formatCurrency, formatDate } from '@/lib/formatters';

interface DashboardProps {
  onNavigate?: (view: any, params?: any) => void;
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
    topDebtors: [] as { id: string; name: string; amount: number; nextExpiration: string | null }[],
    oldestDebts: [] as { id: string; name: string; amount: number; daysOverdue: number; folio: string }[],
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
              folio,
              total_amount, 
              paid_amount, 
              payment_due_date,
              issued_at,
              client:nf_clients!nf_invoices_client_id_fkey (id, name, commune)
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

        // Top 5 Debtors by Amount
        const clientDebtMap: Record<string, { id: string; amount: number; nextExpiration: Date | null }> = {};
        pendingInvoices?.forEach(inv => {
          const clientData = inv.client as any;
          const name = clientData?.name || 'Sin Nombre';
          const id = clientData?.id || '';
          const debt = Number(inv.total_amount) - Number(inv.paid_amount);
          
          let dueDate: Date | null = null;
          if (inv.payment_due_date) {
            dueDate = new Date(inv.payment_due_date);
          } else if (inv.issued_at) {
            dueDate = new Date(inv.issued_at);
            dueDate.setDate(dueDate.getDate() + 30);
          }

          if (!clientDebtMap[name]) {
            clientDebtMap[name] = { id, amount: 0, nextExpiration: null };
          }
          clientDebtMap[name].amount += debt;
          
          if (dueDate && (!clientDebtMap[name].nextExpiration || dueDate < clientDebtMap[name].nextExpiration)) {
            clientDebtMap[name].nextExpiration = dueDate;
          }
        });

        const topDebtors = Object.entries(clientDebtMap)
          .map(([name, data]) => ({ 
            id: data.id,
            name, 
            amount: data.amount, 
            nextExpiration: data.nextExpiration ? data.nextExpiration.toISOString() : null 
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5);

        // Top 5 Oldest Debts
        const oldestDebts = (pendingInvoices || [])
          .map(inv => {
            const clientData = inv.client as any;
            let dueDate: Date | null = null;
            if (inv.payment_due_date) {
              dueDate = new Date(inv.payment_due_date);
            } else if (inv.issued_at) {
              dueDate = new Date(inv.issued_at);
              dueDate.setDate(dueDate.getDate() + 30);
            }
            
            const diffDays = dueDate ? Math.floor((todayStart.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            
            return {
              id: clientData?.id || '',
              name: clientData?.name || 'Sin Nombre',
              amount: Number(inv.total_amount) - Number(inv.paid_amount),
              daysOverdue: diffDays,
              folio: inv.folio?.toString() || 'S/F',
              isOverdue: diffDays > 0
            };
          })
          .filter(inv => inv.isOverdue)
          .sort((a, b) => b.daysOverdue - a.daysOverdue)
          .slice(0, 5);

        setMetrics({
          todaySales: todayTotal,
          totalInvoices: invoicesCount || 0,
          totalClients: clients || 0,
          criticalStock: stock || 0,
          weeklyExpirations: weeklyTotal,
          overdueDebt: overdueTotal,
          debtByCommune: debtByCommune.slice(0, 8),
          topDebtors,
          oldestDebts,
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
          <div className="lg:col-span-7 space-y-4">
            {/* Geo-Debt Analysis */}
            <div className="glass-card p-4 rounded-2xl relative overflow-hidden border border-slate-200 dark:border-white/5">
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
                      <div 
                        key={item.commune} 
                        className="group cursor-pointer active:scale-[0.98] transition-all"
                        onClick={() => onNavigate?.('invoices', { commune: item.commune })}
                      >
                        <div className="flex justify-between items-end mb-1">
                          <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-slate-800 dark:text-slate-400 tabular-nums">{idx + 1}</span>
                              <span className="text-[10px] font-black uppercase tracking-wide group-hover:text-primary transition-colors text-ultra">{item.commune}</span>
                           </div>
                           <span className="text-sm font-black tracking-tighter tabular-nums text-ultra">{formatCurrency(item.amount)}</span>
                         </div>
                         <div className="h-1 w-full bg-slate-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-[2s] ease-out shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                             style={{ width: `${percentage}%` }}
                           />
                         </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center opacity-20">
                    <BarChart3 size={24} strokeWidth={1} className="mx-auto text-slate-400" />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Debtors */}
              <div className="glass-card p-5 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/30 dark:bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-4">
                  <Users size={12} className="text-primary" />
                  <h4 className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Ranking de Cartera</h4>
                </div>
                <div className="space-y-4">
                  {metrics.topDebtors.map((debtor, idx) => (
                    <div 
                      key={debtor.name} 
                      onClick={() => onNavigate?.('customers', { clientId: debtor.id })}
                      className="flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-foreground uppercase truncate group-hover:text-primary transition-colors">{idx + 1}. {debtor.name}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                          {debtor.nextExpiration ? `Prox: ${formatDate(debtor.nextExpiration)}` : 'Sin fecha'}
                        </p>
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(debtor.amount)}</span>
                    </div>
                  ))}
                  {!metrics.loading && metrics.topDebtors.length === 0 && (
                    <p className="py-4 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Sin deudas activas</p>
                  )}
                </div>
              </div>

              {/* Oldest Debts */}
              <div className="glass-card p-5 rounded-[2rem] border border-rose-500/10 bg-rose-500/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={12} className="text-rose-500" />
                  <h4 className="text-[8px] font-black uppercase tracking-[0.4em] text-rose-500">Mora Crítica</h4>
                </div>
                <div className="space-y-4">
                  {metrics.oldestDebts.map((debt) => (
                    <div 
                      key={`${debt.folio}-${debt.name}`} 
                      onClick={() => onNavigate?.('customers', { clientId: debt.id })}
                      className="flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-rose-500 uppercase truncate group-hover:opacity-70 transition-opacity">#{debt.folio} · {debt.name}</p>
                        <p className="text-[7px] font-black text-rose-500/60 uppercase tracking-widest animate-pulse">
                          {debt.daysOverdue} días de atraso
                        </p>
                      </div>
                      <span className="text-xs font-black text-rose-500 tabular-nums">{formatCurrency(debt.amount)}</span>
                    </div>
                  ))}
                  {!metrics.loading && metrics.oldestDebts.length === 0 && (
                    <p className="py-4 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Sin mora detectada</p>
                  )}
                </div>
              </div>
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
                      className="w-full h-14 bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white rounded-2xl border border-slate-200/60 dark:border-white/10 flex items-center px-4 transition-all group active:scale-95 shadow-sm"
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
                  <div 
                    onClick={() => onNavigate?.('inventory')}
                    className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-white/10 shadow-xl cursor-pointer hover:scale-[1.02] transition-all group"
                  >
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/70 uppercase tracking-widest leading-none">Stock Crítico</p>
                      <p className="text-xl font-black text-white tracking-tighter uppercase">{metrics.criticalStock} <span className="text-white">UNIDADES</span></p>
                    </div>
                    <ArrowUpRight size={16} className="text-white/40 group-hover:text-white transition-colors" />
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
