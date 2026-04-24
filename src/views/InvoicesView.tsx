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

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaid, setShowPaid] = useState(false);
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
  }, [showPaid]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('nf_invoices')
        .select(`
          *,
          client:nf_clients!nf_invoices_client_id_fkey (*)
        `);
      
      if (!showPaid) {
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
      return matchesSearch && matchesCommune;
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
    <div className="space-y-8 lg:h-[calc(100vh-180px)] flex flex-col font-outfit">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
        <div className="space-y-2">
          <h2 className="text-5xl font-black tracking-tight text-foreground uppercase leading-none">Cuentas</h2>
          <div className="flex items-center gap-2">
             <span className="w-8 h-px bg-primary" />
              <p className="text-[10px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-[0.4em]">Libro de Cobranzas</p>
          </div>
        </div>
        
        <div className="flex bg-slate-200/50 dark:bg-white/[0.03] p-1.5 rounded-[1.25rem] border border-slate-200 dark:border-white/5 w-full md:w-auto shadow-2xl">
          <button 
            onClick={() => setShowPaid(false)}
            className={`flex-1 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${!showPaid ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-500 hover:text-foreground'}`}
          >
            Pendientes
          </button>
          <button 
            onClick={() => setShowPaid(true)}
            className={`flex-1 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${showPaid ? 'bg-primary text-white dark:bg-white dark:text-black shadow-lg' : 'text-slate-500 hover:text-foreground'}`}
          >
            Historial
          </button>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-col md:flex-row gap-4 px-4">
        <div className="flex-1 glass-card p-5 rounded-3xl flex items-center gap-4 group border-slate-200 dark:border-white/5">
          <Search size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por folio o razón social..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-foreground font-medium uppercase text-xs tracking-wider placeholder:text-slate-400 dark:placeholder:text-slate-700"
          />
        </div>
        
        <div className="flex gap-4">
          <div className="glass-card px-6 py-5 rounded-3xl flex items-center gap-3 min-w-[200px] group border-slate-200 dark:border-white/5">
            <MapPin size={16} className="text-primary/50 group-hover:text-primary transition-colors" />
            <select 
              value={selectedCommune}
              onChange={e => setSelectedCommune(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase text-foreground appearance-none cursor-pointer"
            >
              {communes.map(c => <option key={c} value={c} className="bg-slate-100 dark:bg-slate-900">{c === 'Todas' ? 'Todas las Comunas' : c}</option>)}
            </select>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          <div className="glass-card p-1.5 rounded-3xl flex items-center gap-1.5 border-slate-200 dark:border-white/5">
             <button 
               onClick={() => requestSort('total_amount')}
               className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all duration-300 ${sortConfig.key === 'total_amount' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-foreground'}`}
             >
               Monto {sortConfig.key === 'total_amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
             </button>
             <button 
               onClick={() => requestSort('folio')}
               className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all duration-300 ${sortConfig.key === 'folio' ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:text-foreground'}`}
             >
               Folio {sortConfig.key === 'folio' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
             </button>
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24">
        <div className="grid grid-cols-1 gap-4">
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
              <div key={inv.id} className="glass-card p-8 rounded-[2.5rem] group hover:bg-slate-100/50 dark:hover:bg-white/[0.01] transition-all duration-500 border-slate-200 dark:border-white/5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-[2rem] bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-slate-400 group-hover:border-primary/30 transition-all duration-700">
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-tighter">Folio</span>
                        <span className="text-2xl font-black text-foreground group-hover:text-primary transition-colors">#{inv.folio}</span>
                      </div>
                      {isOverdue && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-[6px] border-background shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{inv.client?.name || 'Venta Directa'}</h3>
                        {isOverdue && (
                           <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-slate-400 dark:text-slate-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatDate(inv.issued_at)}</span>
                         </div>
                         <span className="w-1.5 h-1.5 bg-slate-200 dark:bg-white/5 rounded-full" />
                         <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border transition-colors duration-500 ${getStatusColor(inv.status, inv.payment_due_date)}`}>
                            {inv.status}
                         </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2">
                    <div className="flex items-center gap-6">
                       <div className="text-right space-y-1">
                          <p className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em]">Deuda Actual</p>
                          <p className={`text-3xl font-black tracking-tighter ${balance > 0 ? 'text-foreground' : 'text-emerald-500'}`}>{formatCurrency(balance)}</p>
                       </div>
                       <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingInvoice(inv);
                              setEditFolio(inv.folio.toString());
                              setEditIssuedAt(inv.issued_at?.split('T')[0] || '');
                              setEditDueDate(inv.payment_due_date?.split('T')[0] || '');
                              setEditTotalAmount((inv.total_amount || 0).toString());
                              setEditPaidAmount((inv.paid_amount || 0).toString());
                            }}
                            className="w-12 h-12 flex items-center justify-center bg-slate-200/50 dark:bg-white/5 hover:bg-primary hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-500 rounded-2xl transition-all duration-500 active:scale-90"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button className="w-12 h-12 flex items-center justify-center bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-500 rounded-2xl transition-all active:scale-90">
                            <Download size={16} />
                          </button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal - Ultra Minimalist Redesign */}
      {editingInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/80 dark:bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-lg p-12 rounded-[3.5rem] space-y-10 relative border-slate-200 dark:border-white/10 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.2)] dark:shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
             <div className="flex items-center justify-between">
                <div className="space-y-2">
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Modificar Obligación</p>
                   <h3 className="text-4xl font-black text-foreground uppercase tracking-tighter">Folio #{editingInvoice.folio}</h3>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{editingInvoice.client?.name}</p>
                </div>
                <button onClick={() => setEditingInvoice(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground transition-colors"><X size={28} /></button>
             </div>

             <div className="space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Numeración</label>
                      <input 
                        type="number"
                        value={editFolio}
                        onChange={e => setEditFolio(e.target.value)}
                        className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-5 rounded-2xl text-xl font-black outline-none focus:border-primary/30 text-foreground transition-all"
                      />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Emisión</label>
                      <input 
                        type="date"
                        value={editIssuedAt}
                        onChange={e => setEditIssuedAt(e.target.value)}
                        className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-5 rounded-2xl text-[11px] font-black outline-none focus:border-primary/30 text-foreground transition-all"
                      />
                   </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Valor Documento</label>
                       <button 
                         onClick={() => setEditTotalAmount((parseFloat(editTotalAmount) / 1000).toString())}
                         className="text-primary text-[10px] font-black uppercase hover:opacity-70 transition-colors"
                       >
                         Normalizar (÷ 1000)
                       </button>
                    </div>
                    <div className="relative">
                       <div className="absolute left-6 top-1/2 -translate-y-1/2 text-primary text-xl font-black z-10">$</div>
                       <input 
                         type="number"
                         value={editTotalAmount}
                         onChange={e => setEditTotalAmount(e.target.value)}
                         className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-8 pl-14 rounded-3xl text-4xl font-black text-foreground outline-none focus:border-primary/30 transition-all tracking-tighter"
                       />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                       <label className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Pago Recibido</label>
                       <button 
                         onClick={() => setEditPaidAmount(editTotalAmount)}
                         className="text-emerald-500 text-[10px] font-black uppercase hover:opacity-70 transition-colors"
                       >
                         Liquidar Total
                       </button>
                    </div>
                    <div className="relative">
                       <div className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 text-xl font-black z-10">$</div>
                       <input 
                         type="number"
                         value={editPaidAmount}
                         onChange={e => setEditPaidAmount(e.target.value)}
                         className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-8 pl-14 rounded-3xl text-4xl font-black text-foreground outline-none focus:border-primary/30 transition-all tracking-tighter"
                       />
                    </div>
                 </div>
             </div>

             <div className="flex gap-4 pt-4">
                <button 
                  onClick={handleUpdateInvoice}
                  className="flex-1 h-20 bg-primary text-white dark:bg-white dark:text-black rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:opacity-90 transition-all duration-500 active:scale-95 shadow-xl shadow-primary/20"
                >
                  Guardar Cambios
                </button>
                <button 
                  onClick={() => setEditingInvoice(null)}
                  className="px-10 h-20 bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-foreground rounded-3xl font-black text-xs uppercase tracking-widest transition-all"
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
