import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import toast from 'react-hot-toast';
import { Search, Plus, Save, Trash2, X, Edit3 } from 'lucide-react';

export default function InventoryView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New Product Form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [netPrice, setNetPrice] = useState('');
  const [stock, setStock] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
      
    if (error) {
      toast.error('Error al cargar inventario: ' + error.message);
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!name || !netPrice || !stock) {
      toast.error('Nombre, Precio Neto y Stock son requeridos');
      return;
    }

    const productData = {
      name,
      sku: sku || null,
      net_price: parseFloat(netPrice),
      stock: parseInt(stock, 10)
    };

    let result;
    if (editingId) {
      result = await supabase.from('products').update(productData).eq('id', editingId);
    } else {
      result = await supabase.from('products').insert(productData);
    }

    const { error } = result;

    if (error) {
      if (error.code === '23505') toast.error('Ya existe un producto con ese SKU');
      else toast.error('Error al guardar producto');
      return;
    }

    toast.success(editingId ? 'Producto actualizado' : 'Producto agregado');
    setIsAdding(false);
    setEditingId(null);
    setName(''); setSku(''); setNetPrice(''); setStock('');
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setSku(product.sku || '');
    setNetPrice(product.net_price.toString());
    setStock(product.stock.toString());
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setName(''); setSku(''); setNetPrice(''); setStock('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Realmente desea eliminar este producto? Si tiene ventas asociadas, la base de datos lo impedirá por seguridad.')) return;
    const { error, status } = await supabase.from('products').delete().eq('id', id);
    
    if (error) {
      if (error.code === '23503' || status === 409) {
        toast.error('No se puede eliminar: El producto tiene ventas o registros asociados. Considere desactivarlo o cambiar su nombre en lugar de borrarlo.');
      } else {
        toast.error(`Error al eliminar (${status}): ${error.message}`);
      }
      console.error('Delete error:', error, 'Status:', status);
    } else {
      toast.success('Producto eliminado correctamente');
      fetchProducts();
    }
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalValue = products.reduce((acc, p) => acc + (p.net_price * p.stock), 0);
  const criticalStock = products.filter(p => p.stock <= 5).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Inventario</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
        >
          <Plus size={20} /> Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Total SKUs</p>
          <p className="text-2xl font-bold mt-1">{products.length}</p>
        </div>
        <div className="glass-card p-6 rounded-xl">
          <p className="text-slate-400 text-sm">Valor Total Inventario (Neto)</p>
          <p className="text-2xl font-bold mt-1">${totalValue.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-xl border-amber-500/30">
          <p className="text-amber-400 text-sm">Stock Crítico (≤ 5)</p>
          <p className="text-2xl font-bold text-amber-500 mt-1">{criticalStock}</p>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-card-border flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-card-border rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
            />
          </div>
        </div>

        {isAdding && (
          <div className="p-4 border-b border-card-border bg-slate-800/10 dark:bg-slate-800/30 flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-400 ml-1">Nombre *</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-400 ml-1">SKU (Opcional)</label>
              <input type="text" value={sku} onChange={e=>setSku(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-400 ml-1">Neto ($) *</label>
              <input type="number" value={netPrice} onChange={e=>setNetPrice(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div className="w-24">
              <label className="text-xs text-slate-400 ml-1">Stock *</label>
              <input type="number" value={stock} onChange={e=>setStock(e.target.value)} className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-foreground" />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleSave} 
                title={editingId ? "Guardar Cambios" : "Agregar Producto"}
                className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500"
              >
                <Save size={20}/>
              </button>
              <button onClick={handleCancel} className="bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-600">
                <X size={20}/>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-sm">
              <tr>
                <th className="p-4 font-medium">Producto</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">Precio Neto</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium">Valor Total</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500">No se encontraron productos.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4 text-slate-500">{p.sku || '-'}</td>
                    <td className="p-4">${p.net_price.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.stock < 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                        p.stock <= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                      }`}>
                        {p.stock} unid.
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">${(p.net_price * p.stock).toLocaleString()}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(p)} className="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

