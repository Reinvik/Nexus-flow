import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Invoice } from '@/types';
import toast from 'react-hot-toast';
import { Search, FileText, Calendar, DollarSign, Download, Eye, Edit2, X, Save } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

export default function InvoicesView() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [selectedCommune, setSelectedCommune] = useState<string>('Todas');
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  
  // Edit Form State
  const [editFolio, setEditFolio] = useState<string>('');
  const [editIssuedAt, setEditIssuedAt] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editPaidAmount, setEditPaidAmount] = useState<string>('');

  useEffect(() => {
    fetchInvoices();
  }, [showPaid]);

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select(`
        *,
        sales!invoices_sale_id_fkey (
          id,
          total_tax,
          created_at
        ),
        client:clients!invoices_client_id_fkey (
          id,
          name,
          commune
        )
      `);
    
    // Si no queremos ver las pagadas, las filtramos en el servidor
    if (!showPaid) {
      query = query.neq('status', 'Pagada');
    }

    const { data, error } = await query.order('folio', { ascending: false });
      
    if (error) {
      toast.error('Error al cargar facturas');
      console.error(error);
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const handleUpdateInvoice = async () => {
    if (!editingInvoice) return;

    try {
      const folio = parseInt(editFolio, 10);
      const paid = parseFloat(editPaidAmount) || 0;
      
      if (isNaN(folio)) {
        toast.error('Folio inválido');
        return;
      }

      const isFullyPaid = paid >= Number(editingInvoice.total_amount);
      const isPartial = paid > 0 && paid < Number(editingInvoice.total_amount);

      const { error } = await supabase
        .from('invoices')
        .update({
          folio: folio,
          issued_at: editIssuedAt,
          payment_due_date: editDueDate || null,
          paid_amount: paid,
          status: isFullyPaid ? 'Pagada' : (isPartial ? 'Parcial' : 'Pendiente')
        })
        .eq('id', editingInvoice.id);

      if (error) throw error;

      toast.success('Factura actualizada');
      setEditingInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      toast.error('Error al actualizar: ' + error.message);
    }
  };

  const filtered = invoices.filter(inv => {
    const matchesSearch = 
      inv.folio?.toString().includes(searchTerm) || 
      inv.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = showPaid || inv.status !== 'Pagada';
    const matchesCommune = selectedCommune === 'Todas' || inv.client?.commune === selectedCommune;
    return matchesSearch && matchesStatus && matchesCommune;
  });

  const communes = useMemo(() => {
    const set = new Set(invoices.map(inv => inv.client?.commune).filter(Boolean));
    return ['Todas', ...Array.from(set).sort()];
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Historial de Facturas</h2>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-card-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por folio o cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-card-border rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button 
              onClick={() => setShowPaid(!showPaid)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                showPaid 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-card-border'
              }`}
            >
              {showPaid ? 'Ocultar Pagadas' : 'Mostrar Pagadas'}
            </button>
            <span className="text-[10px] text-slate-400 font-medium">
              {!showPaid && `Filtrando: Solo Pendientes y Parciales`}
            </span>
          </div>
          
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Comuna:</label>
            <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
              <select
                value={selectedCommune}
                onChange={(e) => setSelectedCommune(e.target.value)}
                className="bg-background border border-card-border rounded-lg px-3 py-1 text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
              >
                {communes.map(commune => (
                  <option key={commune} value={commune}>{commune}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-sm">
              <tr>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Folio</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Fecha</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Total</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Abonado</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Saldo</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px]">Estado</th>
                <th className="p-4 font-medium uppercase tracking-widest text-[10px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">Cargando facturas...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500">No se encontraron facturas.</td></tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg">#{inv.folio}</p>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {inv.client?.name || 'Cargando...'}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-tighter">{inv.client?.commune || 'Sin Comuna'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400"/>
                        {inv.issued_at ? formatDate(inv.issued_at) : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold flex items-center gap-1 text-emerald-500">
                        <DollarSign size={14}/>
                        {inv.total_amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium flex items-center gap-1 text-slate-500">
                        <DollarSign size={14}/>
                        {(inv.paid_amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-bold flex items-center gap-1 text-rose-500">
                        <DollarSign size={14}/>
                        {(Number(inv.total_amount) - Number(inv.paid_amount || 0)).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        inv.status === 'Pagada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        inv.status === 'Parcial' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' :
                        inv.status === 'Pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingInvoice(inv);
                            setEditFolio((inv.folio || '').toString());
                            setEditIssuedAt(inv.issued_at ? inv.issued_at.split('T')[0] : '');
                            setEditDueDate(inv.payment_due_date ? inv.payment_due_date.split('T')[0] : '');
                            setEditPaidAmount((inv.paid_amount ?? 0).toString());
                          }}
                          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary transition-colors"
                          title="Editar Factura"
                        >
                          <Edit2 size={18} />
                        </button>
                        {inv.status !== 'Pagada' && (
                          <button 
                            onClick={async () => {
                              const { error } = await supabase
                                .from('invoices')
                                .update({ 
                                  paid_amount: inv.total_amount,
                                  status: 'Pagada'
                                })
                                .eq('id', inv.id);
                              if (!error) {
                                toast.success('Factura pagada');
                                fetchInvoices();
                              }
                            }}
                            className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                            title="Marcar como Pagado"
                          >
                            <DollarSign size={18} />
                          </button>
                        )}
                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary transition-colors">
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-[2rem] p-8 border-primary/30 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black">Editar Factura <span className="text-primary">#{editingInvoice.folio}</span></h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{editingInvoice.client?.name}</p>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Número de Folio</label>
                <input 
                  type="number" 
                  value={editFolio}
                  onChange={(e) => setEditFolio(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-primary outline-none text-foreground font-bold"
                />
              </div>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 text-rose-500">Fecha Vencimiento</label>
                <input 
                  type="date" 
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 mt-1 focus:ring-2 focus:ring-rose-500 outline-none text-foreground font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Monto Pagado / Abonado</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number" 
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                    className="w-full bg-background border border-card-border rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-xl font-black text-foreground"
                  />
                  <button 
                    onClick={() => setEditPaidAmount(editingInvoice.total_amount.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-md hover:bg-emerald-600 transition-colors"
                  >
                    Pagar Todo
                  </button>
                </div>
                <div className="flex justify-between mt-2 px-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total: ${Number(editingInvoice.total_amount).toLocaleString()}</p>
                  <p className="text-[10px] text-rose-500 font-bold uppercase">Saldo: ${(Number(editingInvoice.total_amount) - Number(editPaidAmount || 0)).toLocaleString()}</p>
                </div>
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
    </div>
  )
}

