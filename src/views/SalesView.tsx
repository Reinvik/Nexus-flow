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
  Zap,
  DollarSign,
  ShieldCheck,
  Save
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

  const filteredProd = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] lg:h-[calc(100vh-140px)] font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700 pb-4">
      {/* Header Section - More Compact */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <ShoppingCart size={18} className="text-white" fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase leading-none">POS <span className="text-slate-500 dark:text-slate-400">Ultra</span></h2>
            <p className="text-[8px] font-black text-primary uppercase tracking-[0.4em]">Terminal de Ventas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 px-4 py-2 rounded-2xl backdrop-blur-3xl">
          <div className="text-right pr-4 border-r border-slate-200 dark:border-white/10 hidden sm:block">
            <p className="text-[8px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.2em]">Cajero</p>
            <p className="text-[10px] font-black text-foreground uppercase tracking-tighter">{user?.email?.split('@')[0]}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">En Línea</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden px-4">
        {/* Main Catalog Section - scrollable top on mobile */}
        <div className="flex-[3] flex flex-col gap-4 overflow-hidden h-1/2 lg:h-full">
          <div className="glass-card p-3 rounded-2xl flex items-center gap-4 group focus-within:ring-1 ring-primary/30 transition-all duration-500 border-slate-200 dark:border-white/5">
            <Search size={18} className="text-slate-400 dark:text-slate-700 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="ESCANEANDO PRODUCTOS..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-foreground font-black placeholder:text-slate-300 dark:placeholder:text-slate-800 uppercase text-[10px] tracking-widest"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="p-1 hover:text-primary text-slate-400 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 p-1">
            {filteredProd.map(product => (
              <div 
                key={product.id}
                onClick={() => addToCart(product)}
                className="glass-card p-3 rounded-2xl group cursor-pointer active:scale-95 transition-all hover:bg-slate-100/50 dark:hover:bg-white/[0.01] border-slate-200 dark:border-white/5 hover:border-primary/30 flex items-center gap-4 relative overflow-hidden h-[72px]"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${product.stock <= 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <h4 className="text-[10px] font-black text-foreground truncate uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{product.name}</h4>
                  </div>
                  <div className="flex items-center gap-3 opacity-60 ml-3">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{product.sku || 'N/A'}</span>
                    <span className={`text-[8px] font-black uppercase ${product.stock <= 5 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {product.stock} DISP
                    </span>
                  </div>
                </div>

                <div className="text-right pl-4 border-l border-slate-200 dark:border-white/5">
                  <p className="text-sm font-black text-foreground tracking-tighter">{formatCurrency(product.net_price)}</p>
                  <p className="text-[7px] font-black text-primary uppercase tracking-widest opacity-40">Neto</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart & Checkout Section - Always visible bottom/side */}
        <div className="flex-[2] min-w-0 lg:max-w-[420px] flex flex-col glass-card rounded-[2.5rem] overflow-hidden border-slate-200 dark:border-white/5 shadow-2xl relative h-1/2 lg:h-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
          
          {/* Compact Client/Folio Header */}
          <div className="p-4 border-b border-slate-200 dark:border-white/5 space-y-3 relative z-10 bg-slate-100/50 dark:bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Cliente & Folio</span>
              <button onClick={() => setIsNewClientModalOpen(true)} className="text-primary text-[8px] font-black uppercase flex items-center gap-1.5 hover:opacity-80 transition-all">
                <UserPlus size={14} /> Nuevo
              </button>
            </div>
            
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8 relative">
                <div 
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-2 rounded-xl flex items-center justify-between cursor-pointer group hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <UserIcon size={14} className="text-slate-400 dark:text-slate-600 group-hover:text-primary" />
                    <span className="text-[9px] font-black text-foreground uppercase tracking-tight truncate">
                      {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'C. Final'}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isClientDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-[110] glass-card rounded-2xl overflow-hidden shadow-2xl border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-300 backdrop-blur-3xl">
                    <div className="p-3 bg-slate-100/50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5">
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="BUSCAR..."
                        value={clientSearchTerm}
                        onChange={e => setClientSearchTerm(e.target.value)}
                        className="w-full bg-transparent text-[9px] font-black text-foreground outline-none uppercase placeholder:text-slate-400 dark:placeholder:text-slate-700"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto no-scrollbar py-2">
                      {filteredClients.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setClientSearchTerm(client.name);
                            setIsClientDropdownOpen(false);
                          }}
                          className="px-4 py-2 hover:bg-primary/5 cursor-pointer flex items-center justify-between group"
                        >
                          <span className="text-[9px] font-black text-foreground group-hover:text-primary truncate">{client.name}</span>
                          {selectedClientId === client.id && <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(0,123,255,0.5)]" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-4">
                <input 
                  type="number"
                  value={invoiceFolio}
                  onChange={e => setInvoiceFolio(e.target.value)}
                  placeholder="FOLIO"
                  className={`w-full h-full bg-slate-200/50 dark:bg-white/[0.02] border p-2 rounded-xl text-[9px] font-black outline-none transition-all text-center ${folioWarning ? 'border-rose-500/50 text-rose-500' : 'border-slate-200 dark:border-white/5 text-foreground focus:border-primary/30'}`}
                />
              </div>
            </div>
          </div>

          {/* Persistent Cart Items List - Ultra Compact */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 no-scrollbar relative z-10">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full opacity-10 text-center gap-4">
                <ShoppingCart size={32} strokeWidth={1} />
                <p className="text-[8px] font-black uppercase tracking-widest">Carrito Vacío</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-2 bg-slate-100/50 dark:bg-white/[0.01] rounded-xl border border-slate-200 dark:border-white/5 group hover:border-primary/20 transition-all">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-[9px] font-black text-foreground uppercase tracking-tight truncate">{item.name}</h5>
                    <p className="text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{formatCurrency(item.net_price)}/u</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-200 dark:bg-black/40 rounded-lg p-0.5 border border-slate-300 dark:border-white/5">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-primary transition-colors"><Minus size={10} /></button>
                      <span className="text-[9px] font-black w-4 text-center text-foreground">{item.cartQuantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-primary transition-colors"><Plus size={10} /></button>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <p className="text-[10px] font-black text-foreground tracking-tighter">{formatCurrency(item.net_price * item.cartQuantity)}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 dark:text-slate-800 hover:text-rose-500 transition-colors p-1">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Footer Summary - Optimized for Quick Checkout */}
          <div className="p-4 bg-slate-100 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/5 space-y-4 relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Total a Recaudar</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-foreground tracking-tighter leading-none">{formatCurrency(totalWithTax)}</span>
                  <span className="text-[8px] font-black text-primary uppercase">CLP</span>
                </div>
              </div>
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-4 text-[8px] font-black uppercase text-slate-400 dark:text-slate-600 tracking-widest">
                  <span>Neto: {formatCurrency(netSubtotal)}</span>
                  <span>IVA: {formatCurrency(iva)}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSale}
              disabled={isProcessing || cart.length === 0 || !!folioWarning}
              className="w-full h-14 bg-primary text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-30 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20 group/btn"
            >
              {isProcessing ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} className="group-hover/btn:scale-110 transition-transform" />
                  <span>Procesar Transacción</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* New Client Modal - Standardized with other views */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-background/80 dark:bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="glass-card w-full max-w-lg p-10 rounded-[3rem] space-y-8 relative border-slate-200 dark:border-white/10 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">Administrative</p>
                <h3 className="text-3xl font-black tracking-tight text-foreground uppercase">Nuevo Cliente</h3>
              </div>
              <button onClick={() => setIsNewClientModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-foreground transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Nombre Comercial</label>
                <input 
                  autoFocus
                  value={newClient.name}
                  onChange={e => setNewClient({...newClient, name: e.target.value})}
                  className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-5 rounded-2xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all uppercase placeholder:text-slate-400 dark:placeholder:text-slate-800"
                  placeholder="NOMBRE COMPLETO"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">R.U.T</label>
                  <input 
                    value={newClient.rut}
                    onChange={e => setNewClient({...newClient, rut: formatRUT(e.target.value)})}
                    className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-5 rounded-2xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-800"
                    placeholder="XX.XXX.XXX-X"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest ml-1">Comuna</label>
                  <input 
                    value={newClient.commune}
                    onChange={e => setNewClient({...newClient, commune: e.target.value})}
                    className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-5 rounded-2xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all uppercase placeholder:text-slate-400 dark:placeholder:text-slate-800"
                    placeholder="CIUDAD"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleCreateClient}
              className="w-full h-20 bg-primary text-white dark:bg-white dark:text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20"
            >
              <Save size={18} /> Confirmar Registro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
