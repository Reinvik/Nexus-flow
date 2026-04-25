import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell, AreaChart, Area
} from 'recharts';
import { TrendingUp, AlertTriangle, Package, Users, Calendar, ArrowRight, Search, Zap, RefreshCcw, ArrowUpRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import toast from 'react-hot-toast';

interface HistoricalData {
  month: string;
  total: number;
  quantity: number;
}

interface ProductForecast {
  id: string;
  name: string;
  currentStock: number;
  avgMonthlySales: number;
  predictedDemand: number;
  stockCoverageDays: number;
}

interface ClientForecast {
  id: string;
  name: string;
  avgPurchaseValue: number;
  predictedVolume: number;
  lastPurchaseDays: number;
  ticketTrend: number;
}

export default function ForecastView() {
  const [loading, setLoading] = useState(true);
  const [historicalSales, setHistoricalSales] = useState<HistoricalData[]>([]);
  const [productForecasts, setProductForecasts] = useState<ProductForecast[]>([]);
  const [clientForecasts, setClientForecasts] = useState<ClientForecast[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'clients'>('products');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: salesData, error: salesError } = await supabase
        .from('nf_sales')
        .select(`
          id,
          created_at,
          total_with_tax,
          client_id,
          client:nf_clients (name),
          items:nf_sale_items (
            product_id,
            quantity,
            product:nf_products (name, stock)
          )
        `)
        .gte('created_at', sixMonthsAgo.toISOString())
        .lte('created_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (salesError) throw salesError;

      const monthlyGroups: Record<string, { total: number, quantity: number }> = {};
      const productStats: Record<string, { name: string, stock: number, sales: number[] }> = {};
      const clientStats: Record<string, { name: string, totals: number[], dates: Date[] }> = {};

      salesData?.forEach(sale => {
        const date = new Date(sale.created_at);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = { total: 0, quantity: 0 };
        monthlyGroups[monthKey].total += Number(sale.total_with_tax);

        (sale.items as any[])?.forEach((item: any) => {
          monthlyGroups[monthKey].quantity += item.quantity;

          if (!productStats[item.product_id]) {
            productStats[item.product_id] = { 
              name: item.product?.name || 'Producto Desconocido', 
              stock: item.product?.stock || 0,
              sales: [] 
            };
          }
          productStats[item.product_id].sales.push(item.quantity);
        });

        if (sale.client_id) {
          if (!clientStats[sale.client_id]) {
            clientStats[sale.client_id] = { 
              name: (sale.client as any)?.name || 'Cliente Desconocido',
              totals: [],
              dates: []
            };
          }
          clientStats[sale.client_id].totals.push(Number(sale.total_with_tax));
          clientStats[sale.client_id].dates.push(date);
        }
      });

      const history: HistoricalData[] = Object.entries(monthlyGroups).map(([month, data]) => ({
        month,
        total: data.total,
        quantity: data.quantity
      })).sort((a, b) => a.month.localeCompare(b.month));

      if (history.length >= 3) {
        const last3 = history.slice(-3);
        const avgTotal = last3.reduce((acc, curr) => acc + curr.total, 0) / 3;
        const avgQty = last3.reduce((acc, curr) => acc + curr.quantity, 0) / 3;
        
        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonthKey = `${nextMonthDate.getFullYear()}-${(nextMonthDate.getMonth() + 1).toString().padStart(2, '0')} (P)`;
        
        history.push({
          month: nextMonthKey,
          total: avgTotal,
          quantity: avgQty
        });
      }
      setHistoricalSales(history);

      const pForecasts: ProductForecast[] = Object.entries(productStats).map(([id, stats]) => {
        const totalSold = stats.sales.reduce((a, b) => a + b, 0);
        const avgMonthly = totalSold / 6; 
        const predicted = avgMonthly * 1.1; 
        const coverage = predicted > 0 ? (stats.stock / predicted) * 30 : 999;

        return {
          id,
          name: stats.name,
          currentStock: stats.stock,
          avgMonthlySales: avgMonthly,
          predictedDemand: predicted,
          stockCoverageDays: Math.round(coverage)
        };
      }).sort((a, b) => a.stockCoverageDays - b.stockCoverageDays);
      setProductForecasts(pForecasts);

      const cForecasts: ClientForecast[] = Object.entries(clientStats).map(([id, stats]) => {
        // Sort sales by date to identify the latest one
        const sortedIndices = stats.dates
          .map((d, i) => ({ date: d, index: i }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        const sortedTotals = sortedIndices.map(item => stats.totals[item.index]);
        
        const totalVal = stats.totals.reduce((a, b) => a + b, 0);
        const count = stats.totals.length;
        const avgTicket = totalVal / count;
        
        const lastSale = sortedTotals[sortedTotals.length - 1];
        // Trend: compare last sale vs the average
        const trend = count > 1 ? ((lastSale / avgTicket) - 1) * 100 : 0;
        
        const lastDate = new Date(Math.max(...stats.dates.map(d => d.getTime())));
        const daysSinceLast = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id,
          name: stats.name,
          avgPurchaseValue: avgTicket,
          predictedVolume: avgTicket * 1.05,
          lastPurchaseDays: daysSinceLast,
          ticketTrend: trend
        };
      }).sort((a, b) => b.predictedVolume - a.predictedVolume);
      setClientForecasts(cForecasts);

    } catch (error: any) {
      toast.error('Error al generar inteligencia predictiva');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = productForecasts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredClients = clientForecasts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const stockAlerts = productForecasts.filter(p => p.stockCoverageDays < 15).length;
  const growthRate = historicalSales.length >= 3 
    ? ((historicalSales[historicalSales.length-2].total / (historicalSales[historicalSales.length-3].total || 1)) - 1) * 100 
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-8 opacity-20">
        <div className="w-16 h-16 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-foreground">Corriendo Modelos Predictivos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-outfit animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-3 px-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <TrendingUp size={16} className="text-white" />
            </div>
            <p className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.4em]">Nexus Prediction</p>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase leading-tight">Forecast <span className="text-slate-500 dark:text-slate-400">& IA</span></h2>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Últimos 180 días de operación</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full lg:w-auto">
          <div className="glass-card p-3 rounded-2xl border-slate-200 dark:border-white/5">
            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Venta Proyectada</p>
            <p className="text-lg font-black text-foreground tabular-nums">{formatCurrency(historicalSales[historicalSales.length - 1]?.total || 0)}</p>
          </div>
          <div className="glass-card p-3 rounded-2xl border-slate-200 dark:border-white/5">
            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Riesgo Stock</p>
            <p className={`text-lg font-black ${stockAlerts > 0 ? 'text-rose-500' : 'text-foreground'}`}>{stockAlerts} Items</p>
          </div>
          <div className="glass-card p-3 rounded-2xl border-slate-200 dark:border-white/5">
            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Ticket Promedio</p>
            <p className="text-lg font-black text-foreground tabular-nums">{formatCurrency(clientForecasts.reduce((acc, c) => acc + c.avgPurchaseValue, 0) / (clientForecasts.length || 1))}</p>
          </div>
          <div className="glass-card p-3 rounded-2xl border-slate-200 dark:border-white/5">
            <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Demanda Items</p>
            <p className="text-lg font-black text-foreground tabular-nums">{Math.round(historicalSales[historicalSales.length - 1]?.quantity || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-card p-4 rounded-3xl border-primary/5 shadow-xl">
        <h3 className="text-xs font-black mb-4 flex items-center gap-2 text-foreground uppercase tracking-widest">
          <TrendingUp size={14} className="text-primary" /> Tendencia de Ventas Mensuales
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalSales}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', 
                  borderRadius: '1rem', 
                  border: '1px solid var(--card-border)', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  padding: '1rem'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 900, color: 'var(--foreground)' }}
                formatter={(val: any) => [formatCurrency(Number(val)), 'Ventas']}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              <Line 
                type="monotone" 
                dataKey="total" 
                name="Venta Real / Proyectada"
                stroke="#3b82f6" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl gap-2">
            <button 
              onClick={() => setActiveTab('products')}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === 'products' ? 'bg-white dark:bg-slate-800 shadow-md scale-100' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tendencia por Producto
            </button>
            <button 
              onClick={() => setActiveTab('clients')}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === 'clients' ? 'bg-white text-black shadow-2xl' : 'text-slate-600 hover:text-white'
              }`}
            >
              Comportamiento Cliente
            </button>
          </div>

          <div className="relative group">
            <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-cyan-400 transition-colors" />
            <input
              type="text"
              placeholder="FILTRAR RESULTADOS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-6 h-16 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black text-foreground focus:border-cyan-500/30 outline-none w-80 uppercase tracking-widest"
            />
          </div>
        </div>

        <div className="glass-card rounded-[3.5rem] overflow-hidden border-white/5 shadow-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.01] text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
                {activeTab === 'products' ? (
                  <>
                    <th className="p-8 pl-10">Producto</th>
                    <th className="p-8">Disponibilidad</th>
                    <th className="p-8">Venta Mensual</th>
                    <th className="p-8">Demanda Proyectada</th>
                    <th className="p-8 pr-10">Cobertura Critica</th>
                  </>
                ) : (
                  <>
                    <th className="p-8 pl-10">Razón Social</th>
                    <th className="p-8">Recencia</th>
                    <th className="p-8">Ticket Promedio</th>
                    <th className="p-8">Volumen Estimado</th>
                    <th className="p-8 pr-10 text-right">Status Fidelidad</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {activeTab === 'products' ? (
                filteredProducts.map(p => (
                  <tr key={p.id} className="group hover:bg-white/[0.01] transition-all">
                    <td className="p-8 pl-10">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-700 group-hover:text-cyan-400 transition-colors"><Package size={16} /></div>
                         <p className="text-sm font-black text-foreground uppercase tracking-tighter">{p.name}</p>
                      </div>
                    </td>
                    <td className="p-8">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-lg uppercase ${
                        p.currentStock <= p.predictedDemand * 0.5 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-white/5 text-slate-400 border border-white/5'
                      }`}>
                        {p.currentStock} Unidades
                      </span>
                    </td>
                    <td className="p-8 text-xs font-bold text-slate-500">{Math.round(p.avgMonthlySales)} / Periodo</td>
                    <td className="p-8 text-sm font-black text-cyan-400 uppercase tracking-tighter">{Math.round(p.predictedDemand)} / Mes</td>
                    <td className="p-8 pr-10">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 bg-white/[0.02] h-1.5 rounded-full overflow-hidden min-w-[80px]">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              p.stockCoverageDays < 15 ? 'bg-rose-500' : 
                              p.stockCoverageDays < 30 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min((p.stockCoverageDays / 60) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-black uppercase ${p.stockCoverageDays < 15 ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`}>
                          {p.stockCoverageDays > 365 ? '> 1 Año' : `${p.stockCoverageDays} Días`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredClients.map(c => (
                  <tr key={c.id} className="group hover:bg-white/[0.01] transition-all">
                    <td className="p-8 pl-10">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-700 group-hover:text-cyan-400 transition-colors"><Users size={16} /></div>
                         <p className="text-sm font-black text-foreground uppercase tracking-tighter">{c.name}</p>
                      </div>
                    </td>
                    <td className="p-8 text-xs font-bold text-slate-500 uppercase">
                      {c.lastPurchaseDays === 0 ? 'Activo Hoy' : `Hace ${c.lastPurchaseDays} Días`}
                    </td>
                    <td className="p-8">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-foreground tracking-tighter">{formatCurrency(c.avgPurchaseValue)}</span>
                        {Math.abs(c.ticketTrend) > 1 && (
                          <div className={`flex items-center gap-1 ${c.ticketTrend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {c.ticketTrend > 0 ? <ArrowUpRight size={10} /> : <ArrowUpRight size={10} className="rotate-90" />}
                            <span className="text-[8px] font-black">{Math.abs(Math.round(c.ticketTrend))}%</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-8 text-sm font-black text-emerald-500 tracking-tighter">{formatCurrency(c.predictedVolume)}</td>
                    <td className="p-8 pr-10 text-right">
                      <span className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase border ${
                        c.lastPurchaseDays > 60 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                        c.lastPurchaseDays > 30 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {c.lastPurchaseDays > 60 ? 'ALERTA FUGA' : 
                         c.lastPurchaseDays > 30 ? 'DORMIDO' : 'CLIENTE VIP'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
