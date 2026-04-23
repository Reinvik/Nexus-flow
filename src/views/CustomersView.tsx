import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, Save, Trash2, X, User, Phone, Mail, Hash, MessageCircle, Edit3, FileText, Calendar, DollarSign, Send } from 'lucide-react';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { formatDate } from '@/lib/formatters';

export default function CustomersView() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientHistory, setSelectedClientHistory] = useState<any | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // New Client Form
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
      .from('clients')
      .select('*, invoices!invoices_client_id_fkey(*)')
      .order('name');
      
    if (error) {
      toast.error('Error al cargar clientes');
      console.error(error);
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const now = new Date();
      const endOfWeek = new Date(now);
      const dayOfWeek = now.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);

      const mapped = (data || []).map((c: any) => {
        const pendingInvoices = (c.invoices || []).filter((inv: any) => inv.status !== 'Pagada');
        
        let status = 'gray'; // Default to gray (No debt)
        
        if (pendingInvoices.length > 0) {
          const getDueDate = (inv: any) => {
            if (inv.payment_due_date) return new Date(inv.payment_due_date);
            if (inv.issued_at) {
              const d = new Date(inv.issued_at);
              d.setDate(d.getDate() + 30);
              return d;
            }
            return null;
          };

          const hasOverdue = pendingInvoices.some((inv: any) => {
            const dueDate = getDueDate(inv);
            return dueDate && dueDate < today;
          });
          
          const hasDueThisWeek = pendingInvoices.some((inv: any) => {
            const dueDate = getDueDate(inv);
            return dueDate && dueDate >= today && dueDate <= endOfWeek;
          });

          if (hasOverdue) status = 'red';
          else if (hasDueThisWeek) status = 'yellow';
          else status = 'green';
        }

        return {
          ...c,
          status,
          invoice_count: c.invoices?.length || 0,
          pending_count: pendingInvoices.length,
          total_debt: pendingInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.total_amount) - Number(inv.paid_amount || 0)), 0)
        };
      });
      setClients(mapped);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name || !rut || !phone) {
      toast.error('Nombre, RUT y Teléfono son requeridos');
      return;
    }

    const clientData = {
      name,
      rut,
      phone,
      email: email || null,
      address: address || null,
      commune: commune || null
    };

    let result;
    if (editingId) {
      result = await supabase.from('clients').update(clientData).eq('id', editingId);
    } else {
      result = await supabase.from('clients').insert(clientData);
    }

    const { error } = result;

    if (error) {
      toast.error('Error al guardar cliente');
      console.error(error);
      return;
    }

    toast.success(editingId ? 'Cliente actualizado' : 'Cliente registrado');
    setIsAdding(false);
    setEditingId(null);
    setName(''); setRut(''); setPhone(''); setEmail(''); setAddress(''); setCommune('');
    fetchClients();
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

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setName(''); setRut(''); setPhone(''); setEmail(''); setAddress(''); setCommune('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar cliente?')) return;
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) toast.error('Error al eliminar');
    else {
      toast.success('Cliente eliminado');
      fetchClients();
    }
  };

  const filtered = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.rut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.commune && c.commune.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'red': return 'bg-rose-500 shadow-rose-500/50';
      case 'yellow': return 'bg-amber-500 shadow-amber-500/50';
      case 'green': return 'bg-emerald-500 shadow-emerald-500/50';
      default: return 'bg-slate-400 shadow-slate-400/50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight">Clientes</h2>
          <p className="text-sm text-slate-500 font-medium">Gestión de cartera y estado de deuda.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus size={20} /> Nuevo Cliente
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border-card-border shadow-xl">
        <div className="p-6 border-b border-card-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, RUT, comuna o dirección..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-card-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium shadow-inner"
            />
          </div>
        </div>

        {isAdding && (
          <div className="p-6 border-b border-card-border bg-indigo-500/5 animate-in slide-in-from-top duration-300">
            <h3 className="text-sm font-black uppercase tracking-widest text-indigo-500 mb-4">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">Nombre Completo *</label>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground font-bold focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">RUT / Identificador *</label>
                <input type="text" value={rut} onChange={e=>setRut(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground font-bold focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">Teléfono Móvil *</label>
                <input type="text" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground font-bold focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">Dirección Comercial</label>
                <input type="text" value={address} onChange={e=>setAddress(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">Comuna</label>
                <input type="text" value={commune} onChange={e=>setCommune(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div className="flex gap-2 lg:col-span-1">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 block mb-1">Email de Contacto</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <button 
                  onClick={handleSave} 
                  className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Save size={20}/>
                </button>
                <button 
                  onClick={handleCancel} 
                  className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-3 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={20}/>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {loading ? (
            <div className="col-span-full flex flex-col items-center py-20 gap-4">
               <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
               <p className="text-slate-500 font-bold">Cargando base de datos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="bg-slate-100 dark:bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-500 font-bold">No se encontraron clientes.</p>
            </div>
          ) : (
            filtered.map(client => (
              <div key={client.id} className="glass-card p-6 rounded-[2rem] border border-card-border hover:border-primary/40 transition-all group relative overflow-hidden flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-xl group-hover:scale-110 transition-all duration-300 bg-indigo-600">
                        {client.name.charAt(0)}
                      </div>
                      {/* Status Indicator Dot (Pelotita) */}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 shadow-lg ${getStatusColor(client.status)}`}></div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-xl leading-none group-hover:text-primary transition-colors">{client.name}</h3>
                        {client.status === 'red' && (
                          <span className="bg-rose-100 text-rose-600 text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Vencido</span>
                        )}
                      </div>
                      <div className="text-[10px] font-black text-slate-500 flex items-center gap-1 uppercase tracking-widest mt-1">
                        <Hash size={12} className="text-primary"/> {client.rut}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleEdit(client)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                      title="Editar Cliente"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      title="Eliminar Cliente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mt-4 pt-4 border-t border-card-border flex-1">
                  <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Phone size={16}/>
                    </div>
                    {client.phone}
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Mail size={16}/>
                      </div>
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {(client.address || client.commune) && (
                    <div className="mt-4 p-4 bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-card-border/50">
                      {client.address && <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{client.address}</div>}
                      {client.commune && <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{client.commune}</div>}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Facturas</span>
                      <span className="font-black text-lg">{client.invoice_count}</span>
                    </div>
                    {client.pending_count > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Deuda Pendiente</span>
                        <span className="font-black text-lg text-rose-500">${client.total_debt.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={() => setSelectedClientHistory(client)}
                      className="flex-1 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary dark:hover:bg-primary dark:hover:text-white transition-all shadow-lg active:scale-95"
                    >
                      Historial
                    </button>
                    <a 
                      href={generateWhatsAppLink(
                        client.phone, 
                        client.name, 
                        client.status, 
                        client.total_debt,
                        (client.invoices || [])
                          .filter((inv: any) => inv.status !== 'Pagada')
                          .map((inv: any) => ({
                            folio: inv.folio,
                            balance: Number(inv.total_amount) - Number(inv.paid_amount || 0)
                          }))
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-3 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                        client.status === 'red' ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20' :
                        client.status === 'yellow' ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20' :
                        'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                      }`}
                      title="Enviar WhatsApp"
                    >
                      <MessageCircle size={20} />
                    </a>
                    <a 
                      href={`tel:${client.phone}`}
                      className="p-3 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
                      title="Llamar"
                    >
                      <Phone size={20} />
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Modal */}
      {selectedClientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-4xl rounded-[2.5rem] p-0 border-primary/20 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-card-border bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(selectedClientHistory.status)} animate-pulse`}></div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Historial de Cobranza</h3>
                </div>
                <h2 className="text-3xl font-black">{selectedClientHistory.name}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-sm font-bold text-slate-400">{selectedClientHistory.rut} • {selectedClientHistory.commune}</p>
                  <button 
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      showAllHistory 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-card-border'
                    }`}
                  >
                    {showAllHistory ? 'Ocultar Pagadas' : 'Ver Todas'}
                  </button>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedClientHistory(null);
                  setShowAllHistory(false);
                }}
                className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {selectedClientHistory.invoices?.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-bold italic">Este cliente no registra facturas en el sistema.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedClientHistory.invoices
                    .filter((inv: any) => showAllHistory || inv.status !== 'Pagada')
                    .sort((a: any, b: any) => new Date(b.issued_at || 0).getTime() - new Date(a.issued_at || 0).getTime())
                    .map((inv: any) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      const now = new Date();
                      const endOfWeek = new Date(now);
                      const dayOfWeek = now.getDay();
                      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                      endOfWeek.setDate(now.getDate() + daysUntilSunday);
                      endOfWeek.setHours(23, 59, 59, 999);

                      const dueDate = inv.payment_due_date ? new Date(inv.payment_due_date) : null;
                      const isOverdue = inv.status !== 'Pagada' && dueDate && dueDate < today;
                      const isDueThisWeek = !isOverdue && inv.status !== 'Pagada' && dueDate && dueDate >= today && dueDate <= endOfWeek;

                      return (
                        <div key={inv.id} className={`p-5 rounded-2xl border transition-all ${
                          inv.status === 'Pagada' ? 'bg-emerald-500/5 border-emerald-500/20' :
                          isOverdue ? 'bg-rose-500/5 border-rose-500/30 animate-pulse' :
                          isDueThisWeek ? 'bg-amber-500/5 border-amber-500/20' :
                          'bg-slate-100/50 dark:bg-slate-800/50 border-card-border'
                        }`}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <FileText size={18} className={
                                inv.status === 'Pagada' ? 'text-emerald-500' : 
                                isOverdue ? 'text-rose-500' : 
                                isDueThisWeek ? 'text-amber-500' :
                                'text-primary'
                              }/>
                              <span className="font-black text-lg">#{inv.folio}</span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              inv.status === 'Pagada' ? 'bg-emerald-500 text-white' :
                              isOverdue ? 'bg-rose-500 text-white' :
                              isDueThisWeek ? 'bg-amber-500 text-white' :
                              'bg-slate-500 text-white'
                            }`}>
                              {inv.status}
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                              <Calendar size={14}/>
                              Vence: {(() => {
                                if (inv.payment_due_date) return formatDate(inv.payment_due_date);
                                if (inv.issued_at) {
                                  const d = new Date(inv.issued_at);
                                  d.setDate(d.getDate() + 30);
                                  return `${formatDate(d)} (Est.)`;
                                }
                                return 'Sin fecha';
                              })()}
                            </div>
                            <div className="flex justify-between items-end mt-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase text-slate-400">Total</span>
                                <span className="text-xl font-black">${Number(inv.total_amount).toLocaleString()}</span>
                              </div>
                              {inv.status !== 'Pagada' && (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-black uppercase text-rose-500">Saldo</span>
                                  <span className="text-xl font-black text-rose-500">${(Number(inv.total_amount) - Number(inv.paid_amount || 0)).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Facturado</p>
                  <p className="text-2xl font-black">${selectedClientHistory.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.total_amount), 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Deuda Vigente</p>
                  <p className="text-2xl font-black text-rose-500">${selectedClientHistory.total_debt.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <a 
                  href={generateWhatsAppLink(
                    selectedClientHistory.phone, 
                    selectedClientHistory.name, 
                    selectedClientHistory.status, 
                    selectedClientHistory.total_debt,
                    (selectedClientHistory.invoices || [])
                      .filter((inv: any) => inv.status !== 'Pagada')
                      .map((inv: any) => ({
                        folio: inv.folio,
                        balance: Number(inv.total_amount) - Number(inv.paid_amount || 0)
                      }))
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                    selectedClientHistory.status === 'red' ? 'bg-rose-500 text-white hover:bg-rose-600' :
                    selectedClientHistory.status === 'yellow' ? 'bg-amber-500 text-white hover:bg-amber-600' :
                    'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <MessageCircle size={20} /> Enviar Cobranza
                </a>
                <button 
                  onClick={() => setSelectedClientHistory(null)}
                  className="px-8 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-primary dark:hover:bg-primary dark:hover:text-white transition-all shadow-lg"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

