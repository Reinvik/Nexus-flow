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
  Save,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
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
  const [newClient, setNewClient] = useState({ 
    name: '', 
    rut: '', 
    address: '', 
    commune: '', 
    phone: '', 
    email: '',
    latitude: -33.4489, // Default to Santiago
    longitude: -70.6693
  });
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Map Component
  function LocationMarker() {
    useMapEvents({
      click(e) {
        setNewClient(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng }));
      },
    });
    return (
      <Marker position={[newClient.latitude, newClient.longitude]} />
    );
  }

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
        return newQ >= 0 ? { ...item, cartQuantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const activeCart = cart.filter(item => item.cartQuantity > 0);
  const netSubtotal = activeCart.reduce((acc, item) => acc + (item.net_price * item.cartQuantity), 0);
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

      for (const item of activeCart) {
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
      setNewClient({ 
        name: '', 
        rut: '', 
        address: '', 
        commune: '', 
        phone: '', 
        email: '',
        latitude: -33.4489,
        longitude: -70.6693
      });
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
    <div className="flex flex-col h-full font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden bg-background">
      
      {/* Product Catalog - Theme Aware */}
      <div className="flex-1 flex flex-col min-w-0 bg-background rounded-t-[2.5rem] border-x border-t border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
          {filteredProd.map(product => {
            const cartItem = cart.find(item => item.id === product.id);
            return (
              <div 
                key={product.id}
                className={`glass-card p-4 rounded-[2rem] group transition-all border-slate-200 dark:border-white/5 flex items-center gap-4 relative overflow-hidden h-28 ${cartItem ? 'bg-primary/[0.03] border-primary/20 shadow-lg shadow-primary/5' : 'bg-white dark:bg-white/[0.02]'}`}
              >
                <div className="flex-1 min-w-0 space-y-2 cursor-pointer" onClick={() => addToCart(product)}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${product.stock <= 0 ? 'bg-rose-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                    <h4 className="text-[13px] font-black truncate uppercase tracking-tight group-hover:text-primary transition-colors leading-none" style={{ color: '#000000' }}>{product.name}</h4>
                  </div>
                  <div className="flex flex-col gap-1 ml-4">
                    <span className="text-[9px] font-bold text-slate-950 dark:text-slate-500 uppercase tracking-widest">{product.sku || 'REF-N/A'}</span>
                    <span className={`text-[9px] font-black uppercase flex items-center gap-1.5 ${product.stock <= 5 ? 'text-amber-500' : 'text-slate-950 dark:text-slate-500'}`}>
                      <Package size={10} /> {product.stock} DISP
                    </span>
                  </div>
                </div>

                <div className="text-right flex flex-col justify-between items-end h-full py-1 pr-1 min-w-[140px]">
                  {/* Price Control - Theme Aware */}
                  <div className="relative group/price">
                    <div className="flex items-center gap-1 bg-white dark:bg-white/[0.03] px-3 py-1.5 rounded-xl border border-slate-400 dark:border-white/5 group-hover/price:border-primary transition-all shadow-sm">
                      <span className="text-[11px] font-black" style={{ color: '#000000' }}>$</span>
                      <input 
                        type="number"
                        defaultValue={product.net_price}
                        onBlur={(e) => {
                          const newPrice = parseFloat(e.target.value);
                          if (!isNaN(newPrice)) {
                            setCart(prev => prev.map(item => item.id === product.id ? { ...item, net_price: newPrice } : item));
                          }
                        }}
                        className="w-20 bg-transparent text-sm font-black outline-none text-right"
                        style={{ color: '#000000' }}
                      />
                      <span className="text-[9px] font-black uppercase tracking-tighter ml-1" style={{ color: '#000000' }}>Neto</span>
                    </div>
                  </div>

                  {/* Quantity Controls - Theme Aware */}
                  {cartItem ? (
                    <div className="flex items-center gap-1 bg-primary/10 dark:bg-primary/20 p-1 rounded-2xl animate-in zoom-in-95 duration-300 border border-primary/20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/20 dark:bg-primary/30 text-primary hover:bg-primary/30 transition-all shadow-sm active:scale-90"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>
                      <div className="px-3 min-w-[40px] text-center">
                        <span className="text-xs font-black text-primary uppercase tracking-tighter">
                          {cartItem.cartQuantity > 0 ? `x${cartItem.cartQuantity}` : '-'}
                        </span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary text-white hover:brightness-110 transition-all shadow-sm active:scale-90"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => addToCart(product)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-200 dark:bg-white/5 text-black dark:text-slate-400 hover:bg-primary hover:text-white transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-sm border border-slate-300 dark:border-white/5"
                    >
                      <Plus size={14} /> Seleccionar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Checkout Summary - Theme Aware */}
      <div className="shrink-0 z-[100] bg-slate-950 backdrop-blur-xl border-t border-white/10 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col divide-y divide-slate-50 dark:divide-white/5">
          {/* Section: Client & Folio (UP) */}
          <div className="px-6 py-3 bg-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-[#00BCD4] animate-pulse" />
                <span className="text-[9px] font-black text-white uppercase tracking-[0.3em]">Módulo de Facturación</span>
              </div>
              <button 
                onClick={() => setIsNewClientModalOpen(true)} 
                className="text-[#00BCD4] text-[9px] font-black uppercase flex items-center gap-2 hover:opacity-70 transition-all"
              >
                <UserPlus size={14} /> Nuevo Cliente
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative" ref={clientSearchRef}>
                <div 
                  onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                  className="w-full bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 p-3 rounded-2xl flex items-center justify-between cursor-pointer group hover:border-primary transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3 truncate">
                    <UserIcon size={16} className="text-[#00BCD4] group-hover:text-primary" />
                    <span className="text-[10px] font-black text-white uppercase tracking-tight truncate">
                      {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'Seleccionar Cliente'}
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isClientDropdownOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-4 z-[200] glass-card rounded-3xl overflow-hidden shadow-2xl border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-4 duration-300 backdrop-blur-3xl bg-white/95 dark:bg-black/95">
                    <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="FILTRO INTELIGENTE (NOMBRE O R.U.T)..."
                          value={clientSearchTerm}
                          onChange={e => setClientSearchTerm(e.target.value)}
                          className="w-full bg-white dark:bg-black/20 text-[10px] font-black text-foreground outline-none uppercase placeholder:text-slate-400 dark:placeholder:text-slate-700 pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-white/5"
                        />
                      </div>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto no-scrollbar py-2">
                      {filteredClients.length > 0 ? (
                        filteredClients.map(client => (
                          <div 
                            key={client.id}
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setClientSearchTerm(client.name);
                              setIsClientDropdownOpen(false);
                            }}
                            className="px-6 py-3.5 hover:bg-primary/5 cursor-pointer flex items-center justify-between group border-b border-slate-50 dark:border-white/[0.01] last:border-0 transition-all"
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-foreground group-hover:text-primary uppercase truncate">{client.name}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{client.rut || 'Público'}</span>
                            </div>
                            {selectedClientId === client.id && <CheckCircle2 size={16} className="text-primary" />}
                          </div>
                        ))
                      ) : (
                        <div className="p-10 text-center">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sin coincidencias</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-full sm:w-36 relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="number"
                  value={invoiceFolio}
                  onChange={e => setInvoiceFolio(e.target.value)}
                  placeholder="FOLIO"
                  className={`w-full bg-white/5 border p-3 pl-9 rounded-2xl text-[10px] font-black outline-none transition-all shadow-sm ${folioWarning ? 'border-rose-500/50 text-rose-500' : 'border-white/10 text-white focus:border-[#00BCD4]/50'}`}
                />
              </div>
            </div>
          </div>

          {/* Section: Totals & Processing (DOWN) */}
          <div className="px-8 py-5 flex flex-col lg:flex-row items-center justify-between gap-6 bg-transparent">
            <div className="flex flex-col sm:flex-row items-center gap-10 w-full lg:w-auto">
              <div className="flex flex-col w-full sm:w-auto">
                <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none mb-2">Total a Recaudar</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white tracking-tighter leading-none">{formatCurrency(totalWithTax)}</span>
                  <span className="text-[12px] font-black text-[#00BCD4] uppercase">CLP</span>
                </div>
              </div>
              
              <div className="flex items-center gap-8 border-l border-slate-200 dark:border-white/10 pl-8 w-full sm:w-auto">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5">Neto</span>
                  <p className="text-sm font-black text-white">{formatCurrency(netSubtotal)}</p>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5">IVA (19%)</span>
                  <p className="text-sm font-black text-[#00BCD4]">{formatCurrency(iva)}</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSale}
              disabled={isProcessing || activeCart.length === 0 || !!folioWarning}
              className="w-full lg:w-80 h-16 bg-primary text-white hover:brightness-110 disabled:opacity-30 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-xl shadow-primary/20 group/btn border border-white/20"
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={24} className="group-hover/btn:scale-110 transition-transform" />
                  <span>Finalizar Venta</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* New Client Modal - Enhanced with Phone, Address and Map */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-background/80 dark:bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500 overflow-y-auto">
          <div className="glass-card w-full max-w-4xl p-6 sm:p-10 rounded-[2.5rem] relative border-slate-200 dark:border-white/10 shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">Administrative</p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase">Registro de Cliente</h3>
              </div>
              <button onClick={() => setIsNewClientModalOpen(false)} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-white/5 text-slate-500 hover:text-foreground transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left Column: Form Fields */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <UserIcon size={12} /> Nombre Completo / Razón Social
                  </label>
                  <input 
                    autoFocus
                    value={newClient.name}
                    onChange={e => setNewClient({...newClient, name: e.target.value})}
                    className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all uppercase"
                    placeholder="EJ: JUAN PEREZ / TRANSPORTES NEXUS"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1">R.U.T</label>
                    <input 
                      value={newClient.rut}
                      onChange={e => setNewClient({...newClient, rut: formatRUT(e.target.value)})}
                      className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all"
                      placeholder="12.345.678-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Phone size={12} /> Teléfono
                    </label>
                    <input 
                      value={newClient.phone}
                      onChange={e => setNewClient({...newClient, phone: e.target.value})}
                      className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all"
                      placeholder="+56 9 XXXX XXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Mail size={12} /> Email
                  </label>
                  <input 
                    type="email"
                    value={newClient.email}
                    onChange={e => setNewClient({...newClient, email: e.target.value})}
                    className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all"
                    placeholder="CLIENTE@EMAIL.COM"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <MapPin size={12} /> Dirección
                    </label>
                    <input 
                      value={newClient.address}
                      onChange={e => setNewClient({...newClient, address: e.target.value})}
                      className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all uppercase"
                      placeholder="AV. SIEMPRE VIVA 123"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1">Comuna</label>
                    <input 
                      value={newClient.commune}
                      onChange={e => setNewClient({...newClient, commune: e.target.value})}
                      className="w-full bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 p-4 rounded-xl text-xs font-black text-foreground outline-none focus:border-primary/30 transition-all uppercase"
                      placeholder="COMUNA"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCreateClient}
                  className="w-full h-16 bg-primary text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20 mt-4"
                >
                  <Save size={18} /> Confirmar Registro
                </button>
              </div>

              {/* Right Column: Map Selection */}
              <div className="flex flex-col space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-800 dark:text-slate-600 uppercase tracking-widest ml-1">Ubicación Geográfica (Clic en el mapa)</label>
                  <p className="text-[8px] font-bold text-slate-600 uppercase italic">Se guardará junto con la dirección ingresada</p>
                </div>
                <div className="flex-1 min-h-[300px] lg:min-h-0 rounded-[2rem] overflow-hidden border border-slate-200 dark:border-white/10 shadow-inner bg-slate-100 dark:bg-black/40">
                  <MapContainer 
                    center={[newClient.latitude, newClient.longitude]} 
                    zoom={13} 
                    scrollWheelZoom={true}
                    className="w-full h-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker />
                  </MapContainer>
                </div>
                <div className="flex items-center gap-4 px-4 py-2 bg-slate-100/50 dark:bg-white/[0.02] rounded-xl border border-slate-200 dark:border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">LAT</span>
                    <span className="text-[9px] font-black text-foreground">{newClient.latitude.toFixed(6)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase">LONG</span>
                    <span className="text-[9px] font-black text-foreground">{newClient.longitude.toFixed(6)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
