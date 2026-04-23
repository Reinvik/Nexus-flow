import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, AlertTriangle, Package, Users, Calendar, ArrowRight, Search } from 'lucide-react';
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
      // 1. Fetch Sales and Items for historical analysis
      // We'll fetch the last 6 months of data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          created_at,
          total_with_tax,
          client_id,
          clients (name),
          sale_items (
            product_id,
            quantity,
            products (name, stock)
          )
        `)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (salesError) throw salesError;

      // 2. Process historical trends
      const monthlyGroups: Record<string, { total: number, quantity: number }> = {};
      const productStats: Record<string, { name: string, stock: number, sales: number[] }> = {};
      const clientStats: Record<string, { name: string, totals: number[], dates: Date[] }> = {};

      salesData?.forEach(sale => {
        const date = new Date(sale.created_at);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        // General trends
        if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = { total: 0, quantity: 0 };
        monthlyGroups[monthKey].total += Number(sale.total_with_tax);

        // Product stats
        sale.sale_items?.forEach((item: any) => {
          if (!monthlyGroups[monthKey]) return; // Should not happen
          monthlyGroups[monthKey].quantity += item.quantity;

          if (!productStats[item.product_id]) {
            productStats[item.product_id] = { 
              name: item.products?.name || 'Producto Desconocido', 
              stock: item.products?.stock || 0,
              sales: [] 
            };
          }
          productStats[item.product_id].sales.push(item.quantity);
        });

        // Client stats
        if (sale.client_id) {
          if (!clientStats[sale.client_id]) {
            clientStats[sale.client_id] = { 
              name: (sale.clients as any)?.name || 'Cliente Desconocido',
              totals: [],
              dates: []
            };
          }
          clientStats[sale.client_id].totals.push(Number(sale.total_with_tax));
          clientStats[sale.client_id].dates.push(date);
        }
      });

      // 3. Transform for Charts
      const history: HistoricalData[] = Object.entries(monthlyGroups).map(([month, data]) => ({
        month,
        total: data.total,
        quantity: data.quantity
      })).sort((a, b) => a.month.localeCompare(b.month));

      // Simple prediction for next month (Average of last 3 months)
      if (history.length >= 3) {
        const last3 = history.slice(-3);
        const avgTotal = last3.reduce((acc, curr) => acc + curr.total, 0) / 3;
        const avgQty = last3.reduce((acc, curr) => acc + curr.quantity, 0) / 3;
        
        // Add "Next Month" projection
        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonthKey = `${nextMonthDate.getFullYear()}-${(nextMonthDate.getMonth() + 1).toString().padStart(2, '0')} (Proj)`;
        
        history.push({
          month: nextMonthKey,
          total: avgTotal,
          quantity: avgQty
        });
      }
      setHistoricalSales(history);

      // 4. Product Forecasts
      const pForecasts: ProductForecast[] = Object.entries(productStats).map(([id, stats]) => {
        const totalSold = stats.sales.reduce((a, b) => a + b, 0);
        const avgMonthly = totalSold / 6; // Simple 6-month average
        const predicted = avgMonthly * 1.1; // 10% growth assumption for safety
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

      // 5. Client Forecasts
      const cForecasts: ClientForecast[] = Object.entries(clientStats).map(([id, stats]) => {
        const totalVal = stats.totals.reduce((a, b) => a + b, 0);
        const avgVal = totalVal / 6;
        const lastDate = new Date(Math.max(...stats.dates.map(d => d.getTime())));
        const daysSinceLast = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id,
          name: stats.name,
          avgPurchaseValue: avgVal,
          predictedVolume: avgVal * 1.05,
          lastPurchaseDays: daysSinceLast
        };
      }).sort((a, b) => b.predictedVolume - a.predictedVolume);
      setClientForecasts(cForecasts);

    } catch (error: any) {
      toast.error('Error al generar forecast: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = productForecasts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClients = clientForecasts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stockAlerts = productForecasts.filter(p => p.stockCoverageDays < 15).length;
  const growthRate = historicalSales.length >= 3 
    ? ((historicalSales[historicalSales.length-2].total / historicalSales[historicalSales.length-3].total) - 1) * 100 
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500">Analizando tendencias y stock...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Predicción y Tendencias</h2>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <Calendar size={16} /> Basado en el historial de los últimos 6 meses
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={fetchData}
            className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-[2rem] border-primary/10">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Venta Proyectada (Próx. Mes)</p>
            <TrendingUp size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-black mt-2">
            {formatCurrency(historicalSales[historicalSales.length - 1]?.total || 0)}
          </p>
          <p className={`text-xs mt-2 font-bold ${growthRate >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {growthRate >= 0 ? '↑' : '↓'} {Math.abs(growthRate).toFixed(1)}% vs mes anterior
          </p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-amber-500/10">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Riesgo de Quiebre Stock</p>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <p className="text-3xl font-black mt-2 text-amber-500">{stockAlerts}</p>
          <p className="text-xs mt-2 text-slate-400 font-medium">Productos con cobertura {"<"} 15 días</p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-emerald-500/10">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ticket Promedio</p>
            <Users size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-black mt-2">
            {formatCurrency(clientForecasts.reduce((acc, c) => acc + c.avgPurchaseValue, 0) / (clientForecasts.length || 1))}
          </p>
          <p className="text-xs mt-2 text-slate-400 font-medium">Valor mensual por cliente</p>
        </div>

        <div className="glass-card p-6 rounded-[2rem] border-blue-500/10">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demanda Total Items</p>
            <Package size={18} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black mt-2">
            {Math.round(historicalSales[historicalSales.length - 1]?.quantity || 0).toLocaleString()}
          </p>
          <p className="text-xs mt-2 text-slate-400 font-medium">Unidades proyectadas</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-card p-8 rounded-[2.5rem] border-primary/5 shadow-xl">
        <h3 className="text-xl font-black mb-8 flex items-center gap-3">
          <TrendingUp className="text-primary" /> Tendencia de Ventas Mensuales
        </h3>
        <div className="h-[400px] w-full">
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
                  backgroundColor: 'white', 
                  borderRadius: '1rem', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  padding: '1rem'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 900 }}
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
                activeTab === 'clients' ? 'bg-white dark:bg-slate-800 shadow-md scale-100' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tendencia por Cliente
            </button>
          </div>

          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder={`Buscar ${activeTab === 'products' ? 'producto' : 'cliente'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all w-80 shadow-sm"
            />
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-200/50 dark:border-slate-800 shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              {activeTab === 'products' ? (
                <tr>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Producto</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Stock Actual</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Venta Prom. (Mensual)</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Demanda Proyectada</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Cobertura Estimada</th>
                </tr>
              ) : (
                <tr>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Cliente</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Última Compra</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Ticket Promedio</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Volumen Proyectado</th>
                  <th className="p-6 font-black text-[10px] uppercase tracking-widest text-slate-400">Estado</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeTab === 'products' ? (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-6 font-black text-slate-800 dark:text-white">{p.name}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        p.currentStock <= p.predictedDemand * 0.5 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.currentStock} unid.
                      </span>
                    </td>
                    <td className="p-6 text-slate-500 font-bold">{Math.round(p.avgMonthlySales)} / mes</td>
                    <td className="p-6 text-primary font-black">{Math.round(p.predictedDemand)} / mes</td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden min-w-[60px]">
                          <div 
                            className={`h-full rounded-full ${
                              p.stockCoverageDays < 15 ? 'bg-rose-500' : 
                              p.stockCoverageDays < 30 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min((p.stockCoverageDays / 60) * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-black whitespace-nowrap ${
                          p.stockCoverageDays < 15 ? 'text-rose-500' : 'text-slate-500'
                        }`}>
                          {p.stockCoverageDays > 365 ? '> 1 año' : `${p.stockCoverageDays} días`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                filteredClients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-6 font-black text-slate-800 dark:text-white">{c.name}</td>
                    <td className="p-6 text-slate-500 font-bold">
                      {c.lastPurchaseDays === 0 ? 'Hoy' : `Hace ${c.lastPurchaseDays} días`}
                    </td>
                    <td className="p-6 font-bold">{formatCurrency(c.avgPurchaseValue)}</td>
                    <td className="p-6 text-emerald-500 font-black">{formatCurrency(c.predictedVolume)}</td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        c.lastPurchaseDays > 60 ? 'bg-rose-100 text-rose-600' : 
                        c.lastPurchaseDays > 30 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {c.lastPurchaseDays > 60 ? 'Riesgo Fuga' : 
                         c.lastPurchaseDays > 30 ? 'Inactivo' : 'Activo'}
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
