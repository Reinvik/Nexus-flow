import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppSetting } from '@/types';
import toast from 'react-hot-toast';
import { Save, Settings as SettingsIcon, RefreshCw, Hash, Building2, Percent } from 'lucide-react';

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable local state
  const [nextInvoice, setNextInvoice] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxRate, setTaxRate] = useState('19');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('settings').select('*');
    
    if (error) {
      toast.error('Error al cargar configuraciones');
    } else if (data) {
      setSettings(data);
      // Map settings to local state
      const nextFolio = data.find(s => s.key === 'next_invoice_number')?.value || '';
      const name = data.find(s => s.key === 'company_name')?.value || '';
      const tax = data.find(s => s.key === 'tax_rate')?.value || '19';
      
      setNextInvoice(nextFolio);
      setCompanyName(name);
      setTaxRate(tax);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const updates = [
      { key: 'next_invoice_number', value: nextInvoice },
      { key: 'company_name', value: companyName },
      { key: 'tax_rate', value: taxRate }
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
      
      if (error) {
        toast.error(`Error al guardar ${update.key}`);
        setIsSaving(false);
        return;
      }
    }

    toast.success('Configuraciones actualizadas correctamente');
    setIsSaving(false);
    fetchSettings();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración Global</h2>
          <p className="text-slate-400 mt-1">Gestiona los parámetros base del sistema Nexus Flow.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Folios Section */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Hash size={24} />
            </div>
            <h3 className="text-xl font-bold">Documentos y Folios</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Siguiente Folio de Factura</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={nextInvoice}
                  onChange={(e) => setNextInvoice(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  placeholder="Ej: 1001"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                  Aplica al próximo guardado en POS
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Company Info Section */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Building2 size={24} />
            </div>
            <h3 className="text-xl font-bold">Información de Empresa</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Nombre de la Empresa / Razón Social</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                placeholder="Ej: Nexus Solutions SpA"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5 ml-1">Impuesto Aplicable (%)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-primary/50 transition-all outline-none"
                  placeholder="Ej: 19"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Percent size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h4 className="font-bold text-amber-500">Nota de Seguridad</h4>
          <p className="text-slate-400 text-sm mt-1">
            Los cambios realizados en esta sección afectan la lógica core del sistema. Asegúrese de que los folios no se traslapen con documentos ya existentes para evitar errores de integridad.
          </p>
        </div>
      </div>
    </div>
  );
}

