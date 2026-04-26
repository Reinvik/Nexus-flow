import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types';
import toast from 'react-hot-toast';
import { 
  Search, 
  FileText, 
  Calendar, 
  DollarSign, 
  Download, 
  Edit2, 
  X, 
  Save, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MapPin,
  ArrowUpRight,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/formatters';

interface InvoicesProps {
  initialInvoiceId?: string | null;
  onClearInvoice?: () => void;
  initialCommune?: string | null;
  onClearCommune?: () => void;
  initialFilter?: string | null;
  onClearFilter?: () => void;
}

export default function InvoicesView({ initialInvoiceId, onClearInvoice, initialCommune, onClearCommune, initialFilter, onClearFilter }: InvoicesProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'pending' | 'history' | 'weekly'>('pending');
  const [selectedCommune, setSelectedCommune] = useState<string>('Todas');
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'folio', direction: 'desc' });
  
  // Edit Form State
  const [editFolio, setEditFolio] = useState<string>('');
  const [editIssuedAt, setEditIssuedAt] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');
  const [editTotalAmount, setEditTotalAmount] = useState<string>('');

  useEffect(() => {
    fetchInvoices();
  }, [viewMode]);

  useEffect(() => {
    if (initialInvoiceId && invoices.length > 0) {
      const target = invoices.find(inv => inv.id === initialInvoiceId);
      if (target) {
        setEditingInvoice(target);
        setEditFolio(target.folio.toString());
        setEditIssuedAt(target.issued_at?.split('T')[0] || '');
        setEditDueDate(target.payment_due_date?.split('T')[0] || '');
        setEditTotalAmount((target.total_amount || 0).toString());
        setEditPaidAmount((target.paid_amount || 0).toString());
        if (onClearInvoice) onClearInvoice();
      }
    }
  }, [initialInvoiceId, invoices, onClearInvoice]);
  
  useEffect(() => {
    if (initialCommune && invoices.length > 0) {
      setSelectedCommune(initialCommune);
      if (onClearCommune) onClearCommune();
    }
  }, [initialCommune, invoices, onClearCommune]);

  useEffect(() => {
    if (initialFilter === 'weekly' && invoices.length > 0) {
      setViewMode('weekly');
      if (onClearFilter) onClearFilter();
    }
  }, [initialFilter, invoices, onClearFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('nf_invoices')
        .select(`
          *,
          client:nf_clients!nf_invoices_client_id_fkey (*)
        `);
      
      if (viewMode !== 'history' && !initialInvoiceId) {
        query = query.neq('status', 'Pagada');
      }

      const { data, error } = await query.order('folio', { ascending: false });
        
      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast.error('Error al cargar facturas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;
    try {
      const folio = parseInt(editFolio, 10);
      const total = parseFloat(editTotalAmount) || 0;
      const paid = parseFloat(editPaidAmount) || 0;
      
      const isFullyPaid = paid >= total;
      const isPartial = paid > 0 && paid < total;

      const { error } = await supabase
        .from('nf_invoices')
        .update({
          folio: folio,
          issued_at: editIssuedAt,
          payment_due_date: editDueDate || null,
          total_amount: total,
          paid_amount: paid,
          status: isFullyPaid ? 'Pagada' : (isPartial ? 'Parcial' : 'Pendiente')
        })
        .eq('id', editingInvoice.id);

      if (error) throw error;

      toast.success('Registro actualizado', {
        style: { background: '#020617', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
      });
      setEditingInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      toast.error('Error al actualizar');
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filtered = useMemo(() => {
    let result = invoices.filter(inv => {
      const matchesSearch = 
        inv.folio?.toString().includes(searchTerm) || 
        inv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCommune = selectedCommune === 'Todas' || inv.client?.commune === selectedCommune;
      
      let matchesWeekly = true;
      if (viewMode === 'weekly') {
        const now = new Date();
        const diff = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
        const startOfWeek = new Date(now.setDate(diff));
        startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(now.setDate(diff + 6));
        endOfWeek.setHours(23,59,59,999);
        
        const dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
        matchesWeekly = dueDate !== null && dueDate >= startOfWeek && dueDate <= endOfWeek;
      }

      return matchesSearch && matchesCommune && matchesWeekly;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'client') {
          aValue = a.client?.name || '';
          bValue = b.client?.name || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [invoices, searchTerm, selectedCommune, sortConfig]);

  const communes = useMemo(() => {
    const set = new Set(invoices.map(inv => inv.client?.commune).filter(Boolean));
    return ['Todas', ...Array.from(set).sort()];
  }, [invoices]);

  const getStatusColor = (status: string, dueDate?: string) => {
    const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'Pagada';
    if (isOverdue) return 'text-rose-500 bg-rose-500/5 border-rose-500/10';
    if (status === 'Pagada') return 'text-emerald-500 bg-emerald-500/5 border-emerald-500/10';
    if (status === 'Parcial') return 'text-primary bg-primary/5 border-primary/10';
    return 'text-slate-400 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5';
  };

  return (
    <div className="space-y-6 lg:h-[calc(100vh-180px)] flex flex-col font-outfit animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-4">
        <div className="space-y-1">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-foreground uppercase leading-none">Cuentas</h2>
          <div className="flex items-center gap-2">
             <span className="w-8 h-px bg-primary" />
              <p className="text-[9px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-[0.4em]">Libro de Cobranzas</p>
          </div>
        </div>
        
        <div className="flex bg-slate-200/50 dark:bg-white/[0.03] p-1.5 rounded-[1.25rem] border border-slate-200 dark:border-white/5 w-full lg:w-auto shadow-2xl">
          <button 
            onClick={() => setViewMode('pending')}
            className={`flex-1 lg:px-6 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'pending' ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-500 hover:text-foreground'}`}
          >
            Pendientes
          </button>
          <button 
            onClick={() => setViewMode('weekly')}
            className={`flex-1 lg:px-6 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'weekly' ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-500 hover:text-foreground'}`}
          >
            Próximos
          </button>
          <button 
            onClick={() => setViewMode('history')}
            className={`flex-1 lg:px-6 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${viewMode === 'history' ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-500 hover:text-foreground'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-col lg:flex-row gap-4 px-4">
        <div className="flex-1 glass-card p-4 lg:p-5 rounded-[1.5rem] lg:rounded-3xl flex items-center gap-4 group border-slate-200 dark:border-white/5">
          <Search size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="BUSCAR POR FOLIO O RAZÓN SOCIAL..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-foreground font-bold uppercase text-[10px] tracking-widest placeholder:text-slate-400 dark:placeholder:text-slate-700"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="glass-card px-6 py-4 lg:py-5 rounded-[1.5rem] lg:rounded-3xl flex items-center justify-between gap-3 min-w-[200px] group border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-primary/50 group-hover:text-primary transition-colors" />
              <select 
                value={selectedCommune}
                onChange={e => setSelectedCommune(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-foreground appearance-none cursor-pointer"
              >
                {communes.map(c => <option key={c} value={c} className="bg-slate-100 dark:bg-slate-900">{c === 'Todas' ? 'Todas las Comunas' : c}</option>)}
              </select>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          <div className="glass-card p-1.5 rounded-[1.5rem] lg:rounded-3xl flex items-center gap-1.5 border-slate-200 dark:border-white/5">
             <button 
               onClick={() => requestSort('total_amount')}
               className={`flex-1 sm:flex-none px-5 py-3 rounded-xl lg:rounded-2xl text-[9px] font-black uppercase transition-all duration-300 ${sortConfig.key === 'total_amount' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-foreground'}`}
             >
               Monto {sortConfig.key === 'total_amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
             </button>
             <button 
               onClick={() => requestSort('folio')}
               className={`flex-1 sm:flex-none px-5 py-3 rounded-xl lg:rounded-2xl text-[9px] font-black uppercase transition-all duration-300 ${sortConfig.key === 'folio' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-foreground'}`}
             >
               Folio {sortConfig.key === 'folio' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
             </button>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-32">
        <div className="grid grid-cols-1 gap-4 lg:gap-6">
          {loading ? (
             <div className="py-32 flex flex-col items-center gap-6 opacity-20">
                <div className="w-12 h-12 border-2 border-slate-400 border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Actualizando Registros</p>
             </div>
          ) : filtered.length === 0 ? (
             <div className="py-32 text-center opacity-10 space-y-6">
                <FileText size={64} strokeWidth={1} className="mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">Sin movimientos pendientes</p>
             </div>
          ) : filtered.map(inv => {
            const balance = Number(inv.total_amount) - Number(inv.paid_amount || 0);
            const isOverdue = inv.payment_due_date && new Date(inv.payment_due_date) < new Date() && inv.status !== 'Pagada';
            
            return (
              <div key={inv.id} className="glass-card p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] group hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-all duration-500 border-slate-200 dark:border-white/5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.02] blur-[50px] -mr-16 -mt-16 pointer-events-none" />
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4 lg:gap-8">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] lg:rounded-[2rem] bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-slate-400 group-hover:border-primary/30 transition-all duration-700">
                        <span className="text-[8px] font-black opacity-40 uppercase tracking-tighter">Folio</span>
                        <span className="text-xl lg:text-2xl font-black text-foreground group-hover:text-primary transition-colors">#{inv.folio}</span>
                      </div>
                      {isOverdue && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-[4px] border-background shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse" />
                      )}
                    </div>
                    <div className="space-y-1.5 lg:space-y-2 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-base lg:text-xl font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors leading-tight truncate">{inv.client?.name || 'Venta Directa'}</h3>
                        {isOverdue && (
                           <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                         <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-slate-400 dark:text-slate-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatDate(inv.issued_at)}</span>
                         </div>
                         <span className="hidden lg:block w-1.5 h-1.5 bg-slate-200 dark:bg-white/5 rounded-full" />
                         <span className={`text-[8px] lg:text-[9px] font-black px-3 py-1 rounded-full uppercase border transition-colors duration-500 ${getStatusColor(inv.status, inv.payment_due_date)}`}>
                            {inv.status}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 lg:gap-2 border-t lg:border-t-0 border-slate-100 dark:border-white/5 pt-4 lg:pt-0">
                    <div className="text-left lg:text-right space-y-0.5 lg:space-y-1">
                      <p className="text-[8px] lg:text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em]">Deuda Actual</p>
                      <p className={`text-2xl lg:text-3xl font-black tracking-tighter ${balance > 0 ? 'text-foreground' : 'text-emerald-500'}`}>{formatCurrency(balance)}</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setEditingInvoice(inv);
                        setEditFolio(inv.folio.toString());
                        setEditIssuedAt(inv.issued_at?.split('T')[0] || '');
                        setEditDueDate(inv.payment_due_date?.split('T')[0] || '');
                        setEditTotalAmount((inv.total_amount || 0).toString());
                        setEditPaidAmount((inv.paid_amount || 0).toString());
                      }}
                      className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-primary hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-500 rounded-2xl transition-all duration-500 active:scale-90 shadow-sm"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal - Improved Responsive Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-6 bg-background/80 dark:bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-lg p-6 lg:p-12 rounded-[2.5rem] lg:rounded-[3.5rem] space-y-8 lg:space-y-10 relative border-slate-200 dark:border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar shadow-2xl">
             <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 lg:space-y-2">
                   <p className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-[0.4em]">Modificar Obligación</p>
                   <h3 className="text-2xl lg:text-4xl font-black text-foreground uppercase tracking-tighter leading-none">Folio #{editingInvoice.folio}</h3>
                   <p className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-widest leading-none truncate max-w-[200px] sm:max-w-none">{editingInvoice.client?.name}</p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="w-10 h-10 lg:w-12 lg:h-12 shrink-0 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-foreground transition-colors"><X size={24} /></button>
             </div>

             <div className="space-y-6 lg:space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                   <div className="space-y-2 lg:space-y-3">
                      <label className="text-[9px] lg:text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Numeración</label>
                      <input 
                        type="number"
                        value={editFolio}
                        onChange={e => setEditFolio(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 lg:p-5 rounded-2xl text-lg lg:text-xl font-black outline-none focus:border-primary/30 text-foreground transition-all"
                      />
                   </div>
                   <div className="space-y-2 lg:space-y-3">
                      <label className="text-[9px] lg:text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Emisión</label>
                      <input 
                        type="date"
                        value={editIssuedAt}
                        onChange={e => setEditIssuedAt(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 lg:p-5 rounded-2xl text-[11px] font-black outline-none focus:border-primary/30 text-foreground transition-all"
                      />
                   </div>
                </div>

                <div className="space-y-3 lg:space-y-4">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-[9px] lg:text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Valor Documento</label>
                       <button 
                         onClick={() => setEditTotalAmount((parseFloat(editTotalAmount) / 1000).toString())}
                         className="text-primary text-[9px] font-black uppercase hover:opacity-70 transition-colors"
                       >
                         Normalizar (÷ 1000)
                       </button>
                    </div>
                    <div className="relative">
                       <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary text-lg lg:text-xl font-black z-10">$</div>
                       <input 
                         type="number"
                         value={editTotalAmount}
                         onChange={e => setEditTotalAmount(e.target.value)}
                         className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 lg:p-8 pl-12 lg:pl-14 rounded-[1.5rem] lg:rounded-3xl text-2xl lg:text-4xl font-black text-foreground outline-none focus:border-primary/30 transition-all tracking-tighter"
                       />
                    </div>
                 </div>

                 <div className="space-y-3 lg:space-y-4">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-[9px] lg:text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Pago Recibido</label>
                       <button 
                         onClick={() => setEditPaidAmount(editTotalAmount)}
                         className="text-emerald-500 text-[9px] font-black uppercase hover:opacity-70 transition-colors"
                       >
                         Liquidar Total
                       </button>
                    </div>
                    <div className="relative">
                       <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 text-lg lg:text-xl font-black z-10">$</div>
                       <input 
                         type="number"
                         value={editPaidAmount}
                         onChange={e => setEditPaidAmount(e.target.value)}
                         className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-6 lg:p-8 pl-12 lg:pl-14 rounded-[1.5rem] lg:rounded-3xl text-2xl lg:text-4xl font-black text-foreground outline-none focus:border-primary/30 transition-all tracking-tighter"
                       />
                    </div>
                 </div>
             </div>

             <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={handleUpdateInvoice}
                  className="flex-1 h-16 lg:h-20 bg-primary text-white dark:bg-white dark:text-black rounded-[1.5rem] lg:rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all duration-500 active:scale-95 shadow-xl shadow-primary/20"
                >
                  Guardar Cambios
                </button>
                <button 
                  onClick={() => setEditingInvoice(null)}
                  className="sm:px-10 h-16 lg:h-20 bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-foreground rounded-[1.5rem] lg:rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Cerrar
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
