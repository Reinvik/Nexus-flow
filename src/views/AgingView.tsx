import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Invoice, Payment, Client } from '@/types';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Filter,
  DollarSign,
  ChevronRight,
  User,
  Phone,
  Edit2,
  PlusCircle,
  X,
  Save,
  CreditCard,
  Search,
  PieChart,
  BarChart3,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ArrowUpRight,
  CalendarDays
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/formatters';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function AgingView() {
  const [invoices, setInvoices] = useState<(Invoice & { client: Client })[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showPaid, setShowPaid] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<(Invoice & { client: Client }) | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<(Invoice & { client: Client }) | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Transferencia');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  
  // Edit Invoice Form State
  const [editIssuedAt, setEditIssuedAt] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({
    key: 'due_date',
    direction: 'asc'
  });
  
  const availableYears = useMemo(() => {
    const invYears = invoices.map(inv => {
      const dateStr = inv.payment_due_date || inv.issued_at || "";
      const date = new Date(dateStr);
      return date.getFullYear();
    });
    const payYears = payments.map(p => {
      const date = new Date(p.payment_date);
      return date.getFullYear();
    });
    
    const allYears = [...invYears, ...payYears].filter(y => !isNaN(y) && y > 2000 && y < 2100);
    return Array.from(new Set([...allYears, new Date().getFullYear()])).sort((a, b) => b - a);
  }, [invoices, payments]);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const invQuery = supabase
        .from('nf_invoices')
        .select(`
          *,
          client:nf_clients!nf_invoices_client_id_fkey(*)
        `);

      const { data: invData, error: invError } = await invQuery.order('issued_at', { ascending: false });

      if (invError) throw invError;

      const { data: payData, error: payError } = await supabase
        .from('nf_payments')
        .select('*')
        .order('payment_date', { ascending: false });

      if (payError) {
        console.warn('Payment table error:', payError);
        setPayments([]);
      } else {
        setPayments(payData || []);
      }

      setInvoices(invData || []);
    } catch (error: any) {
      toast.error('Error al cargar datos financieros: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;
    
    try {
      const { error } = await supabase
        .from('nf_invoices')
        .update({
          issued_at: editIssuedAt,
          payment_due_date: editDueDate || null
        })
        .eq('id', editingInvoice.id);

      if (error) throw error;
      
      toast.success('Documento actualizado', {
        style: { background: '#020617', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
      });
      setEditingInvoice(null);
      fetchData();
    } catch (error: any) {
      toast.error('Error al actualizar');
    }
  };

  const handleAddPayment = async () => {
    if (!payingInvoice || !paymentAmount) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto de pago inválido');
      return;
    }

    const currentPaid = Number(payingInvoice.paid_amount || 0);
    const newPaidAmount = currentPaid + amount;
    const isFullyPaid = newPaidAmount >= Number(payingInvoice.total_amount);

    try {
      const { error: payError } = await supabase
        .from('nf_payments')
        .insert({
          invoice_id: payingInvoice.id,
          amount: amount,
          payment_method: paymentMethod,
          payment_date: new Date().toISOString()
        });

      if (payError) throw payError;

      const { error: invError } = await supabase
        .from('nf_invoices')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'Pagada' : 'Pendiente'
        })
        .eq('id', payingInvoice.id);

      if (invError) throw invError;

      toast.success(isFullyPaid ? 'Liquidación completa' : 'Abono registrado', {
        style: { background: '#020617', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
      });
      setPayingInvoice(null);
      setPaymentAmount('');
      fetchData();
    } catch (error: any) {
      toast.error('Error al registrar pago');
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={12} className="opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  const monthlyData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return MONTHS.map((name, index) => {
      // Find all payments that occurred in this specific month/year
      const monthPayments = payments.filter(p => {
        const pDate = new Date(p.payment_date);
        return pDate.getMonth() === index && pDate.getFullYear() === selectedYear;
      });

      const paidInvoiceIds = new Set(monthPayments.map(p => p.invoice_id));

      let monthInvoices = invoices.filter(inv => {
        // Condition 1: Invoice is due or issued in this month
        const dateStr = inv.payment_due_date || inv.issued_at;
        if (dateStr) {
          const date = new Date(dateStr);
          if (date.getMonth() === index && date.getFullYear() === selectedYear) return true;
        }
        
        // Condition 2: Invoice was paid in this month
        return paidInvoiceIds.has(inv.id);
      });

      // Apply Sorting to Month Invoices
      if (sortConfig) {
        monthInvoices.sort((a, b) => {
          let aValue: any;
          let bValue: any;

          switch (sortConfig.key) {
            case 'client':
              aValue = a.client?.name || '';
              bValue = b.client?.name || '';
              break;
            case 'due_date':
              aValue = new Date(a.payment_due_date || a.issued_at).getTime();
              bValue = new Date(b.payment_due_date || b.issued_at).getTime();
              break;
            case 'total':
              aValue = Number(a.total_amount);
              bValue = Number(b.total_amount);
              break;
            case 'balance':
              aValue = Number(a.total_amount) - Number(a.paid_amount);
              bValue = Number(b.total_amount) - Number(b.paid_amount);
              break;
            default:
              aValue = (a as any)[sortConfig.key];
              bValue = (b as any)[sortConfig.key];
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      // Collected amount is the sum of payments made in THIS month
      const collectedInMonth = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      const toCollect = monthInvoices.reduce((sum, inv) => {
        if (inv.status !== 'Pagada') {
          const balance = Number(inv.total_amount) - Number(inv.paid_amount || 0);
          return sum + (balance > 0 ? balance : 0);
        }
        return sum;
      }, 0);

      const overdueCount = monthInvoices.filter(inv => {
        if (inv.status === 'Pagada') return false;
        const dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        }
        return false;
      }).length;

      return {
        name,
        index,
        collected: collectedInMonth,
        toCollect,
        overdueCount,
        totalInvoices: monthInvoices.length,
        invoices: monthInvoices.map(inv => {
          const dateStr = inv.payment_due_date || inv.issued_at;
          const invDate = dateStr ? new Date(dateStr) : null;
          const isFromOtherYear = invDate && (invDate.getFullYear() !== selectedYear || invDate.getMonth() !== index);
          
          return {
            ...inv,
            _isCollectionOnly: isFromOtherYear && paidInvoiceIds.has(inv.id)
          };
        })
      };
    });
  }, [invoices, payments, selectedYear, sortConfig]);

  const totalToCollect = useMemo(() => monthlyData.reduce((sum, m) => sum + m.toCollect, 0), [monthlyData]);
  const totalCollected = useMemo(() => monthlyData.reduce((sum, m) => sum + m.collected, 0), [monthlyData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-8 opacity-20">
        <div className="w-16 h-16 border-2 border-slate-400 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Consolidando Cuentas</p>
      </div>
    );
  }

  const selectedMonthData = selectedMonth !== null ? monthlyData[selectedMonth] : null;

  return (
    <div className="space-y-12 font-outfit pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-10 px-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
             <span className="w-8 h-px bg-primary" />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Financial Tracking</p>
          </div>
          <h2 className="text-5xl font-black tracking-tight text-foreground uppercase">Recaudación <span className="text-slate-600 dark:text-slate-500">{selectedYear}</span></h2>
          
          <div className="flex items-center gap-6">
            <div className="relative group">
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-4 font-black text-primary dark:text-cyan-400 focus:outline-none appearance-none pr-14 text-xs uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/[0.04] transition-all"
              >
                {availableYears.map(y => (
                  <option key={y} value={y} className="bg-slate-100 dark:bg-[#020617]">{y}</option>
                ))}
              </select>
              <CalendarDays className="absolute right-5 top-1/2 -translate-y-1/2 text-primary/50 dark:text-cyan-500/50 pointer-events-none" size={16} />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-widest max-w-[200px] leading-relaxed">Control operativo de cartera y flujos proyectados</p>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="glass-card p-8 rounded-[2.5rem] min-w-[280px] relative overflow-hidden group border-slate-200 dark:border-white/5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl -mr-12 -mt-12 group-hover:opacity-100 opacity-50 transition-opacity" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ingreso Realizado</p>
            <h3 className="text-4xl font-black text-emerald-500 tracking-tighter">{formatCurrency(totalCollected)}</h3>
          </div>
          <div className="glass-card p-8 rounded-[2.5rem] min-w-[280px] relative overflow-hidden group border-slate-200 dark:border-white/5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl -mr-12 -mt-12 group-hover:opacity-100 opacity-50 transition-opacity" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cartera Pendiente</p>
            <h3 className="text-4xl font-black text-foreground tracking-tighter">{formatCurrency(totalToCollect)}</h3>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
        {monthlyData.map((month) => {
          const isSelected = selectedMonth === month.index;
          const progress = (month.collected / (month.collected + month.toCollect || 1)) * 100;
          
          return (
            <button
              key={month.index}
              onClick={() => setSelectedMonth(isSelected ? null : month.index)}
              className={`glass-card p-8 rounded-[2.5rem] text-left transition-all duration-700 relative group overflow-hidden border-slate-200 dark:border-white/5 ${
                isSelected ? 'ring-2 ring-primary bg-primary/5 scale-[1.02] shadow-2xl' : 'hover:bg-slate-100/50 dark:hover:bg-white/[0.01]'
              }`}
            >
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-1">
                  <h3 className={`text-2xl font-black tracking-tight uppercase ${isSelected ? 'text-primary' : 'text-foreground'}`}>{month.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <p className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Estado de Cobro</p>
                  </div>
                </div>
                {month.overdueCount > 0 && (
                   <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-black text-[10px] animate-pulse">
                     {month.overdueCount}
                   </span>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                   <div className="space-y-0.5">
                     <p className="text-[9px] font-black text-slate-500 dark:text-slate-700 uppercase tracking-widest">Recuperado</p>
                     <p className="text-xl font-black text-foreground tracking-tighter">{formatCurrency(month.collected)}</p>
                   </div>
                   <div className="text-right space-y-0.5">
                     <p className="text-[9px] font-black text-slate-500 dark:text-slate-700 uppercase tracking-widest">Residual</p>
                     <p className={`text-xl font-black tracking-tighter ${month.toCollect > 0 ? 'text-primary/80' : 'text-slate-400 dark:text-slate-800'}`}>{formatCurrency(month.toCollect)}</p>
                   </div>
                </div>
                <div className="h-1 w-full bg-slate-200 dark:bg-white/[0.03] rounded-full overflow-hidden">
                   <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${progress}%` }} />
                </div>
              </div>
              
              {isSelected && <ArrowUpRight size={24} className="absolute bottom-6 right-6 text-primary/40" />}
            </button>
          );
        })}
      </div>

      {/* Auto-toggle History Tip */}
      {selectedMonthData && !showPaid && selectedMonthData.invoices.filter(inv => inv.status !== 'Pagada').length === 0 && selectedMonthData.collected > 0 && (
        <div className="px-4 animate-in fade-in slide-in-from-top-2">
          <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-primary" />
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Este mes solo tiene movimientos liquidados. Haz clic en "Ver Historial" para auditarlos.</p>
            </div>
            <button 
              onClick={() => setShowPaid(true)}
              className="px-6 py-2 bg-primary text-white dark:bg-white dark:text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
            >
              Ver Historial
            </button>
          </div>
        </div>
      )}

      {/* Details Table */}
      {selectedMonthData && (
        <div className="mx-4 glass-card rounded-[3.5rem] p-12 border-slate-200 dark:border-white/10 space-y-12 animate-in slide-in-from-bottom-8 duration-700 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-end gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                 <span className="w-8 h-px bg-primary" />
                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Operational Analytics</p>
              </div>
              <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter">Detalle Operativo <span className="text-slate-500 dark:text-slate-700">{selectedMonthData.name}</span></h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="FILTRAR CARTERA..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-14 pr-6 h-16 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black text-foreground focus:border-primary/30 outline-none w-80 uppercase tracking-widest placeholder:text-slate-400 dark:placeholder:text-slate-700"
                />
              </div>
              <button 
                onClick={() => setShowPaid(!showPaid)}
                className={`h-16 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  showPaid ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground'
                }`}
              >
                {showPaid ? 'Ocultar Pagadas' : 'Ver Historial'}
              </button>
              <button onClick={() => setSelectedMonth(null)} className="h-16 w-16 flex items-center justify-center bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-rose-500 rounded-2xl transition-all"><X size={20} /></button>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.3em]">
                  <th className="pb-8 pl-4 cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('client')}>Razón Social {getSortIcon('client')}</th>
                  <th className="pb-8 cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('due_date')}>Vencimiento {getSortIcon('due_date')}</th>
                  <th className="pb-8 cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('total')}>Total {getSortIcon('total')}</th>
                  <th className="pb-8 cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('balance')}>Saldo {getSortIcon('balance')}</th>
                  <th className="pb-8">Estado</th>
                  <th className="pb-8 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/[0.03]">
                {selectedMonthData.invoices
                  .filter(inv => (showPaid || inv.status !== 'Pagada'))
                  .filter(inv => {
                    if (!invoiceSearch) return true;
                    const search = invoiceSearch.toLowerCase();
                    return inv.client?.name?.toLowerCase().includes(search) || inv.client?.rut?.toLowerCase().includes(search);
                  })
                  .map((inv) => {
                    const balance = Number(inv.total_amount) - Number(inv.paid_amount);
                    const isOverdue = inv.payment_due_date && new Date(inv.payment_due_date) < new Date() && inv.status !== 'Pagada';
                    return (
                      <tr key={inv.id} className="group hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-all">
                        <td className="py-8 pl-4">
                          <div className="flex items-center gap-6">
                             <div className="w-12 h-12 rounded-2xl bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors shadow-2xl">
                               <User size={18} />
                             </div>
                             <div className="space-y-1">
                               <p className="text-lg font-black text-foreground tracking-tighter leading-none uppercase">{inv.client?.name || 'Venta Mesón'}</p>
                               <p className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">{inv.client?.rut || 'X.XXX.XXX-X'}</p>
                             </div>
                          </div>
                        </td>
                        <td className="py-8">
                          <div className="space-y-1">
                            <p className={`text-sm font-black tracking-tight ${(inv as any)._isCollectionOnly ? 'text-emerald-500' : (isOverdue ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300')}`}>
                              {formatDate(inv.payment_due_date || inv.issued_at)}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-widest">Folio #{inv.folio}</p>
                              {(inv as any)._isCollectionOnly && (
                                <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-tighter animate-pulse">
                                  Recaudado en {MONTHS[index]}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-8 text-lg font-black text-slate-400 dark:text-slate-500 tracking-tighter">{formatCurrency(inv.total_amount)}</td>
                        <td className="py-8">
                          <span className={`text-lg font-black tracking-tighter ${balance > 0 ? 'text-foreground' : 'text-emerald-500'}`}>
                            {formatCurrency(balance)}
                          </span>
                        </td>
                        <td className="py-8">
                          <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase border ${
                            inv.status === 'Pagada' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 
                            (isOverdue ? 'border-rose-500/30 text-rose-500 bg-rose-500/5' : 'border-primary/20 text-primary bg-primary/5')
                          }`}>
                            {inv.status === 'Pagada' ? 'Liquidada' : (isOverdue ? 'Vencida' : 'Pendiente')}
                          </span>
                        </td>
                        <td className="py-8 pr-4">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            {inv.status !== 'Pagada' && (
                              <button 
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setPaymentAmount(balance.toString());
                                }}
                                className="w-12 h-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-2xl"
                              >
                                <DollarSign size={18} />
                              </button>
                            )}
                            <button 
                              onClick={() => {
                                setEditingInvoice(inv);
                                setEditIssuedAt(inv.issued_at.split('T')[0]);
                                setEditDueDate(inv.payment_due_date ? inv.payment_due_date.split('T')[0] : '');
                              }}
                              className="w-12 h-12 bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground rounded-2xl flex items-center justify-center transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {editingInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/80 dark:bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-lg rounded-[3.5rem] p-12 space-y-12 relative border-slate-200 dark:border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Administrative Adjustment</p>
                <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-none">Ajustar Documento</h3>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="w-12 h-12 flex items-center justify-center bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground rounded-2xl transition-colors"><X size={28} /></button>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Fecha Emisión Fiscal</label>
                <input 
                  type="date" 
                  value={editIssuedAt}
                  onChange={(e) => setEditIssuedAt(e.target.value)}
                  className="w-full h-16 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 font-black text-foreground focus:border-primary/30 outline-none appearance-none"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Límite Vencimiento</label>
                <input 
                  type="date" 
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full h-16 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 font-black text-foreground focus:border-primary/30 outline-none appearance-none"
                />
              </div>
            </div>

            <button 
              onClick={handleUpdateInvoice}
              className="w-full h-20 bg-primary text-white dark:bg-white dark:text-black rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:opacity-90 transition-all duration-500 active:scale-95 shadow-xl shadow-primary/20"
            >
              <Save size={18} /> Confirmar Cambios
            </button>
          </div>
        </div>
      )}

      {payingInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/90 dark:bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-xl rounded-[3.5rem] p-12 space-y-12 relative border-slate-200 dark:border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Payment Intake</p>
                <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter leading-none">Ingreso Capital</h3>
              </div>
              <button onClick={() => setPayingInvoice(null)} className="w-12 h-12 flex items-center justify-center bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground rounded-2xl transition-colors"><X size={28} /></button>
            </div>

            <div className="bg-slate-100/50 dark:bg-white/[0.01] rounded-[2.5rem] p-10 border border-slate-200 dark:border-white/5 flex justify-between items-center shadow-inner">
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-500 dark:text-slate-700 uppercase tracking-widest">Total Factura</p>
                 <p className="text-2xl font-black text-foreground tracking-tighter">{formatCurrency(payingInvoice.total_amount)}</p>
               </div>
               <div className="text-right space-y-1">
                 <p className="text-[10px] font-black text-primary uppercase tracking-widest">Saldo Deudor</p>
                 <p className="text-4xl font-black text-foreground tracking-tighter">{formatCurrency(Number(payingInvoice.total_amount) - Number(payingInvoice.paid_amount))}</p>
               </div>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Monto a Recaudar</label>
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-5xl font-black text-slate-300 dark:text-slate-800">$</span>
                   <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full h-32 bg-transparent border-b-2 border-slate-200 dark:border-white/5 font-black text-7xl text-foreground outline-none pl-12 tabular-nums"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Medio de Pago</label>
                <div className="grid grid-cols-2 gap-4">
                  {['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`h-16 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        paymentMethod === method 
                          ? 'bg-primary text-white scale-[1.02] shadow-lg' 
                          : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground border border-transparent hover:border-slate-300 dark:hover:border-white/5'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleAddPayment}
              className="w-full h-24 bg-primary text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] flex items-center justify-center gap-4 hover:opacity-90 transition-all duration-500 active:scale-95 shadow-xl shadow-primary/20"
            >
              <ShieldCheck size={22} /> Confirmar Transacción
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
