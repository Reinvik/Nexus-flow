import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AppSetting } from '@/types';
import toast from 'react-hot-toast';
import { Save, Settings as SettingsIcon, RefreshCw, Hash, Building2, Percent, ShieldCheck, Zap, Globe, HardDrive } from 'lucide-react';

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
    try {
      const { data, error } = await supabase.from('nf_settings').select('*');
      
      if (error) throw error;
      
      if (data) {
        setSettings(data);
        const nextFolio = data.find(s => s.key === 'next_invoice_number')?.value || '';
        const name = data.find(s => s.key === 'company_name')?.value || '';
        const tax = data.find(s => s.key === 'tax_rate')?.value || '19';
        
        setNextInvoice(nextFolio);
        setCompanyName(name);
        setTaxRate(tax);
      }
    } catch (error: any) {
      toast.error('Error al cargar configuraciones');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'next_invoice_number', value: nextInvoice },
        { key: 'company_name', value: companyName },
        { key: 'tax_rate', value: taxRate }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('nf_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
        
        if (error) throw error;
      }

      toast.success('Configuraciones sincronizadas');
      fetchSettings();
    } catch (error: any) {
      toast.error('Error al persistir cambios');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-8 opacity-20">
        <div className="w-16 h-16 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em]">Accediendo al Core del Sistema</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 font-outfit pb-24">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-10 px-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
             <span className="w-8 h-px bg-cyan-500" />
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">System Configuration</p>
          </div>
          <h2 className="text-5xl font-black tracking-tight text-foreground uppercase">Ajustes <span className="text-slate-700 dark:text-slate-500">& Core</span></h2>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest max-w-[400px] leading-relaxed">
            Parámetros globales que definen el comportamiento financiero y operativo de Nexus Flow.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="group relative flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 overflow-hidden"
        >
          <div className="absolute inset-0 bg-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
          <span className="relative z-10 flex items-center gap-2 group-hover:text-white transition-colors">
            {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            {isSaving ? 'Sincronizando...' : 'Persistir Cambios'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
               <ShieldCheck size={24} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-foreground uppercase tracking-tighter">Zona Crítica</h3>
              <p className="text-[10px] font-bold text-slate-600 uppercase leading-relaxed tracking-widest">
                Estos ajustes afectan la integridad de los documentos tributarios y el cálculo de impuestos.
              </p>
            </div>
            <div className="pt-6 border-t border-white/5 space-y-4">
               <div className="flex items-center gap-3 opacity-40">
                  <Globe size={14} className="text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cloud Sync Active</span>
               </div>
               <div className="flex items-center gap-3 opacity-40">
                  <HardDrive size={14} className="text-slate-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">v2.0.4 - Alpha Release</span>
               </div>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[2.5rem] border-amber-500/10 bg-amber-500/[0.02] flex items-start gap-4">
             <Zap className="text-amber-500 shrink-0" size={20} />
             <p className="text-[10px] font-bold text-amber-500/60 uppercase leading-relaxed tracking-widest">
               Los cambios en los folios impactan directamente en el Punto de Venta (POS).
             </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="lg:col-span-2 space-y-8">
           {/* Section: Operational */}
           <div className="glass-card p-10 rounded-[3.5rem] border-white/5 space-y-10">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                    <Hash size={20} />
                 </div>
                 <h4 className="text-xl font-black text-foreground uppercase tracking-tighter">Control Operativo</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Próximo Folio Factura</label>
                    <div className="relative group">
                       <input 
                         type="number" 
                         value={nextInvoice}
                         onChange={(e) => setNextInvoice(e.target.value)}
                         className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all uppercase tracking-widest"
                       />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-black text-slate-700 uppercase">Sequential</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Tasa de Impuesto (%)</label>
                    <div className="relative group">
                       <input 
                         type="number" 
                         value={taxRate}
                         onChange={(e) => setTaxRate(e.target.value)}
                         className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all uppercase tracking-widest"
                       />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-700">
                          <Percent size={16} />
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Section: Branding */}
           <div className="glass-card p-10 rounded-[3.5rem] border-white/5 space-y-10">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                    <Building2 size={20} />
                 </div>
                 <h4 className="text-xl font-black text-foreground uppercase tracking-tighter">Identidad Corporativa</h4>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Razón Social</label>
                 <input 
                   type="text" 
                   value={companyName}
                   onChange={(e) => setCompanyName(e.target.value)}
                   className="w-full bg-slate-200/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:border-cyan-500/30 outline-none transition-all uppercase tracking-widest"
                   placeholder="NOMBRE DE LA EMPRESA..."
                 />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

