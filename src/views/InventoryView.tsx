import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, Save, Trash2, X, Edit3, AlertCircle, Package, DollarSign, TrendingUp, Box, Layers, ArrowRight, RefreshCcw, ChevronRight, PackageSearch } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  
  // New Product Form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [netPrice, setNetPrice] = useState('');
  const [stock, setStock] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nf_products')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast.error('Error al sincronizar inventario');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Better validation: stock can be "0"
    if (!name || !netPrice || stock === '') {
      toast.error('Nombre, Precio Neto y Stock son requeridos');
      return;
    }

    const productData = {
      name,
      sku: sku || null,
      net_price: parseFloat(netPrice),
      stock: parseInt(stock, 10)
    };

    try {
      let result;
      if (editingId) {
        result = await supabase.from('nf_products').update(productData).eq('id', editingId);
      } else {
        result = await supabase.from('nf_products').insert(productData);
      }

      if (result.error) {
        if (result.error.code === '23505') throw new Error('Ya existe un producto con ese SKU');
        throw result.error;
      }

      toast.success(editingId ? 'Maestro actualizado' : 'Producto registrado');
      setIsAdding(false);
      setEditingId(null);
      setName(''); setSku(''); setNetPrice(''); setStock('');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Error al persistir cambios');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name || '');
    setSku(product.sku || '');
    setNetPrice(product.net_price?.toString() || '0');
    setStock(product.stock?.toString() || '0');
    setIsAdding(true);
    
    // Smooth scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setName(''); setSku(''); setNetPrice(''); setStock('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Realmente desea eliminar este producto?')) return;
    try {
      const { error, status } = await supabase.from('nf_products').delete().eq('id', id);
      
      if (error) {
        if (error.code === '23503' || status === 409) {
          throw new Error('Producto con historial activo (Ventas)');
        }
        throw error;
      }
      toast.success('Producto removido');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filtered = useMemo(() => {
    let result = products.filter(p => 
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig.key) {
      result.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [products, searchTerm, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalValue = products.reduce((acc, p) => acc + (p.net_price * p.stock), 0);
  const criticalStock = products.filter(p => p.stock <= 5).length;
  const negativeStock = products.filter(p => p.stock < 0).length;

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-8 opacity-20">
        <div className="w-16 h-16 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Escaneando Base de Datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 lg:h-[calc(100vh-180px)] flex flex-col font-outfit animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-white flex items-center justify-center shadow-xl shadow-primary/10">
                <PackageSearch size={20} className="text-primary dark:text-black" fill="currentColor" />
             </div>
             <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Logística & Stock</p>
          </div>
          <h2 className="text-5xl font-black tracking-tighter text-foreground uppercase leading-none">Inventario <span className="text-slate-400 dark:text-slate-800">Maestro</span></h2>
        </div>
        
        <div className="flex items-center gap-4 w-full lg:w-auto">
           <div className="relative group flex-1 lg:flex-none">
             <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-cyan-400 transition-colors" />
             <input
               type="text"
               placeholder="BUSCAR SKU..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-14 pr-6 h-16 bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black text-foreground focus:border-cyan-500/30 outline-none w-full lg:w-80 uppercase tracking-widest"
             />
           </div>
           <button 
             onClick={() => setIsAdding(true)}
             className="h-16 px-10 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 flex items-center gap-3 shadow-2xl"
           >
             <Plus size={18} /> Registrar Item
           </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
          <div className="glass-card p-6 rounded-[2rem] border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Catálogo Total</p>
            <p className="text-xl font-black text-foreground">{products.length} Items</p>
            <p className="text-[8px] font-black uppercase text-slate-700 mt-1">Existencias Únicas</p>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Valorización</p>
            <p className="text-xl font-black text-emerald-500">{formatCurrency(totalValue)}</p>
            <p className="text-[8px] font-black uppercase text-slate-700 mt-1">Capital en Bodega</p>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Quiebre Stock</p>
            <p className={`text-xl font-black ${criticalStock > 0 ? 'text-amber-500' : 'text-foreground'}`}>{criticalStock} Alert</p>
            <p className="text-[8px] font-black uppercase text-slate-700 mt-1">Stock {"<="} 5 Units</p>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Stock Crítico</p>
            <p className={`text-xl font-black ${negativeStock > 0 ? 'text-rose-500 animate-pulse' : 'text-foreground'}`}>{negativeStock} Items</p>
            <p className="text-[8px] font-black uppercase text-slate-700 mt-1">Existencias Negativas</p>
          </div>
      </div>

      {/* Main Table Area */}
      <div className="px-4">
        <div className="glass-card rounded-[3.5rem] overflow-hidden border-white/5 shadow-2xl relative">
          {/* Add Form Overlay */}
          {isAdding && (
            <div 
              ref={formRef}
              className="p-10 border-b border-white/5 bg-cyan-500/[0.02] space-y-10 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] -mr-32 -mt-32" />
               <div className="flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400"><Edit3 size={18} /></div>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tighter">{editingId ? 'Editar Maestro' : 'Nuevo Registro'}</h3>
                  </div>
                  <button onClick={handleCancel} className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-foreground transition-all"><X size={18}/></button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
                  <div className="lg:col-span-2 space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Nombre del Producto</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={e=>setName(e.target.value)} 
                      placeholder="DESCRIPCIÓN COMERCIAL..."
                      className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all uppercase tracking-widest"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">SKU / Identificador</label>
                    <input 
                      type="text" 
                      value={sku} 
                      onChange={e=>setSku(e.target.value)} 
                      placeholder="REF-0000"
                      className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all uppercase tracking-widest"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Precio Neto</label>
                    <div className="relative group">
                       <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" />
                       <input 
                         type="number" 
                         value={netPrice} 
                         onChange={e=>setNetPrice(e.target.value)} 
                         className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl pl-14 pr-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all"
                       />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Stock Inicial</label>
                    <input 
                      type="number" 
                      value={stock} 
                      onChange={e=>setStock(e.target.value)} 
                      className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all"
                    />
                  </div>
               </div>

               <div className="flex justify-end gap-4 relative z-10">
                  <button onClick={handleSave} className="px-10 py-5 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                    <Save size={16} /> {editingId ? 'Actualizar Cambios' : 'Confirmar Alta'}
                  </button>
               </div>
            </div>
          )}

          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.01] text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[0.3em]">
                <th className="p-8 pl-10 cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort('name')}>
                  Descripción {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-8 cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort('sku')}>
                  Identificador {sortConfig.key === 'sku' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-8 cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort('net_price')}>
                  Costo {sortConfig.key === 'net_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-8 cursor-pointer hover:text-primary transition-colors" onClick={() => requestSort('stock')}>
                  Stock {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-8 pr-10 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map(p => (
                <tr 
                  key={p.id} 
                  className={`group transition-all ${editingId === p.id ? 'bg-cyan-500/10' : 'hover:bg-white/[0.01]'}`}
                >
                  <td className="p-8 pl-10">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-700 group-hover:text-cyan-400 transition-colors"><Package size={16} /></div>
                       <p className="text-sm font-black text-foreground uppercase tracking-tighter">{p.name}</p>
                    </div>
                  </td>
                  <td className="p-8">
                    <span className="text-[10px] font-black px-3 py-1 bg-white/5 rounded-lg text-slate-500 uppercase tracking-widest">{p.sku || 'N/A'}</span>
                  </td>
                  <td className="p-8 text-sm font-black text-foreground tracking-tighter">{formatCurrency(p.net_price)}</td>
                  <td className="p-8">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        p.stock < 0 ? 'bg-rose-500 animate-pulse' :
                        p.stock <= 5 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <span className={`text-[10px] font-black uppercase ${
                        p.stock < 0 ? 'text-rose-500' :
                        p.stock <= 5 ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        {p.stock} UNIDADES
                      </span>
                    </div>
                  </td>
                  <td className="p-8 pr-10 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                      <button onClick={() => handleEdit(p)} className="w-10 h-10 rounded-xl bg-slate-200/50 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-foreground transition-all"><Edit3 size={14}/></button>
                      <button onClick={() => handleDelete(p.id)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
