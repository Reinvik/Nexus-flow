import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client } from '@/types';
import toast from 'react-hot-toast';
import { 
  Search, 
  Plus, 
  Save, 
  Trash2, 
  X, 
  User, 
  Phone, 
  Mail, 
  Hash, 
  MessageCircle, 
  Edit3, 
  FileText, 
  Calendar, 
  ChevronRight,
  AlertCircle,
  MoreVertical,
  ArrowUpRight,
  MapPin,
  Users
} from 'lucide-react';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { formatDate, formatRUT, validateRUT, formatCurrency } from '@/lib/formatters';

export default function CustomersView() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState<any | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nf_clients')
      .select('*, nf_invoices(*)')
      .order('name');
      
    if (error) {
      toast.error('Error al cargar clientes');
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mapped = (data || []).map((c: any) => {
        const pendingInvoices = (c.nf_invoices || []).filter((inv: any) => inv.status !== 'Pagada');
        
        let status = 'none';
        if (pendingInvoices.length > 0) {
          const hasOverdue = pendingInvoices.some((inv: any) => {
            const dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
            return dueDate && dueDate < today;
          });
          status = hasOverdue ? 'overdue' : 'pending';
        }

        return {
          ...c,
          debt_status: status,
          invoice_count: c.nf_invoices?.length || 0,
          pending_count: pendingInvoices.length,
          total_debt: pendingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total_amount) - Number(inv.paid_amount || 0)), 0)
        };
      });
      setClients(mapped);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name || !rut || !phone) return toast.error('Campos obligatorios faltantes');
    if (!validateRUT(rut)) return toast.error('RUT inválido');

    const clientData = { name, rut, phone, email, address, commune };
    const { error } = editingId 
      ? await supabase.from('nf_clients').update(clientData).eq('id', editingId)
      : await supabase.from('nf_clients').insert(clientData);

    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success(editingId ? 'Registro actualizado' : 'Cliente registrado', {
        style: { background: '#020617', color: '#fff', fontSize: '10px', fontWeight: 'bold' }
      });
      resetForm();
      fetchClients();
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName(''); setRut(''); setPhone(''); setEmail(''); setAddress(''); setCommune('');
  };

  const handleEdit = (client: any) => {
    setEditingId(client.id);
    setName(client.name || '');
    setRut(client.rut || '');
    setPhone(client.phone || '');
    setEmail(client.email || '');
    setAddress(client.address || '');
    setCommune(client.commune || '');
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cliente?')) return;
    const { error } = await supabase.from('nf_clients').delete().eq('id', id);
    if (error) toast.error('Error al eliminar');
    else {
      toast.success('Cliente eliminado');
      fetchClients();
    }
  };

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.rut.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-12 lg:h-[calc(100vh-180px)] flex flex-col font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-white flex items-center justify-center shadow-xl shadow-primary/10">
                <Users size={20} className="text-primary dark:text-black" fill="currentColor" />
             </div>
             <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Gestión de Cartera</p>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-foreground uppercase leading-none">Clientes <span className="text-slate-400 dark:text-slate-800">Elite</span></h2>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
           <div className="relative group flex-1 md:flex-none">
             <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-cyan-400 transition-colors" />
             <input
               type="text"
               placeholder="BUSCAR CLIENTE..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-14 pr-6 h-16 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black text-white focus:border-cyan-500/30 outline-none w-full md:w-80 uppercase tracking-widest"
             />
           </div>
           <button 
             onClick={() => setIsAdding(true)}
             className="h-16 px-10 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-2xl"
           >
             <Plus size={18} /> Nuevo Cliente
           </button>
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-32 flex flex-col items-center gap-6 opacity-20">
                <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Actualizando Directorio</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-32 text-center opacity-10 space-y-6">
                <User size={64} strokeWidth={1} className="mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">No hay coincidencias en la base</p>
            </div>
          ) : filtered.map(client => (
            <div key={client.id} className="glass-card p-8 rounded-[2.5rem] group relative overflow-hidden flex flex-col border-white/5 hover:bg-white/[0.01] transition-all duration-700">
              <div className="flex items-start justify-between gap-6 mb-8">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/[0.02] border border-white/5 flex items-center justify-center text-3xl font-black text-slate-800 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all duration-700">
                      {client.name.charAt(0)}
                    </div>
                    {client.debt_status === 'overdue' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-[6px] border-[#020617] shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-cyan-500/90 transition-colors leading-none">{client.name}</h3>
                      {client.debt_status === 'overdue' && (
                         <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{client.rut}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(client)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/0 hover:bg-white/5 text-slate-700 hover:text-white transition-all"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(client.id)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/0 hover:bg-rose-500/10 text-slate-700 hover:text-white transition-all"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  <Phone size={14} className="text-cyan-500/50" /> {client.phone}
                </div>
                {client.commune && (
                  <div className="flex items-center gap-4 text-[11px] font-black text-slate-600 uppercase tracking-widest">
                    <MapPin size={14} className="text-cyan-500/50" /> {client.commune}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-white/5 space-y-6">
                <div className="flex justify-between items-center">
                   <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">Movimientos</span>
                      <p className="text-xl font-black text-white tracking-tighter">{client.invoice_count} <span className="text-[10px] text-slate-700 ml-1">DOCS</span></p>
                   </div>
                   {client.total_debt > 0 && (
                     <div className="text-right space-y-1">
                        <span className="text-[9px] font-black text-rose-500/70 uppercase tracking-[0.2em]">Deuda Vencida</span>
                        <p className="text-xl font-black text-rose-500 tracking-tighter">{formatCurrency(client.total_debt)}</p>
                     </div>
                   )}
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setSelectedClientHistory(client)}
                    className="flex-1 h-14 bg-white/5 hover:bg-white text-slate-500 hover:text-black rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 active:scale-95"
                  >
                    Historial
                  </button>
                  <a 
                    href={generateWhatsAppLink(client.phone, client.name, client.debt_status === 'overdue' ? 'red' : 'green', client.total_debt, [])}
                    target="_blank"
                    className="w-14 h-14 bg-emerald-500/5 text-emerald-500 flex items-center justify-center rounded-2xl hover:bg-emerald-500 hover:text-white transition-all duration-500 active:scale-95"
                  >
                    <MessageCircle size={20} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History Modal - Redesigned */}
      {selectedClientHistory && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-2xl rounded-[3.5rem] p-12 space-y-10 relative border-white/10 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
             <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Detalle de Operaciones</p>
                  <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-tight">{selectedClientHistory.name}</h3>
                </div>
                <button onClick={() => setSelectedClientHistory(null)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
             </div>

             <div className="max-h-[400px] overflow-y-auto no-scrollbar space-y-4 pr-2">
                {selectedClientHistory.nf_invoices?.sort((a: any, b: any) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()).map((inv: any) => (
                  <div key={inv.id} className="p-6 bg-white/[0.01] rounded-3xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="flex items-center gap-6">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${inv.status === 'Pagada' ? 'bg-emerald-400/5 text-emerald-400' : 'bg-cyan-400/5 text-cyan-400'}`}>
                         <FileText size={20} />
                       </div>
                       <div className="space-y-1">
                          <span className="text-sm font-black text-white uppercase tracking-tight">Folio #{inv.folio}</span>
                          <div className="flex items-center gap-2">
                             <Calendar size={12} className="text-slate-700" />
                             <span className="text-[10px] font-black text-slate-600 uppercase">{formatDate(inv.issued_at)}</span>
                          </div>
                       </div>
                    </div>
                    <div className="text-right space-y-1.5">
                       <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${inv.status === 'Pagada' ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 'border-cyan-500/20 text-cyan-400 bg-cyan-400/5'}`}>{inv.status}</span>
                       <p className="text-xl font-black text-white tracking-tighter">{formatCurrency(inv.total_amount)}</p>
                    </div>
                  </div>
                ))}
             </div>

             <div className="pt-10 border-t border-white/5 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Total Pendiente</span>
                  <p className="text-4xl font-black text-rose-500 tracking-tighter">{formatCurrency(selectedClientHistory.total_debt)}</p>
                </div>
                <button onClick={() => setSelectedClientHistory(null)} className="h-16 px-12 bg-white/5 hover:bg-white text-slate-500 hover:text-black rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-500 active:scale-95">Finalizar</button>
             </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal - Redesigned */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-lg p-12 rounded-[3.5rem] space-y-10 relative border-white/10 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                 <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.4em]">Registro Maestro</p>
                 <h3 className="text-4xl font-black text-white uppercase tracking-tighter">{editingId ? 'Actualizar' : 'Alta de'} Cliente</h3>
              </div>
              <button onClick={resetForm} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-colors"><X size={28} /></button>
            </div>
            
            <div className="space-y-8">
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Razón Social o Nombre</label>
                 <input 
                   autoFocus
                   value={name}
                   onChange={e => setName(e.target.value)}
                   className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-3xl text-sm font-black outline-none focus:border-cyan-500/30 text-white transition-all uppercase placeholder:text-slate-800"
                   placeholder="NOMBRE COMPLETO"
                 />
               </div>
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Identificación (RUT)</label>
                   <input 
                     value={rut}
                     onChange={e => setRut(formatRUT(e.target.value))}
                     className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-3xl text-sm font-black outline-none focus:border-cyan-500/30 text-white transition-all placeholder:text-slate-800"
                     placeholder="XX.XXX.XXX-X"
                   />
                 </div>
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Contacto Directo</label>
                   <input 
                     value={phone}
                     onChange={e => setPhone(e.target.value)}
                     className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-3xl text-sm font-black outline-none focus:border-cyan-500/30 text-white transition-all placeholder:text-slate-800"
                     placeholder="+56 9 ..."
                   />
                 </div>
               </div>
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Ubicación Administrativa</label>
                 <input 
                   value={commune}
                   onChange={e => setCommune(e.target.value)}
                   className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-3xl text-sm font-black outline-none focus:border-cyan-500/30 text-white transition-all uppercase placeholder:text-slate-800"
                   placeholder="COMUNA DE RESIDENCIA / GIRO"
                 />
               </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleSave}
                className="flex-1 h-20 bg-white text-black rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:bg-cyan-400 transition-all duration-500 active:scale-95 flex items-center justify-center gap-3"
              >
                <Save size={18} /> Confirmar Registro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
