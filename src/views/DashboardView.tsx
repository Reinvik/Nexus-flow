import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, PackageSearch, Users, FileText, TrendingUp, AlertCircle, MapPin, CalendarClock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DashboardView() {
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    totalInvoices: 0,
    totalClients: 0,
    criticalStock: 0,
    weeklyExpirations: 0,
    debtByCommune: [] as { commune: string; amount: number }[],
    loading: true
  });

  useEffect(() => {
    async function fetchMetrics() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Current week range (Monday to Sunday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
      const startOfWeek = new Date(now.setDate(diff));
      const endOfWeek = new Date(now.setDate(diff + 6));
      startOfWeek.setHours(0, 0, 0, 0);
      endOfWeek.setHours(23, 59, 59, 999);

      const [
        { data: sales },
        { count: invoicesCount },
        { count: clients },
        { count: stock },
        { data: pendingInvoices }
      ] = await Promise.all([
        supabase.from('sales').select('total_with_tax').gte('created_at', today.toISOString()),
        supabase.from('invoices').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }).lte('stock', 5),
        supabase.from('invoices')
          .select(`
            total_amount, 
            paid_amount, 
            payment_due_date,
            client:clients!invoices_client_id_fkey (commune)
          `)
          .neq('status', 'Pagada')
      ]);

      const todayTotal = sales?.reduce((acc, s) => acc + Number(s.total_with_tax), 0) || 0;
      
      // Calculate Debt by Commune and Weekly Expirations
      const communeDebtMap: Record<string, number> = {};
      let weeklyTotal = 0;

      pendingInvoices?.forEach(inv => {
        const debt = Number(inv.total_amount) - Number(inv.paid_amount);
        const commune = inv.client?.commune || 'Sin Comuna';
        
        // Commune Debt
        communeDebtMap[commune] = (communeDebtMap[commune] || 0) + debt;

        // Weekly Expiration
        let dueDate: Date | null = null;
        if (inv.payment_due_date) {
          dueDate = new Date(inv.payment_due_date);
        } else if (inv.issued_at) {
          dueDate = new Date(inv.issued_at);
          dueDate.setDate(dueDate.getDate() + 30);
        }

        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate >= startOfWeek && dueDate <= endOfWeek) {
            weeklyTotal += debt;
          }
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
        debtByCommune: debtByCommune.slice(0, 10), // Show top 10
        loading: false
      });
    }

    fetchMetrics();
  }, []);

  const stats = [
    { name: 'Ventas del Día', value: metrics.loading ? '...' : `$${metrics.todaySales.toLocaleString()}`, icon: ShoppingCart, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { name: 'Vencimientos Semana', value: metrics.loading ? '...' : `$${metrics.weeklyExpirations.toLocaleString()}`, icon: CalendarClock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'Nuevos Clientes', value: metrics.loading ? '...' : metrics.totalClients.toString(), icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { name: 'Stock Crítico', value: metrics.loading ? '...' : metrics.criticalStock.toString(), icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-black tracking-tight">Dashboard</h2>
        <p className="text-slate-500 font-medium">Resumen general de tu operación en tiempo real.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="glass-card p-6 rounded-3xl border border-card-border hover:border-primary/50 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
                {!metrics.loading && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                        <TrendingUp size={10} /> Activo
                    </div>
                )}
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{stat.name}</p>
              <p className="text-3xl font-black mt-1 tracking-tight">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debt by Commune */}
        <div className="glass-card p-8 rounded-3xl border border-card-border overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold">Deuda por Comuna</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Ranking de morosidad geográfica</p>
            </div>
            <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <MapPin size={24} />
            </div>
          </div>
          
          <div className="space-y-6">
            {metrics.loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl" />)
            ) : metrics.debtByCommune.length > 0 ? (
              metrics.debtByCommune.map((item, idx) => {
                const maxDebt = metrics.debtByCommune[0].amount;
                const percentage = (item.amount / maxDebt) * 100;
                
                return (
                  <div key={item.commune} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-black uppercase tracking-tight">{item.commune}</span>
                      <span className="text-sm font-bold text-rose-500">${item.amount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 opacity-50 italic">No hay deudas pendientes registradas.</div>
            )}
          </div>
        </div>

        {/* Inventory & Alerts */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-3xl border border-card-border">
            <h3 className="text-xl font-bold mb-6">Alertas de Inventario</h3>
            <div className="space-y-4 text-center py-6">
              {metrics.criticalStock > 0 ? (
                  <>
                      <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <AlertCircle size={32} className="text-rose-500" />
                      </div>
                      <p className="text-rose-500 font-bold">¡Atención! Hay {metrics.criticalStock} productos bajo el límite.</p>
                      <button className="mt-4 text-xs font-bold text-primary flex items-center gap-2 mx-auto hover:underline">
                        Ir a Inventario <ArrowRight size={14} />
                      </button>
                  </>
              ) : (
                  <>
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-50">
                          <PackageSearch size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-500 font-medium italic">Todo el stock se encuentra en niveles normales.</p>
                  </>
              )}
            </div>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-card-border">
            <h3 className="text-xl font-bold mb-6">Próximos Vencimientos</h3>
            <div className="flex items-center gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/30">
                <CalendarClock size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Semana Actual</p>
                <p className="text-lg font-black text-amber-700">${metrics.weeklyExpirations.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

