import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Client } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, Minus, Trash2, ShoppingCart, AlertTriangle, CheckCircle2, UserPlus, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface CartItem extends Product {
  cartQuantity: number;
}

export default function SalesView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceFolio, setInvoiceFolio] = useState<string>('');
  const [folioWarning, setFolioWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Client State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentDays, setPaymentDays] = useState<number>(0);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', rut: '', address: '', commune: '' });
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchNextFolio();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) {
      toast.error('Error al cargar clientes');
    } else {
      setClients(data || []);
      // Set default client: Público General
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
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) {
      toast.error('Error al cargar productos en POS: ' + error.message);
      console.error(error);
    } else {
      setProducts(data || []);
    }
  };

  const fetchNextFolio = async () => {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'next_invoice_number').maybeSingle();
    if (error && error.code !== 'PGRST116') { // No error if not found (default to 1)
      console.error('Error fetching folio:', error);
    }
    if (data && data.value) {
      setInvoiceFolio(data.value);
    }
  };

  const checkFolio = async (folio: string) => {
    setFolioWarning(null);
    const { data } = await supabase.from('invoices').select('id').eq('folio', parseInt(folio, 10)).maybeSingle();
    if (data) {
      setFolioWarning(`La Factura #${folio} ya existe en la base de datos.`);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.cartQuantity + delta;
        if (newQ <= 0) return item;
        return { ...item, cartQuantity: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  // Math
  const netSubtotal = cart.reduce((acc, item) => acc + (item.net_price * item.cartQuantity), 0);
  const iva = Math.round(netSubtotal * 0.19);
  const totalWithTax = netSubtotal + iva;

  const handleSale = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío');
    if (!invoiceFolio) return toast.error('Ingrese un número de factura');
    if (folioWarning) return toast.error('El número de factura es inválido (duplicado)');

    setIsProcessing(true);
    const folioNum = parseInt(invoiceFolio, 10);

    try {
      // 1. Create Sale
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert({ 
          subtotal_net: netSubtotal, 
          total_tax: iva, 
          total_with_tax: totalWithTax,
          client_id: selectedClientId || null
        })
        .select('id').single();
      if (saleErr) throw saleErr;

      // Calculate due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + paymentDays);
      dueDate.setHours(0, 0, 0, 0);

      // 2. Create Invoice
      const { error: invErr } = await supabase
        .from('invoices')
        .insert({ 
          folio: folioNum, 
          sale_id: saleData.id, 
          total_amount: totalWithTax,
          paid_amount: 0,
          status: 'Pendiente',
          client_id: selectedClientId || null,
          payment_due_date: dueDate.toISOString()
        });
      if (invErr) throw invErr;

      // 3. Insert Items and update stock
      for (const item of cart) {
        await supabase.from('sale_items').insert({
          sale_id: saleData.id,
          product_id: item.id,
          quantity: item.cartQuantity,
          unit_price_net: item.net_price,
          subtotal_net: item.net_price * item.cartQuantity
        });
        
        await supabase.from('products')
          .update({ stock: item.stock - item.cartQuantity })
          .eq('id', item.id);
      }

      // 4. Update sync folio
      const { data: currentSettings } = await supabase.from('settings').select('value').eq('key', 'next_invoice_number').single();
      const currentNextFolio = currentSettings ? parseInt(currentSettings.value, 10) : 1;
      
      if (folioNum >= currentNextFolio) {
        await supabase.from('settings').update({ value: (folioNum + 1).toString() }).eq('key', 'next_invoice_number');
      }

      toast.success('Venta y Factura generadas con éxito');
      setCart([]);
      fetchProducts();
      fetchNextFolio();
    } catch (e: any) {
      toast.error('Error al procesar: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name) return toast.error('El nombre es obligatorio');
    const { data, error } = await supabase.from('clients').insert(newClient).select().single();
    if (error) {
      toast.error('Error al crear cliente: ' + error.message);
    } else {
      toast.success('Cliente creado');
      setClients(prev => [...prev, data]);
      setSelectedClientId(data.id);
      setIsNewClientModalOpen(false);
      setNewClient({ name: '', rut: '', address: '', commune: '' });
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
    (c.rut && c.rut.toLowerCase().includes(clientSearchTerm.toLowerCase()))
  );

  const filteredProd = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())));

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Products Column */}
      <div className="flex-1 flex flex-col gap-4">
        <h2 className="text-3xl font-bold">Punto de Venta</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar producto por nombre o SKU..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-card-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
          {filteredProd.map(product => (
            <div key={product.id} className="glass-card p-4 rounded-xl flex items-center justify-between hover:border-primary/50 transition-colors">
              <div>
                <p className="font-semibold text-lg">{product.name} <span className="text-sm font-normal text-slate-500 ml-2">{product.sku}</span></p>
                <div className="flex gap-4 mt-1 text-sm">
                  <span className="text-emerald-500 font-medium">${product.net_price.toLocaleString()} NETO</span>
                  <span className={`font-medium ${product.stock > 0 ? 'text-slate-400' : 'text-red-400'}`}>Stock: {product.stock}</span>
                </div>
              </div>
              <button 
                onClick={() => addToCart(product)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground p-3 rounded-xl transition-colors disabled:opacity-50"
              >
                <Plus size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Column */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        <div className="glass-card p-6 rounded-2xl flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 mb-6 text-xl font-bold">
            <ShoppingCart className="text-primary" /> Carrito
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center py-10">Agrega productos al carrito</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-start gap-2 border-b border-card-border pb-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-1">${item.net_price.toLocaleString()} x {item.cartQuantity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-bold">${(item.net_price * item.cartQuantity).toLocaleString()}</p>
                    <div className="flex items-center gap-1 bg-background border border-card-border rounded-lg p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"><Minus size={14}/></button>
                      <span className="text-xs w-6 text-center font-medium">{item.cartQuantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded"><Plus size={14}/></button>
                      <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-500/10 rounded ml-1"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-card-border">
            {/* Client Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Cliente</label>
                <button 
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="text-primary text-xs flex items-center gap-1 hover:underline"
                >
                  <UserPlus size={14}/> Nuevo Cliente
                </button>
              </div>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder="Escriba nombre o RUT..."
                    value={clientSearchTerm}
                    onChange={e => {
                      setClientSearchTerm(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                </div>

                {isClientDropdownOpen && (
                  <div className="absolute z-50 w-full bg-background border border-card-border rounded-xl mt-1 shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {filteredClients.length > 0 ? (
                      filteredClients.map(client => (
                        <div 
                          key={client.id}
                          onClick={() => {
                            setSelectedClientId(client.id);
                            setClientSearchTerm(client.name);
                            setIsClientDropdownOpen(false);
                          }}
                          className={`px-4 py-2 hover:bg-primary/10 cursor-pointer border-b border-card-border last:border-0 transition-colors ${selectedClientId === client.id ? 'bg-primary/5' : ''}`}
                        >
                          <p className="font-bold text-sm text-foreground">{client.name}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{client.rut || 'Sin RUT'}</p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-xs text-slate-500 italic text-center">
                        No se encontraron clientes
                      </div>
                    )}
                  </div>
                )}
                {/* Overlay to close dropdown when clicking away */}
                {isClientDropdownOpen && (
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsClientDropdownOpen(false)}
                  />
                )}
              </div>
              
              {selectedClientId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold animate-in zoom-in-95">
                  <CheckCircle2 size={10} />
                  Seleccionado: {clients.find(c => c.id === selectedClientId)?.name}
                </div>
              )}
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Calendar size={14}/> Días de Pago / Vencimiento
              </label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={paymentDays}
                  onChange={e => setPaymentDays(parseInt(e.target.value, 10) || 0)}
                  className="w-20 bg-background border border-card-border rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-xs flex items-center text-slate-500">
                  Vence: {formatDate(new Date(new Date().setDate(new Date().getDate() + paymentDays)))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Asignar Factura</label>
              <input 
                type="number" 
                value={invoiceFolio}
                onChange={e => setInvoiceFolio(e.target.value)}
                placeholder="N° Folio"
                className={`w-full bg-background border ${folioWarning ? 'border-red-500 focus:ring-red-500' : 'border-card-border focus:ring-primary'} rounded-xl px-4 py-2 font-mono text-lg focus:outline-none focus:ring-2`}
              />
              {folioWarning && (
                <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/> {folioWarning}</p>
              )}
            </div>

            <div className="bg-background rounded-xl p-4 border border-card-border space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal (Neto)</span>
                <span>${netSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-500">
                <span>IVA (19%)</span>
                <span>+ ${iva.toLocaleString()}</span>
              </div>
              <div className="h-px bg-card-border my-2"></div>
              <div className="flex justify-between text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                <span>TOTAL</span>
                <span>${totalWithTax.toLocaleString()}</span>
              </div>
            </div>

            <button 
              onClick={handleSale}
              disabled={isProcessing || cart.length === 0 || !!folioWarning}
              className="w-full bg-primary hover:bg-blue-600 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
            >
              {isProcessing ? 'Procesando...' : <><CheckCircle2 /> Completar Venta</>}
            </button>
          </div>
        </div>
      </div>
      {/* New Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 rounded-2xl space-y-4 shadow-2xl bg-white dark:bg-slate-900">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="text-primary" /> Nuevo Cliente
            </h3>
            <div className="space-y-3">
              <input 
                placeholder="Nombre completo" 
                value={newClient.name}
                onChange={e => setNewClient({...newClient, name: e.target.value})}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-2"
              />
              <input 
                placeholder="RUT (opcional)" 
                value={newClient.rut}
                onChange={e => setNewClient({...newClient, rut: e.target.value})}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-2"
              />
              <input 
                placeholder="Dirección" 
                value={newClient.address}
                onChange={e => setNewClient({...newClient, address: e.target.value})}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-2"
              />
              <input 
                placeholder="Comuna" 
                value={newClient.commune}
                onChange={e => setNewClient({...newClient, commune: e.target.value})}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-2"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsNewClientModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateClient}
                className="flex-1 py-2 rounded-xl bg-primary text-white hover:bg-blue-600 transition-colors"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

