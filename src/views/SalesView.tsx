import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Client } from '@/types';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  UserPlus, 
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Package,
  X,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Hash,
  Clock,
  ChevronRight,
  Sparkles,
  Zap
} from 'lucide-react';
import { formatDate, formatRUT, validateRUT, formatCurrency } from '@/lib/formatters';

interface CartItem extends Product {
  cartQuantity: number;
}

export default function SalesView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceFolio, setInvoiceFolio] = useState<string>('');
  const [folioWarning, setFolioWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Client State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentDays, setPaymentDays] = useState<number>(0);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', rut: '', address: '', commune: '' });
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchNextFolio();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase.from('nf_clients').select('*').order('name');
    if (error) {
      toast.error('Error al cargar clientes');
    } else {
      setClients(data || []);
      const defaultClient = data?.find(c => c.name === 'Público General');
      if (defaultClient) {
        setSelectedClientId(defaultClient.id);
        setClientSearchTerm(defaultClient.name);
      }
    }
  };

  useEffect(() => {
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      setPaymentDays(client.name === 'Público General' ? 0 : 30);
    }
  }, [selectedClientId, clients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (invoiceFolio) checkFolio(invoiceFolio);
    }, 500);
    return () => clearTimeout(timer);
  }, [invoiceFolio]);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('nf_products').select('*').order('name');
    if (error) {
      toast.error('Error al cargar productos');
    } else {
      setProducts(data || []);
    }
  };

  const fetchNextFolio = async () => {
    const { data } = await supabase.from('nf_settings').select('value').eq('key', 'next_invoice_number').maybeSingle();
    if (data?.value) setInvoiceFolio(data.value);
  };

  const checkFolio = async (folio: string) => {
    setFolioWarning(null);
    const { data } = await supabase.from('nf_invoices').select('id').eq('folio', parseInt(folio, 10)).maybeSingle();
    if (data) setFolioWarning(`Folio #${folio} duplicado.`);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
    toast.success(`${product.name} +1`, { 
      duration: 1000,
      position: 'bottom-center',
      style: { background: '#020617', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.cartQuantity + delta;
        return newQ > 0 ? { ...item, cartQuantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const netSubtotal = cart.reduce((acc, item) => acc + (item.net_price * item.cartQuantity), 0);
  const iva = Math.round(netSubtotal * 0.19);
  const totalWithTax = netSubtotal + iva;

  const getDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + paymentDays);
    return d;
  };

  const handleSale = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío');
    if (!invoiceFolio) return toast.error('Ingrese folio');
    if (folioWarning) return toast.error('Folio inválido');

    setIsProcessing(true);
    const folioNum = parseInt(invoiceFolio, 10);

    try {
      const { data: saleData, error: saleErr } = await supabase
        .from('nf_sales')
        .insert({ 
          subtotal_net: netSubtotal, 
          total_tax: iva, 
          total_with_tax: totalWithTax,
          client_id: selectedClientId || null
        })
        .select('id').single();
      if (saleErr) throw saleErr;

      const dueDate = getDueDate();
      dueDate.setHours(0, 0, 0, 0);

      const { error: invErr } = await supabase
        .from('nf_invoices')
        .insert({ 
          folio: folioNum, 
          sale_id: saleData.id, 
          total_amount: totalWithTax,
          paid_amount: 0,
          status: 'Pendiente',
          client_id: selectedClientId || null,
          payment_due_date: dueDate.toISOString(),
          issued_at: new Date().toISOString()
        });
      if (invErr) throw invErr;

      for (const item of cart) {
        await supabase.from('nf_sale_items').insert({
          sale_id: saleData.id,
          product_id: item.id,
          quantity: item.cartQuantity,
          unit_price_net: item.net_price,
          subtotal_net: item.net_price * item.cartQuantity
        });
        
        await supabase.from('nf_products')
          .update({ stock: item.stock - item.cartQuantity })
          .eq('id', item.id);
      }

      await supabase.from('nf_settings').update({ value: (folioNum + 1).toString() }).eq('key', 'next_invoice_number');

      toast.success('Venta finalizada');
      setCart([]);
      setShowCart(false);
      fetchProducts();
      fetchNextFolio();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name) return toast.error('Nombre obligatorio');
    const { data, error } = await supabase.from('nf_clients').insert(newClient).select().single();
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Cliente creado');
      setClients(prev => [...prev, data]);
      setSelectedClientId(data.id);
      setClientSearchTerm(data.name);
      setIsNewClientModalOpen(false);
      setNewClient({ name: '', rut: '', address: '', commune: '' });
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
    (c.rut && c.rut.toLowerCase().includes(clientSearchTerm.toLowerCase()))
  );

  const frequentClients = clients.slice(0, 3); // Predictive mockup

  const filteredProd = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );
    return (
    <div className="flex flex-col gap-10 lg:h-[calc(100vh-180px)] font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-white/10">
                <ShoppingCart size={20} className="text-black" fill="currentColor" />
             </div>
             <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em]">Terminal de Ventas</p>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-white uppercase leading-none">Punto <span className="text-slate-800">Operativo</span></h2>
        </div>
        
        <div className="hidden lg:flex items-center gap-8 pr-4">
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Cajero Activo</p>
              <p className="text-sm font-black text-white uppercase tracking-tighter">{user?.email?.split('@')[0]}</p>
           </div>
           <div className="w-px h-10 bg-white/5" />
           <div className="text-right">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Estado</p>
              <p className="text-sm font-black text-emerald-500 uppercase tracking-tighter">En Línea</p>
           </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 relative overflow-hidden">
        {/* Mobile Cart Button */}
      <button 
        onClick={() => setShowCart(true)}
        className="lg:hidden fixed bottom-8 right-8 w-20 h-20 bg-white text-black rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] flex items-center justify-center z-[80] active:scale-90 transition-all tap-highlight-none"
      >
        <div className="relative">
          <ShoppingCart size={28} />
          {cart.length > 0 && (
            <span className="absolute -top-4 -right-4 bg-cyan-500 text-white text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-xl border-4 border-[#020617]">
              {cart.reduce((a, b) => a + b.cartQuantity, 0)}
            </span>
          )}
        </div>
      </button>

      {/* Main Catalog Section */}
      <div className="flex-1 flex flex-col gap-8 overflow-hidden">
        <div className="glass-card p-6 rounded-[2rem] flex items-center gap-5 group focus-within:border-cyan-500/20 transition-all duration-700">
          <Search size={22} className="text-slate-700 group-focus-within:text-cyan-400 transition-colors" />
          <input 
            type="text" 
            placeholder="ESCANEANDO PRODUCTOS..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-white font-black placeholder:text-slate-800 uppercase text-xs tracking-[0.2em]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="p-2 hover:text-white text-slate-700 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-32 lg:pb-0">
          {filteredProd.map(product => (
            <div 
              key={product.id}
              onClick={() => addToCart(product)}
              className="glass-card p-8 rounded-[3rem] group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.02] border-white/5 hover:border-cyan-500/20 flex flex-col items-center text-center gap-6 relative overflow-hidden"
            >
              <div className="absolute top-6 right-6">
                 {product.stock <= 0 ? (
                   <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
                 ) : (
                   <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                 )}
              </div>

              <div className="w-24 h-24 rounded-[2rem] bg-white/[0.01] border border-white/5 flex items-center justify-center text-4xl font-black text-slate-800 group-hover:text-cyan-400 group-hover:bg-cyan-500/5 group-hover:border-cyan-500/20 transition-all duration-1000">
                {product.name.charAt(0)}
              </div>
              
              <div className="space-y-2 px-2">
                <h4 className="text-sm font-black text-white line-clamp-2 uppercase tracking-tight leading-snug group-hover:text-cyan-400 transition-colors">{product.name}</h4>
                <div className="flex flex-col items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{product.sku || 'SIN SKU'}</span>
                  <span className={`text-[9px] font-black uppercase ${product.stock <= 0 ? 'text-amber-500/70' : 'text-slate-600'}`}>
                    {product.stock <= 0 ? 'Agotado' : `${product.stock} DISPONIBLES`}
                  </span>
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-white/5 w-full">
                <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(product.net_price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout Section */}
      <div className={`
        ${showCart ? 'fixed inset-0 z-[100] lg:relative lg:inset-auto' : 'hidden lg:flex'}
        w-full lg:w-[460px] flex flex-col bg-[#020617] lg:bg-transparent transition-all duration-700
      `}>
        {/* Mobile Header */}
        <div className="lg:hidden h-28 flex items-center justify-between px-10 border-b border-white/5 bg-white/[0.01] backdrop-blur-3xl">
          <div className="space-y-1">
            <h3 className="text-3xl font-black tracking-tighter text-white uppercase">Operación</h3>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Checkpoint de Venta</p>
          </div>
          <button onClick={() => setShowCart(false)} className="w-14 h-14 flex items-center justify-center bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 flex flex-col glass-card lg:rounded-[4rem] overflow-hidden m-6 lg:m-0 border-white/5 shadow-2xl relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -mr-32 -mt-32" />
          
          <div className="p-10 border-b border-white/5 space-y-6 relative z-10" ref={clientSearchRef}>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Destinatario</span>
              <button onClick={() => setIsNewClientModalOpen(true)} className="text-cyan-500 text-[10px] font-black uppercase flex items-center gap-2 hover:text-cyan-400 transition-all">
                <UserPlus size={16} /> Alta Rápida
              </button>
            </div>
            
            <div className="relative">
              <div 
                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                className="w-full bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex items-center justify-between cursor-pointer group hover:bg-white/[0.04] transition-all duration-500"
              >
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-cyan-400 transition-colors">
                    <UserIcon size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white uppercase tracking-wider truncate max-w-[200px]">
                      {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'Seleccionar Cliente'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase">
                      {selectedClientId ? clients.find(c => c.id === selectedClientId)?.rut : 'Búsqueda Inteligente'}
                    </span>
                  </div>
                </div>
                <ChevronDown size={20} className={`text-slate-800 transition-transform duration-700 ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isClientDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-4 z-[110] glass-card rounded-[3rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.9)] border-white/10 animate-in fade-in zoom-in-95 duration-500 backdrop-blur-3xl">
                   <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 group focus-within:border-cyan-500/30 transition-all">
                        <Search size={16} className="text-slate-700 group-focus-within:text-cyan-500" />
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="NOMBRE O RUT..."
                          value={clientSearchTerm}
                          onChange={e => setClientSearchTerm(e.target.value)}
                          className="w-full bg-transparent text-[10px] font-black text-white outline-none uppercase placeholder:text-slate-800 tracking-widest"
                        />
                      </div>
                   </div>
                   <div className="max-h-[300px] overflow-y-auto no-scrollbar py-4">
                     {!clientSearchTerm && (
                        <div className="px-8 mb-4">
                           <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                             <Sparkles size={12} className="text-cyan-500" /> Sugeridos
                           </span>
                        </div>
                     )}
                     {filteredClients.length === 0 ? (
                       <div className="py-12 text-center space-y-3 opacity-20">
                          <AlertCircle size={32} className="mx-auto" />
                          <p className="text-[10px] font-black uppercase tracking-widest">Sin Resultados</p>
                       </div>
                     ) : filteredClients.map(client => (
                       <div 
                         key={client.id}
                         onClick={() => {
                           setSelectedClientId(client.id);
                           setClientSearchTerm(client.name);
                           setIsClientDropdownOpen(false);
                         }}
                         className="px-8 py-5 hover:bg-white/[0.03] cursor-pointer flex items-center justify-between group transition-all"
                       >
                         <div className="flex flex-col gap-1">
                           <span className="text-[11px] font-black text-white uppercase group-hover:text-cyan-400 transition-colors tracking-tight">{client.name}</span>
                           <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">{client.rut || 'CONSUMIDOR FINAL'}</span>
                         </div>
                         {selectedClientId === client.id && <div className="w-2.5 h-2.5 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,1)]" />}
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-6 no-scrollbar relative z-10">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-10 text-center space-y-8">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                  <ShoppingCart size={48} strokeWidth={1} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.5em]">Carrito Vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex flex-col gap-5 p-6 bg-white/[0.01] rounded-[2.5rem] border border-white/5 group hover:border-white/10 transition-all duration-500">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1 pr-6">
                      <h5 className="text-[11px] font-black text-white uppercase tracking-tight leading-relaxed group-hover:text-cyan-400 transition-colors">{item.name}</h5>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{formatCurrency(item.net_price)} / UNIT</p>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/0 hover:bg-rose-500/10 text-slate-800 hover:text-rose-500 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2 bg-black/40 rounded-2xl p-1.5 border border-white/5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-white transition-colors bg-white/0 hover:bg-white/5 rounded-xl"><Minus size={16} /></button>
                      <span className="text-xs font-black w-10 text-center text-white">{item.cartQuantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-white transition-colors bg-white/0 hover:bg-white/5 rounded-xl"><Plus size={16} /></button>
                    </div>
                    <p className="text-lg font-black text-white tracking-tighter">{formatCurrency(item.net_price * item.cartQuantity)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-10 bg-white/[0.01] border-t border-white/5 space-y-10 relative z-10">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2">Folio Int.</span>
                <input 
                  type="number"
                  value={invoiceFolio}
                  onChange={e => setInvoiceFolio(e.target.value)}
                  className={`w-full bg-white/[0.02] border p-5 rounded-2xl text-xs font-black outline-none transition-all ${folioWarning ? 'border-rose-500/50 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'border-white/5 text-white focus:border-cyan-500/30'}`}
                />
              </div>
              <div className="space-y-3">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] ml-2">Términos</span>
                <div className="relative">
                  <input 
                    type="number"
                    value={paymentDays}
                    onChange={e => setPaymentDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white/[0.02] border border-white/5 p-5 rounded-2xl text-xs font-black text-white outline-none focus:border-cyan-500/30 transition-all pr-12"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-700 uppercase">Días</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-600 tracking-[0.3em]">
                <span>Neto</span>
                <span className="text-white">{formatCurrency(netSubtotal)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-600 tracking-[0.3em]">
                <span>I.V.A (19%)</span>
                <span className="text-white">{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between items-center pt-8 border-t border-white/10">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em]">Bruto</span>
                <div className="flex items-baseline gap-1">
                   <span className="text-[10px] font-black text-cyan-500 mr-2 uppercase">Total</span>
                   <span className="text-4xl font-black text-white tracking-tighter">{formatCurrency(totalWithTax)}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSale}
              disabled={isProcessing || cart.length === 0 || !!folioWarning}
              className="w-full h-24 bg-white text-black hover:bg-cyan-400 disabled:bg-slate-900/50 disabled:text-slate-700 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] active:scale-95 transition-all flex items-center justify-center gap-4 group/confirm shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <span>Procesar Venta</span>
                  <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center group-hover/confirm:translate-x-2 transition-transform">
                    <ChevronRight size={20} />
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* New Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
          <div className="glass-card w-full max-w-lg p-12 rounded-[4rem] space-y-12 relative overflow-hidden border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)]">
            <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/5 blur-[100px] -ml-32 -mt-32" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.5em]">Nexus Directory</p>
                <h3 className="text-4xl font-black tracking-tight text-white uppercase">Nuevo Cliente</h3>
              </div>
              <button onClick={() => setIsNewClientModalOpen(false)} className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all">
                <X size={32} />
              </button>
            </div>
            
            <div className="space-y-8 relative z-10">
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Nombre Comercial / Razón Social</label>
                 <input 
                   autoFocus
                   value={newClient.name}
                   onChange={e => setNewClient({...newClient, name: e.target.value})}
                   className="w-full bg-white/[0.02] border border-white/5 p-7 rounded-3xl text-sm font-black text-white outline-none focus:border-cyan-500/30 transition-all uppercase placeholder:text-slate-900"
                   placeholder="NOMBRE COMPLETO"
                 />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">R.U.T / Identificación</label>
                   <input 
                     value={newClient.rut}
                     onChange={e => setNewClient({...newClient, rut: formatRUT(e.target.value)})}
                     className="w-full bg-white/[0.02] border border-white/5 p-7 rounded-3xl text-sm font-black text-white outline-none focus:border-cyan-500/30 transition-all placeholder:text-slate-900"
                     placeholder="XX.XXX.XXX-X"
                   />
                 </div>
                 <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Ubicación (Comuna)</label>
                   <input 
                     value={newClient.commune}
                     onChange={e => setNewClient({...newClient, commune: e.target.value})}
                     className="w-full bg-white/[0.02] border border-white/5 p-7 rounded-3xl text-sm font-black text-white outline-none focus:border-cyan-500/30 transition-all uppercase placeholder:text-slate-900"
                     placeholder="SANTIAGO, CL"
                   />
                 </div>
               </div>
            </div>

            <button 
              onClick={handleCreateClient}
              className="w-full h-24 bg-white text-black rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.4em] active:scale-95 transition-all flex items-center justify-center gap-3 relative z-10 hover:bg-cyan-400 shadow-2xl"
            >
              Confirmar Registro Maestro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
