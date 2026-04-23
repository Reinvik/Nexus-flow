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
  Search
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
  
  const availableYears = useMemo(() => {
    if (invoices.length === 0) return [new Date().getFullYear()];
    const years = invoices.map(inv => {
      const date = new Date(inv.payment_due_date || inv.issued_at || "");
      return date.getFullYear();
    }).filter(y => !isNaN(y) && y > 2000 && y < 2100);
    return Array.from(new Set([...years, new Date().getFullYear()])).sort((a, b) => b - a);
  }, [invoices]);

  useEffect(() => {
    fetchData();
  }, [showPaid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Invoices with Client info
      let invQuery = supabase
        .from('invoices')
        .select(`
          *,
          client:clients!invoices_client_id_fkey(*)
        `);
      
      if (!showPaid) {
        invQuery = invQuery.neq('status', 'Pagada');
      }

      const { data: invData, error: invError } = await invQuery.order('issued_at', { ascending: false });

      if (invError) throw invError;

      // Fetch Payments
      const { data: payData, error: payError } = await supabase
        .from('payments')
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
        .from('invoices')
        .update({
          issued_at: editIssuedAt,
          payment_due_date: editDueDate || null
        })
        .eq('id', editingInvoice.id);

      if (error) throw error;
      
      toast.success('Factura actualizada correctamente');
      setEditingInvoice(null);
      fetchData();
    } catch (error: any) {
      toast.error('Error al actualizar factura: ' + error.message);
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
      // 1. Insert payment record
      const { error: payError } = await supabase
        .from('payments')
        .insert({
          invoice_id: payingInvoice.id,
          amount: amount,
          payment_method: paymentMethod,
          payment_date: new Date().toISOString()
        });

      if (payError) throw payError;

      // 2. Update invoice status and paid_amount
      const { error: invError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount,
          status: isFullyPaid ? 'Pagada' : 'Pendiente'
        })
        .eq('id', payingInvoice.id);

      if (invError) throw invError;

      toast.success(isFullyPaid ? 'Factura pagada en su totalidad' : 'Abono registrado correctamente');
      setPayingInvoice(null);
      setPaymentAmount('');
      fetchData();
    } catch (error: any) {
      toast.error('Error al registrar pago: ' + error.message);
    }
  };

  const monthlyData = useMemo(() => {
    return MONTHS.map((name, index) => {
      const monthInvoices = invoices.filter(inv => {
        const dateStr = inv.payment_due_date || inv.issued_at;
        if (!dateStr) return false;
        
        const date = new Date(dateStr);
        return date.getMonth() === index && date.getFullYear() === selectedYear;
      });

      const collected = monthInvoices.reduce((sum, inv) => {
        if (inv.status === 'Pagada' || Number(inv.paid_amount) > 0) {
          return sum + Number(inv.paid_amount || 0);
        }
        return sum;
      }, 0);

      const directPayments = payments.reduce((sum, p) => {
        const pDate = new Date(p.payment_date);
        if (pDate.getMonth() === index && pDate.getFullYear() === selectedYear) {
          return sum + Number(p.amount);
        }
        return sum;
      }, 0);

      const toCollect = monthInvoices.reduce((sum, inv) => {
        if (inv.status !== 'Pagada') {
          const balance = Number(inv.total_amount) - Number(inv.paid_amount || 0);
          return sum + (balance > 0 ? balance : 0);
        }
        return sum;
      }, 0);

      return {
        name,
        index,
        collected: collected > 0 ? collected : directPayments,
        toCollect,
        totalInvoices: monthInvoices.length,
        invoices: monthInvoices
      };
    });
  }, [invoices, payments, selectedYear]);

  const totalToCollect = useMemo(() => monthlyData.reduce((sum, m) => sum + m.toCollect, 0), [monthlyData]);
  const totalCollected = useMemo(() => monthlyData.reduce((sum, m) => sum + m.collected, 0), [monthlyData]);



  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 animate-pulse font-medium">Analizando flujo de caja...</p>
      </div>
    );
  }

  const selectedMonthData = selectedMonth !== null ? monthlyData[selectedMonth] : null;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full">
              Financial Intelligence
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tightest">
            Recaudación <span className="text-primary">{selectedYear}</span>
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <p className="text-slate-500 max-w-md">
              Seguimiento de facturación pendiente y flujo de caja.
            </p>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-card border border-card-border rounded-xl px-4 py-2 font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="glass-card p-4 rounded-2xl flex items-center gap-4 border-emerald-500/20 min-w-[180px]">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="text-emerald-500" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recaudado {selectedYear}</p>
              <p className="text-xl font-black">{formatCurrency(totalCollected)}</p>
            </div>
          </div>
          <div className="glass-card p-4 rounded-2xl flex items-center gap-4 border-amber-500/20 min-w-[180px]">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <Clock className="text-amber-500" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pendiente {selectedYear}</p>
              <p className="text-xl font-black">{formatCurrency(totalToCollect)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthlyData.map((month) => {
          const isSelected = selectedMonth === month.index;
          const hasPending = month.toCollect > 0;
          
          return (
            <button
              key={month.index}
              onClick={() => setSelectedMonth(isSelected ? null : month.index)}
              className={`group relative flex flex-col p-6 rounded-3xl transition-all duration-300 text-left border ${
                isSelected 
                  ? 'bg-card border-primary shadow-xl scale-[1.02] z-10' 
                  : 'glass-card border-card-border hover:border-slate-400 hover:scale-[1.01]'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className={`text-xl font-black transition-colors ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {month.name}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Periodo</p>
                </div>
                {hasPending ? (
                  <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-2 py-1 rounded-full uppercase">Cobro</span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-black px-2 py-1 rounded-full uppercase">Al día</span>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Cobrado</p>
                    <p className="text-lg font-bold text-emerald-500">{formatCurrency(month.collected)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Por Cobrar</p>
                    <p className={`text-lg font-bold ${hasPending ? 'text-amber-500' : 'text-slate-400'}`}>
                      {formatCurrency(month.toCollect)}
                    </p>
                  </div>
                </div>
                
                {/* Micro Progress Bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${(month.collected / (month.collected + month.toCollect || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {isSelected && (
                <div className="absolute bottom-4 right-4 animate-bounce">
                  <ChevronRight size={20} className="text-primary" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Details Section */}
      {selectedMonthData && (
        <div className="glass-card rounded-[2.5rem] p-8 border-primary/20 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white">Detalle de {selectedMonthData.name}</h2>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-slate-500 font-medium">{selectedMonthData.totalInvoices} facturas emitidas este mes</p>
                <button 
                  onClick={() => setShowPaid(!showPaid)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    showPaid 
                      ? 'bg-emerald-500 text-white shadow-lg' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {showPaid ? 'Ocultar Pagadas' : 'Ver Pagadas'}
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar cliente o RUT..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all w-64 shadow-sm"
                />
              </div>
              <button 
                onClick={() => {
                  setSelectedMonth(null);
                  setInvoiceSearch('');
                }}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-card-border">
                  <th className="pb-4 pt-2">Cliente</th>
                  <th className="pb-4 pt-2">Vencimiento</th>
                  <th className="pb-4 pt-2">Monto Total</th>
                  <th className="pb-4 pt-2">Saldo</th>
                  <th className="pb-4 pt-2">Estado</th>
                  <th className="pb-4 pt-2">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {selectedMonthData.invoices
                  .filter(inv => (showPaid || inv.status !== 'Pagada'))
                  .filter(inv => {
                    if (!invoiceSearch) return true;
                    const search = invoiceSearch.toLowerCase();
                    return (
                      inv.client?.name?.toLowerCase().includes(search) ||
                      inv.client?.rut?.toLowerCase().includes(search)
                    );
                  })
                  .map((inv) => (
                  <tr key={inv.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <User size={14} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{inv.client?.name || 'Cliente sin nombre'}</p>
                          <p className="text-[10px] text-slate-400">{inv.client?.rut}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Calendar size={12} className="text-slate-400" />
                          <span className="text-slate-500">Venc:</span>
                          {inv.payment_due_date ? formatDate(inv.payment_due_date) : 
                           inv.issued_at ? formatDate(inv.issued_at) : 'N/A'}
                        </div>
                        {inv.issued_at && (
                          <div className="text-[10px] text-slate-400 ml-5">
                            Emit: {formatDate(inv.issued_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-sm font-bold">{formatCurrency(inv.total_amount)}</td>
                    <td className="py-4">
                      <span className={`text-sm font-black ${Number(inv.total_amount) - Number(inv.paid_amount) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {formatCurrency(Number(inv.total_amount) - Number(inv.paid_amount))}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        inv.status === 'Pagada' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {inv.status || 'Pendiente'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        {inv.client?.phone && (
                          <a 
                            href={`https://wa.me/56${inv.client.phone.replace(/\s+/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"
                            title="Contactar por WhatsApp"
                          >
                            <Phone size={14} />
                          </a>
                        )}
                        {inv.status !== 'Pagada' && (
                          <button 
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPaymentAmount((Number(inv.total_amount) - Number(inv.paid_amount)).toString());
                            }}
                            className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-white transition-all"
                            title="Registrar Pago / Abono"
                          >
                            <DollarSign size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setEditingInvoice(inv);
                            setEditIssuedAt(inv.issued_at.split('T')[0]);
                            setEditDueDate(inv.payment_due_date ? inv.payment_due_date.split('T')[0] : '');
                          }}
                          className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg hover:bg-primary hover:text-white transition-all"
                          title="Editar Factura"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-[2rem] p-8 border-primary/30 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black">Editar Factura <span className="text-primary">#{editingInvoice.folio}</span></h3>
              <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Emisión</label>
                <input 
                  type="date" 
                  value={editIssuedAt}
                  onChange={(e) => setEditIssuedAt(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-primary outline-none text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Fecha Vencimiento</label>
                <input 
                  type="date" 
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-primary outline-none text-foreground"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={handleUpdateInvoice}
                className="flex-1 bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
              >
                <Save size={18} /> Guardar Cambios
              </button>
              <button 
                onClick={() => setEditingInvoice(null)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-[2rem] p-8 border-amber-500/30 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black">Registrar <span className="text-amber-500">Pago</span></h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Factura #{payingInvoice.folio}</p>
              </div>
              <button onClick={() => setPayingInvoice(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Monto Total:</span>
                <span className="font-bold">{formatCurrency(payingInvoice.total_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Saldo Pendiente:</span>
                <span className="font-black text-amber-500">
                  {formatCurrency(Number(payingInvoice.total_amount) - Number(payingInvoice.paid_amount))}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Monto a {Number(paymentAmount) >= (Number(payingInvoice.total_amount) - Number(payingInvoice.paid_amount)) ? 'Pagar' : 'Abonar'}</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-background border border-card-border rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-xl font-black text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Método de Pago</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-amber-500 outline-none font-bold text-foreground"
                >
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={handleAddPayment}
                className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
              >
                <CreditCard size={18} /> Procesar Pago
              </button>
              <button 
                onClick={() => setPayingInvoice(null)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

